/* Axon CRM — armazenamento na nuvem (capability `db` do Claude).
   Só entra em ação quando a página roda como artefato (existe window.claude); fora disso o CRM usa o localStorage.

   Modelo de dados: o estado é dividido em documentos pequenos para respeitar os limites do db (256 KiB por documento):
     meta/config            pipelines, produtos, listas, equipe e perfil
     <coleção>/bNN          registros agrupados em 32 “baldes” por hash do id: { r: { <id>: registro } }
   Coleções: deals, persons, orgs, leads, activities, notes, log.
   A cada alteração só os documentos que mudaram são regravados (comparação por JSON estável). */
(function (AX) {
  'use strict';
  var u = AX.u, S = AX.store;
  var BUCKETS = 32, COLLS = ['deals', 'persons', 'orgs', 'leads', 'activities', 'notes', 'log'];
  var DOC_LIMIT = 240 * 1024; // o db aceita 256 KiB; avisamos antes
  var db = null, synced = new Map(), syncing = false, again = false, status = 'off', lastError = null, lastLoad = 0;
  var statusListeners = [];

  function setStatus(st, err) {
    status = st; lastError = err || null;
    statusListeners.forEach(function (fn) { fn(st, err); });
  }
  function onStatus(fn) { statusListeners.push(fn); fn(status, lastError); }

  /* ---------- serialização estável (ordem das chaves não importa) ---------- */
  function stable(v) {
    if (v === undefined) return 'null';
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    return '{' + Object.keys(v).sort().filter(function (k) { return v[k] !== undefined; }).map(function (k) { return JSON.stringify(k) + ':' + stable(v[k]); }).join(',') + '}';
  }
  function bucketOf(id) {
    var h = 5381, s = String(id);
    for (var i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0;
    return 'b' + u.pad(h % BUCKETS);
  }

  /* ---------- estado → documentos ---------- */
  function unitsOf(s) {
    var out = new Map();
    out.set('meta/config', {
      v: s.v, createdAt: s.createdAt, lastBackupAt: s.lastBackupAt, profile: s.profile, users: s.users, currentUser: s.currentUser,
      pipelines: s.pipelines, products: s.products, lists: s.lists
    });
    COLLS.forEach(function (c) {
      var groups = {};
      s[c].forEach(function (rec) { var b = bucketOf(rec.id); (groups[b] = groups[b] || {})[rec.id] = rec; });
      Object.keys(groups).forEach(function (b) { out.set(c + '/' + b, { r: groups[b] }); });
    });
    return out;
  }
  function stringsOf(units) {
    var m = new Map();
    units.forEach(function (data, path) { m.set(path, stable(data)); });
    return m;
  }

  /* ---------- documentos → estado ---------- */
  function clone(x) { return JSON.parse(JSON.stringify(x)); } // os dados do db vêm congelados
  function loadAll() {
    var colls = COLLS.map(function (c) { return db.collection(c).get(); });
    return Promise.all([db.doc('meta/config').get()].concat(colls)).then(function (res) {
      var cfgSnap = res[0], sy = new Map(), truncated = false;
      if (!cfgSnap.exists) return { state: null, synced: sy, truncated: false };
      var cfg = clone(cfgSnap.data());
      sy.set('meta/config', stable(cfg));
      var st = Object.assign({}, cfg);
      COLLS.forEach(function (c, i) {
        var snap = res[i + 1], arr = [];
        if (snap.size >= 1000) truncated = true;
        snap.docs.forEach(function (d) {
          var data = clone(d.data() || {});
          sy.set(c + '/' + d.id, stable(data));
          var r = data.r || {};
          Object.keys(r).forEach(function (k) { arr.push(r[k]); });
        });
        arr.sort(function (a, b) { return (a.createdAt || a.at || '') < (b.createdAt || b.at || '') ? -1 : 1; });
        st[c] = arr;
      });
      return { state: st, synced: sy, truncated: truncated };
    });
  }

  /* ---------- gravação (somente o que mudou) ---------- */
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function exec(item, attempt) {
    var p = item.op === 'set' ? db.doc(item.path).set(item.data) : db.doc(item.path).delete();
    return p.then(function () {
      if (item.op === 'set') synced.set(item.path, item.str); else synced.delete(item.path);
    }, function (e) {
      var code = e && e.code;
      if ((code === 'resource_exhausted' || code === 'unavailable') && attempt < 4) {
        return sleep(400 * Math.pow(2, attempt) + Math.random() * 200).then(function () { return exec(item, attempt + 1); });
      }
      throw e;
    });
  }
  function runPlan(plan) {
    var i = 0, failure = null, WORKERS = 3;
    function worker() {
      if (failure || i >= plan.length) return Promise.resolve();
      var item = plan[i++];
      return exec(item, 0).then(worker, function (e) { failure = failure || e; });
    }
    var ws = [];
    for (var k = 0; k < WORKERS; k++) ws.push(worker());
    return Promise.all(ws).then(function () { if (failure) throw failure; });
  }
  function planFor(units, strs) {
    var plan = [];
    strs.forEach(function (str, path) {
      if (synced.get(path) !== str) plan.push({ op: 'set', path: path, data: units.get(path), str: str });
    });
    synced.forEach(function (str, path) { if (!strs.has(path)) plan.push({ op: 'delete', path: path }); });
    return plan;
  }
  function syncNow() {
    if (!db) return Promise.resolve();
    if (syncing) { again = true; return Promise.resolve(); }
    syncing = true;
    setStatus('saving');
    function round() {
      again = false;
      var units = unitsOf(S.s), strs = stringsOf(units), plan = planFor(units, strs);
      var big = plan.filter(function (p) { return p.op === 'set' && p.str.length > DOC_LIMIT; })[0];
      if (big) { var err = { code: 'quota_exceeded', message: 'Um grupo de registros passou do limite de tamanho (' + big.path + ').' }; throw err; }
      return runPlan(plan).then(function () { if (again) return round(); });
    }
    return round().then(function () { setStatus('saved'); }, function (e) {
      console.warn('[axon-crm] falha ao salvar na nuvem', e);
      setStatus('error', e);
    }).then(function () { syncing = false; if (again && status !== 'error') return syncNow(); });
  }
  var timer = null;
  function schedule() { clearTimeout(timer); timer = setTimeout(function () { timer = null; syncNow(); }, 150); }
  function hasPending() {
    if (!db) return false;
    if (syncing || timer) return true;
    var units = unitsOf(S.s);
    return planFor(units, stringsOf(units)).length > 0;
  }

  /* ---------- atualização a partir da nuvem (outro aparelho/aba) ---------- */
  function refresh(force) {
    if (!db || syncing || timer || status === 'error') return Promise.resolve(false);
    if (!force && Date.now() - lastLoad < 45000) return Promise.resolve(false);
    lastLoad = Date.now();
    if (hasPending()) return Promise.resolve(false); // há alterações locais ainda não gravadas
    return loadAll().then(function (res) {
      if (!res.state) return false;
      var changed = res.synced.size !== synced.size;
      res.synced.forEach(function (str, path) { if (synced.get(path) !== str) changed = true; });
      if (!changed) return false;
      synced = res.synced;
      S.replaceState(res.state);
      if (AX.ui) AX.ui.toast('Dados atualizados a partir da nuvem.');
      return true;
    }, function () { return false; });
  }

  /* ---------- inicialização ---------- */
  function init() {
    if (!u.hasHost()) return Promise.resolve('browser');
    var withTimeout = Promise.race([window.claude.use('db'), sleep(12000).then(function () { return null; })]);
    return withTimeout.then(function (d) {
      if (!d) return 'browser'; // sem login/permissão: segue com o armazenamento do navegador
      db = d;
      return loadAll().then(function (res) {
        lastLoad = Date.now();
        S.setBackend({ name: 'cloud', write: schedule });
        if (res.state) {
          synced = res.synced;
          S.replaceState(res.state);
          if (res.truncated && AX.ui) AX.ui.toast('Há muitos registros: parte pode não ter sido carregada.', { kind: 'error', duration: 8000 });
        } else {
          // nuvem vazia: o estado atual (padrão, ou migrado do navegador) vira o primeiro conteúdo
          var s = S.s;
          if (s.deals.length + s.leads.length + s.persons.length + s.orgs.length > 0) schedule();
        }
        setStatus('saved');
        return 'cloud';
      });
    }).catch(function (e) {
      console.warn('[axon-crm] nuvem indisponível, usando o navegador', e);
      db = null; S.setBackend(null);
      return 'browser-fallback';
    });
  }

  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') refresh(false); });
  window.addEventListener('beforeunload', function (e) {
    if (db && hasPending()) { e.preventDefault(); e.returnValue = ''; }
  });

  // resolve quando não há gravação pendente nem em andamento (usado em testes e antes de operações destrutivas)
  function whenSaved() {
    S.flush();
    return new Promise(function (resolve) {
      (function poll() { if (!timer && !syncing) resolve(status); else setTimeout(poll, 30); })();
    });
  }

  AX.cloud = {
    whenSaved: whenSaved, onStatus: onStatus, retry: function () { setStatus('saving'); return syncNow(); }, refresh: refresh,
    get status() { return status; }, get active() { return !!db; }
  };
  AX.ready = init();
})(window.AX = window.AX || {});
