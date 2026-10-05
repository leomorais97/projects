/* Axon CRM — store: estado único, persistência (localStorage), índices, selectors e mutações.
   Para trocar por um backend, basta reimplementar load()/persist() (ver "adaptador de storage"). */
(function (AX) {
  'use strict';
  var u = AX.u;
  var KEY = 'axoncrm.v1', PREF_KEY = 'axoncrm.prefs';
  var state, idx = null, listeners = [], saveTimer = null;

  /* ---------- adaptador de storage ---------- */
  var storage = {
    read: function () { try { return localStorage.getItem(KEY); } catch (e) { return null; } },
    write: function (txt) { localStorage.setItem(KEY, txt); }
  };

  function migrate(s) {
    var d = AX.data.defaults();
    s = s && typeof s === 'object' ? s : d;
    ['users', 'pipelines', 'deals', 'persons', 'orgs', 'leads', 'activities', 'notes', 'log', 'products'].forEach(function (k) {
      if (!Array.isArray(s[k])) s[k] = d[k];
    });
    s.lists = s.lists || {};
    Object.keys(d.lists).forEach(function (k) { if (!Array.isArray(s.lists[k])) s.lists[k] = d.lists[k]; });
    s.profile = Object.assign({}, d.profile, s.profile);
    if (!s.users.length) s.users = d.users;
    if (!s.users.some(function (x) { return x.id === s.currentUser; })) s.currentUser = s.users[0].id;
    if (!s.pipelines.length) s.pipelines = d.pipelines;
    s.pipelines.forEach(function (pl) {
      if (!Array.isArray(pl.stages) || !pl.stages.length) pl.stages = [{ id: u.uid('st'), name: 'Etapa 1', prob: 10, rot: 7 }];
    });
    // backups antigos/editados à mão: garante os campos que as telas assumem existir
    var stageIds = new Set(), now = u.nowIso();
    s.pipelines.forEach(function (pl) { pl.stages.forEach(function (st) { stageIds.add(st.id); }); });
    s.deals.forEach(function (d, i) {
      if (!stageIds.has(d.stageId)) {
        var pl = s.pipelines.filter(function (p) { return p.id === d.pipelineId; })[0] || s.pipelines[0];
        d.pipelineId = pl.id; d.stageId = pl.stages[0].id;
      }
      d.createdAt = d.createdAt || now;
      d.stageEnteredAt = d.stageEnteredAt || d.createdAt;
      if (!Array.isArray(d.history) || !d.history.length) d.history = [{ stageId: d.stageId, at: d.createdAt }];
      if (!Array.isArray(d.products)) d.products = [];
      if (typeof d.order !== 'number') d.order = i;
      if (d.status !== 'won' && d.status !== 'lost') d.status = 'open';
      d.title = d.title || 'Negócio sem título';
    });
    s.v = 1;
    return s;
  }
  function load() {
    var raw = storage.read(), parsed = null;
    if (raw) { try { parsed = JSON.parse(raw); } catch (e) { parsed = null; } }
    state = migrate(parsed);
    idx = null;
  }
  function persist() {
    try { storage.write(JSON.stringify(state)); }
    catch (e) {
      if (AX.ui) AX.ui.toast('Não foi possível salvar no navegador (armazenamento cheio ou bloqueado). Exporte um backup em Configurações → Dados.', { kind: 'error' });
    }
  }
  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(persist, 120); }
  function flush() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; persist(); } }
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);

  function commit() { idx = null; save(); listeners.forEach(function (fn) { fn(); }); }
  function subscribe(fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (x) { return x !== fn; }); }; }
  // outra aba alterou os dados → recarrega
  window.addEventListener('storage', function (e) {
    if (e.key === KEY && e.newValue) { load(); listeners.forEach(function (fn) { fn(); }); }
  });

  /* ---------- preferências de interface (não fazem parte dos dados) ---------- */
  var prefs = (function () {
    var p = {};
    try { p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {}; } catch (e) { p = {}; }
    return {
      get: function (k, d) { return p[k] === undefined ? d : p[k]; },
      set: function (k, v) { p[k] = v; try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch (e) { /* ignora */ } }
    };
  })();

  /* ---------- índice (reconstruído lazy após cada commit) ---------- */
  function mapBy(arr) { var m = new Map(); arr.forEach(function (x) { m.set(x.id, x); }); return m; }
  function ix() {
    if (idx) return idx;
    var stages = new Map();
    state.pipelines.forEach(function (pl) { pl.stages.forEach(function (st, i) { stages.set(st.id, { stage: st, pipeline: pl, index: i }); }); });
    var actsByDeal = new Map(), notesByDeal = new Map();
    state.activities.forEach(function (a) {
      if (!a.dealId) return;
      if (!actsByDeal.has(a.dealId)) actsByDeal.set(a.dealId, []);
      actsByDeal.get(a.dealId).push(a);
    });
    state.notes.forEach(function (n) {
      if (!n.dealId) return;
      if (!notesByDeal.has(n.dealId)) notesByDeal.set(n.dealId, []);
      notesByDeal.get(n.dealId).push(n);
    });
    idx = {
      users: mapBy(state.users), orgs: mapBy(state.orgs), persons: mapBy(state.persons), deals: mapBy(state.deals),
      leads: mapBy(state.leads), products: mapBy(state.products), pipelines: mapBy(state.pipelines), stages: stages,
      sources: mapBy(state.lists.sources), labels: mapBy(state.lists.labels), lostReasons: mapBy(state.lists.lostReasons),
      projectTypes: mapBy(state.lists.projectTypes), actsByDeal: actsByDeal, notesByDeal: notesByDeal
    };
    return idx;
  }

  /* ---------- selectors ---------- */
  var q = {
    user: function (id) { return ix().users.get(id); },
    org: function (id) { return ix().orgs.get(id); },
    person: function (id) { return ix().persons.get(id); },
    deal: function (id) { return ix().deals.get(id); },
    lead: function (id) { return ix().leads.get(id); },
    product: function (id) { return ix().products.get(id); },
    pipeline: function (id) { return ix().pipelines.get(id); },
    stageInfo: function (id) { return ix().stages.get(id); },
    source: function (id) { return ix().sources.get(id); },
    label: function (id) { return ix().labels.get(id); },
    lostReason: function (id) { return ix().lostReasons.get(id); },
    projectType: function (id) { return ix().projectTypes.get(id); },
    me: function () { return ix().users.get(state.currentUser); },
    dealActs: function (id) { return ix().actsByDeal.get(id) || []; },
    dealNotes: function (id) { return ix().notesByDeal.get(id) || []; },
    actType: function (id) { return AX.ACTIVITY_TYPES.filter(function (t) { return t.id === id; })[0] || AX.ACTIVITY_TYPES[6]; },
    isOverdue: function (a) {
      if (a.done || !a.dueDate) return false;
      var t = u.today();
      if (a.dueDate < t) return true;
      if (a.dueDate === t && a.dueTime) { var n = new Date(); return a.dueTime < u.pad(n.getHours()) + ':' + u.pad(n.getMinutes()); }
      return false;
    },
    openActs: function (dealId) {
      return q.dealActs(dealId).filter(function (a) { return !a.done; }).sort(actSort);
    },
    nextAct: function (dealId) { return q.openActs(dealId)[0] || null; },
    // 'overdue' | 'scheduled' | 'none'
    actState: function (dealId) {
      var o = q.openActs(dealId);
      if (!o.length) return 'none';
      return o.some(q.isOverdue) ? 'overdue' : 'scheduled';
    },
    daysInStage: function (d) { return u.daysSince(d.stageEnteredAt || d.createdAt); },
    isRotting: function (d) {
      if (d.status !== 'open') return false;
      var si = ix().stages.get(d.stageId);
      return !!(si && si.stage.rot > 0 && q.daysInStage(d) > si.stage.rot);
    },
    weighted: function (d) { var si = ix().stages.get(d.stageId); return (Number(d.value) || 0) * ((si ? si.stage.prob : 0) / 100); },
    orgName: function (id) { var o = q.org(id); return o ? o.name : ''; },
    personName: function (id) { var p = q.person(id); return p ? p.name : ''; }
  };
  function actSort(a, b) {
    var ka = (a.dueDate || '9999') + (a.dueTime || '99:99'), kb = (b.dueDate || '9999') + (b.dueTime || '99:99');
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  }

  /* ---------- changelog ---------- */
  function log(entity, entityId, text) {
    state.log.push({ id: u.uid('l'), entity: entity, entityId: entityId, at: u.nowIso(), text: text, userId: state.currentUser });
    if (state.log.length > 8000) state.log.splice(0, 1000);
  }

  /* ---------- negócios ---------- */
  var DEAL_FIELDS = {
    title: { label: 'Título' },
    value: { label: 'Valor', fmt: function (v) { return u.money(v, { cents: true }); } },
    mrr: { label: 'Recorrência mensal', fmt: function (v) { return u.money(v, { cents: true }); } },
    expectedClose: { label: 'Fechamento previsto', fmt: function (v) { return v ? u.fmtDate(v) : '—'; } },
    ownerId: { label: 'Responsável', fmt: function (v) { var x = q.user(v); return x ? x.name : '—'; } },
    labelId: { label: 'Etiqueta', fmt: function (v) { var x = q.label(v); return x ? x.name : '—'; } },
    sourceId: { label: 'Origem', fmt: function (v) { var x = q.source(v); return x ? x.name : '—'; } },
    projectTypeId: { label: 'Tipo de projeto', fmt: function (v) { var x = q.projectType(v); return x ? x.name : '—'; } },
    siteUrl: { label: 'Site atual' },
    personId: { label: 'Pessoa', fmt: function (v) { return q.personName(v) || '—'; } },
    orgId: { label: 'Organização', fmt: function (v) { return q.orgName(v) || '—'; } }
  };

  function addDeal(f) {
    var pl = q.pipeline(f.pipelineId) || state.pipelines[0];
    var stageId = f.stageId && q.stageInfo(f.stageId) ? f.stageId : pl.stages[0].id;
    var t = u.nowIso();
    var minOrder = state.deals.reduce(function (m, d) { return d.stageId === stageId && d.status === 'open' ? Math.min(m, d.order) : m; }, 0);
    var deal = {
      id: u.uid('d'), title: (f.title || '').trim() || 'Novo negócio', value: Number(f.value) || 0, mrr: Number(f.mrr) || 0,
      pipelineId: q.stageInfo(stageId).pipeline.id, stageId: stageId, order: minOrder - 1, status: 'open',
      personId: f.personId || null, orgId: f.orgId || null, ownerId: f.ownerId || state.currentUser, labelId: f.labelId || null,
      sourceId: f.sourceId || null, projectTypeId: f.projectTypeId || null, siteUrl: f.siteUrl || '', expectedClose: f.expectedClose || '',
      products: [], createdAt: t, updatedAt: t, stageEnteredAt: t, history: [{ stageId: stageId, at: t }],
      wonAt: null, lostAt: null, lostReasonId: null, lostNote: ''
    };
    state.deals.push(deal);
    log('deal', deal.id, 'Negócio criado');
    commit();
    return deal;
  }
  function updateDeal(id, patch) {
    var d = q.deal(id);
    if (!d) return null;
    var changes = [];
    Object.keys(patch).forEach(function (k) {
      var old = d[k], nv = patch[k], meta = DEAL_FIELDS[k];
      if (k === 'value' || k === 'mrr') nv = Number(nv) || 0;
      if (old === nv || (old == null && (nv === '' || nv == null))) return;
      d[k] = nv;
      if (meta) changes.push(meta.label + ': ' + (meta.fmt ? meta.fmt(old) : old || '—') + ' → ' + (meta.fmt ? meta.fmt(nv) : nv || '—'));
    });
    if (changes.length) { d.updatedAt = u.nowIso(); changes.forEach(function (c) { log('deal', id, c); }); commit(); }
    return d;
  }
  function moveDeal(id, stageId, order) {
    var d = q.deal(id), si = q.stageInfo(stageId);
    if (!d || !si) return;
    if (d.stageId !== stageId) {
      var from = q.stageInfo(d.stageId);
      var t = u.nowIso();
      d.stageId = stageId; d.pipelineId = si.pipeline.id; d.stageEnteredAt = t; d.history.push({ stageId: stageId, at: t });
      log('deal', id, 'Movido de “' + (from ? from.stage.name : '—') + '” para “' + si.stage.name + '”');
    }
    if (order != null) d.order = order;
    d.updatedAt = u.nowIso();
    commit();
  }
  function winDeal(id) {
    var d = q.deal(id); if (!d) return;
    d.status = 'won'; d.wonAt = u.nowIso(); d.lostAt = null; d.lostReasonId = null; d.lostNote = ''; d.updatedAt = d.wonAt;
    log('deal', id, 'Negócio ganho 🎉'); commit();
  }
  function loseDeal(id, reasonId, note) {
    var d = q.deal(id); if (!d) return;
    d.status = 'lost'; d.lostAt = u.nowIso(); d.wonAt = null; d.lostReasonId = reasonId || null; d.lostNote = note || ''; d.updatedAt = d.lostAt;
    var r = q.lostReason(reasonId);
    log('deal', id, 'Negócio perdido' + (r ? ': ' + r.name : '') + (note ? ' — ' + note : '')); commit();
  }
  function reopenDeal(id) {
    var d = q.deal(id); if (!d) return;
    d.status = 'open'; d.wonAt = null; d.lostAt = null; d.lostReasonId = null; d.lostNote = ''; d.stageEnteredAt = u.nowIso(); d.updatedAt = d.stageEnteredAt;
    log('deal', id, 'Negócio reaberto'); commit();
  }
  function deleteDeal(id) {
    state.deals = state.deals.filter(function (d) { return d.id !== id; });
    state.activities = state.activities.filter(function (a) { return a.dealId !== id; });
    state.notes = state.notes.filter(function (n) { return n.dealId !== id; });
    state.log = state.log.filter(function (l) { return !(l.entity === 'deal' && l.entityId === id); });
    commit();
  }
  function calcProducts(lines) {
    var once = 0, monthly = 0;
    lines.forEach(function (l) {
      var tot = (Number(l.price) || 0) * (Number(l.qty) || 0) * (1 - (Number(l.discount) || 0) / 100);
      if (l.billing === 'monthly') monthly += tot; else once += tot;
    });
    return { once: once, monthly: monthly };
  }
  function setDealProducts(id, lines, quiet) {
    var d = q.deal(id); if (!d) return;
    d.products = lines;
    if (lines.length) { var t = calcProducts(lines); d.value = t.once; d.mrr = t.monthly; }
    d.updatedAt = u.nowIso();
    if (!quiet) log('deal', id, 'Produtos atualizados (' + lines.length + ' ' + (lines.length === 1 ? 'item' : 'itens') + ')');
    commit();
  }

  /* ---------- pessoas e organizações ---------- */
  function addPerson(f) {
    var p = { id: u.uid('p'), name: (f.name || '').trim(), role: f.role || '', email: f.email || '', phone: f.phone || '', linkedin: f.linkedin || '', orgId: f.orgId || null, ownerId: f.ownerId || state.currentUser, createdAt: u.nowIso() };
    state.persons.push(p); commit(); return p;
  }
  function updatePerson(id, patch) { var p = q.person(id); if (!p) return; Object.assign(p, patch); commit(); return p; }
  function deletePerson(id) {
    state.persons = state.persons.filter(function (p) { return p.id !== id; });
    state.deals.forEach(function (d) { if (d.personId === id) d.personId = null; });
    state.activities.forEach(function (a) { if (a.personId === id) a.personId = null; });
    state.notes = state.notes.filter(function (n) { return n.personId !== id || n.dealId; });
    commit();
  }
  function addOrg(f) {
    var o = { id: u.uid('o'), name: (f.name || '').trim(), website: f.website || '', segment: f.segment || '', city: f.city || '', phone: f.phone || '', cnpj: f.cnpj || '', ownerId: f.ownerId || state.currentUser, createdAt: u.nowIso() };
    state.orgs.push(o); commit(); return o;
  }
  function updateOrg(id, patch) { var o = q.org(id); if (!o) return; Object.assign(o, patch); commit(); return o; }
  function deleteOrg(id) {
    state.orgs = state.orgs.filter(function (o) { return o.id !== id; });
    state.persons.forEach(function (p) { if (p.orgId === id) p.orgId = null; });
    state.deals.forEach(function (d) { if (d.orgId === id) d.orgId = null; });
    state.activities.forEach(function (a) { if (a.orgId === id) a.orgId = null; });
    state.notes = state.notes.filter(function (n) { return n.orgId !== id || n.dealId; });
    commit();
  }
  function findOrgByName(name) { var n = u.norm(name); return n ? state.orgs.filter(function (o) { return u.norm(o.name) === n; })[0] || null : null; }
  function findPerson(name, email, orgId) {
    var n = u.norm(name), e = u.norm(email);
    return state.persons.filter(function (p) { return (e && u.norm(p.email) === e) || (n && u.norm(p.name) === n && (!orgId || p.orgId === orgId)); })[0] || null;
  }

  /* ---------- leads ---------- */
  function newLead(f, t) {
    return {
      id: u.uid('ld'), title: (f.title || f.orgName || f.personName || 'Novo lead').trim(), orgName: f.orgName || '', personName: f.personName || '', role: f.role || '',
      email: f.email || '', phone: f.phone || '', website: f.website || '', linkedin: f.linkedin || '', sourceId: f.sourceId || null, labelId: f.labelId || null,
      value: Number(f.value) || 0, note: f.note || '', ownerId: f.ownerId || state.currentUser, createdAt: t || u.nowIso(), archived: false, convertedDealId: null
    };
  }
  function addLead(f) { var l = newLead(f); state.leads.push(l); commit(); return l; }
  function importLeads(list) {
    var t = u.nowIso();
    list.forEach(function (f) { state.leads.push(newLead(f, t)); });
    commit(); return list.length;
  }
  function updateLead(id, patch) { var l = q.lead(id); if (!l) return; Object.assign(l, patch); commit(); return l; }
  function deleteLead(id) { state.leads = state.leads.filter(function (l) { return l.id !== id; }); commit(); }
  function convertLead(id, opts) {
    var l = q.lead(id); if (!l) return null;
    var org = l.orgName ? findOrgByName(l.orgName) : null;
    if (!org && l.orgName) { org = { id: u.uid('o'), name: l.orgName.trim(), website: l.website || '', segment: '', city: '', phone: '', cnpj: '', ownerId: l.ownerId, createdAt: u.nowIso() }; state.orgs.push(org); }
    var person = l.personName ? findPerson(l.personName, l.email, org && org.id) : null;
    if (!person && l.personName) {
      person = { id: u.uid('p'), name: l.personName.trim(), role: l.role || '', email: l.email || '', phone: l.phone || '', linkedin: l.linkedin || '', orgId: org ? org.id : null, ownerId: l.ownerId, createdAt: u.nowIso() };
      state.persons.push(person);
    }
    var deal = addDeal({
      title: l.title, value: l.value, pipelineId: opts.pipelineId, stageId: opts.stageId, orgId: org && org.id, personId: person && person.id,
      ownerId: l.ownerId, labelId: l.labelId, sourceId: l.sourceId, siteUrl: l.website ? u.safeUrl(l.website) : ''
    });
    if (l.note) state.notes.push({ id: u.uid('n'), content: l.note, dealId: deal.id, personId: null, orgId: null, pinned: false, createdAt: u.nowIso(), updatedAt: null });
    l.convertedDealId = deal.id; l.archived = true;
    log('deal', deal.id, 'Convertido a partir de um lead');
    commit();
    return deal;
  }

  /* ---------- atividades e notas ---------- */
  function addActivity(f) {
    var deal = f.dealId ? q.deal(f.dealId) : null;
    var a = {
      id: u.uid('a'), type: f.type || 'task', subject: (f.subject || '').trim() || q.actType(f.type).name, dueDate: f.dueDate || u.today(), dueTime: f.dueTime || '',
      duration: Number(f.duration) || 0, done: !!f.done, doneAt: f.done ? u.nowIso() : null, dealId: f.dealId || null,
      personId: f.personId || (deal && deal.personId) || null, orgId: f.orgId || (deal && deal.orgId) || null, leadId: f.leadId || null,
      ownerId: f.ownerId || state.currentUser, note: f.note || '', createdAt: u.nowIso()
    };
    state.activities.push(a); commit(); return a;
  }
  function updateActivity(id, patch) {
    var a = state.activities.filter(function (x) { return x.id === id; })[0]; if (!a) return;
    Object.assign(a, patch); commit(); return a;
  }
  function toggleActivity(id) {
    var a = state.activities.filter(function (x) { return x.id === id; })[0]; if (!a) return;
    a.done = !a.done; a.doneAt = a.done ? u.nowIso() : null; commit(); return a;
  }
  function deleteActivity(id) { state.activities = state.activities.filter(function (a) { return a.id !== id; }); commit(); }
  function addNote(f) {
    var n = { id: u.uid('n'), content: f.content, dealId: f.dealId || null, personId: f.personId || null, orgId: f.orgId || null, pinned: false, createdAt: u.nowIso(), updatedAt: null };
    state.notes.push(n); commit(); return n;
  }
  function updateNote(id, patch) { var n = state.notes.filter(function (x) { return x.id === id; })[0]; if (!n) return; Object.assign(n, patch, { updatedAt: u.nowIso() }); commit(); }
  function deleteNote(id) { state.notes = state.notes.filter(function (n) { return n.id !== id; }); commit(); }

  /* ---------- produtos ---------- */
  function addProduct(f) {
    var p = { id: u.uid('pr'), name: f.name.trim(), price: Number(f.price) || 0, billing: f.billing === 'monthly' ? 'monthly' : 'once', description: f.description || '', active: true };
    state.products.push(p); commit(); return p;
  }
  function updateProduct(id, patch) { var p = q.product(id); if (!p) return; Object.assign(p, patch); commit(); }
  function deleteProduct(id) { state.products = state.products.filter(function (p) { return p.id !== id; }); commit(); }

  /* ---------- pipelines e etapas ---------- */
  function addPipeline(name) {
    var pl = { id: u.uid('pl'), name: name.trim(), stages: [
      { id: u.uid('st'), name: 'Primeiro contato', prob: 10, rot: 7 },
      { id: u.uid('st'), name: 'Proposta', prob: 50, rot: 7 },
      { id: u.uid('st'), name: 'Negociação', prob: 80, rot: 10 }
    ] };
    state.pipelines.push(pl); commit(); return pl;
  }
  function renamePipeline(id, name) { var pl = q.pipeline(id); if (pl && name.trim()) { pl.name = name.trim(); commit(); } }
  function deletePipeline(id) {
    if (state.pipelines.length < 2) return false;
    if (state.deals.some(function (d) { return d.pipelineId === id; })) return false;
    state.pipelines = state.pipelines.filter(function (p) { return p.id !== id; }); commit(); return true;
  }
  function addStage(plId, f) {
    var pl = q.pipeline(plId); if (!pl) return;
    var st = { id: u.uid('st'), name: f.name.trim() || 'Nova etapa', prob: Number(f.prob) || 0, rot: Number(f.rot) || 0 };
    pl.stages.push(st); commit(); return st;
  }
  function updateStage(stId, patch) { var si = q.stageInfo(stId); if (si) { Object.assign(si.stage, patch); commit(); } }
  function moveStage(stId, dir) {
    var si = q.stageInfo(stId); if (!si) return;
    var arr = si.pipeline.stages, i = si.index, j = i + dir;
    if (j < 0 || j >= arr.length) return;
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t; commit();
  }
  function deleteStage(stId, moveToId) {
    var si = q.stageInfo(stId); if (!si || si.pipeline.stages.length < 2) return false;
    var target = moveToId && q.stageInfo(moveToId);
    var affected = state.deals.filter(function (d) { return d.stageId === stId; });
    if (affected.length && !target) return false;
    affected.forEach(function (d) { d.stageId = target.stage.id; d.stageEnteredAt = u.nowIso(); d.history.push({ stageId: target.stage.id, at: d.stageEnteredAt }); });
    si.pipeline.stages = si.pipeline.stages.filter(function (s) { return s.id !== stId; });
    commit(); return true;
  }

  /* ---------- listas configuráveis ---------- */
  var LIST_REFS = { sources: 'sourceId', labels: 'labelId', projectTypes: 'projectTypeId', lostReasons: 'lostReasonId' };
  function listAdd(name, item) { item.id = u.uid(name.slice(0, 2)); state.lists[name].push(item); commit(); return item; }
  function listUpdate(name, id, patch) { var it = state.lists[name].filter(function (x) { return x.id === id; })[0]; if (it) { Object.assign(it, patch); commit(); } }
  function listRemove(name, id) {
    state.lists[name] = state.lists[name].filter(function (x) { return x.id !== id; });
    var ref = LIST_REFS[name];
    state.deals.forEach(function (d) { if (d[ref] === id) d[ref] = null; });
    if (name === 'sources' || name === 'labels') state.leads.forEach(function (l) { if (l[ref] === id) l[ref] = null; });
    commit();
  }

  /* ---------- equipe ---------- */
  var USER_COLORS = ['#256abf', '#0f7f1b', '#b3541e', '#7a3fb0', '#b02a63', '#0e7c86', '#6b6f2a'];
  function addUser(name) {
    var us = { id: u.uid('u'), name: name.trim(), color: USER_COLORS[state.users.length % USER_COLORS.length] };
    state.users.push(us); commit(); return us;
  }
  function updateUser(id, patch) { var us = q.user(id); if (us) { Object.assign(us, patch); commit(); } }
  function removeUser(id) {
    if (state.users.length < 2 || id === state.currentUser) return false;
    var me = state.currentUser;
    ['deals', 'persons', 'orgs', 'leads', 'activities'].forEach(function (k) { state[k].forEach(function (x) { if (x.ownerId === id) x.ownerId = me; }); });
    state.users = state.users.filter(function (x) { return x.id !== id; }); commit(); return true;
  }
  function setProfile(patch) { Object.assign(state.profile, patch); commit(); }

  /* ---------- dados: backup, restauração, exemplo ---------- */
  function exportJSON() { state.lastBackupAt = u.nowIso(); save(); listeners.forEach(function (fn) { fn(); }); return JSON.stringify(state, null, 2); }
  function importJSON(text) {
    var parsed;
    try { parsed = JSON.parse(text); } catch (e) { return { ok: false, error: 'O arquivo não é um JSON válido.' }; }
    if (!parsed || !Array.isArray(parsed.deals) || !Array.isArray(parsed.pipelines) || !parsed.pipelines.length) return { ok: false, error: 'Este arquivo não parece ser um backup do Axon CRM.' };
    state = migrate(parsed); commit();
    return { ok: true, deals: state.deals.length };
  }
  function reset(withDemo) {
    var keepProfile = state && state.profile;
    state = migrate(AX.data.defaults());
    if (keepProfile) state.profile = Object.assign(state.profile, keepProfile);
    idx = null;
    if (withDemo) AX.data.demo(state);
    commit();
  }
  function snapshot() { return JSON.stringify(state); }
  function restore(snap) { state = migrate(JSON.parse(snap)); commit(); }

  AX.store = {
    get s() { return state; }, load: load, subscribe: subscribe, commit: commit, flush: flush, prefs: prefs, q: q, calcProducts: calcProducts,
    addDeal: addDeal, updateDeal: updateDeal, moveDeal: moveDeal, winDeal: winDeal, loseDeal: loseDeal, reopenDeal: reopenDeal, deleteDeal: deleteDeal, setDealProducts: setDealProducts,
    addPerson: addPerson, updatePerson: updatePerson, deletePerson: deletePerson, addOrg: addOrg, updateOrg: updateOrg, deleteOrg: deleteOrg, findOrgByName: findOrgByName,
    addLead: addLead, importLeads: importLeads, updateLead: updateLead, deleteLead: deleteLead, convertLead: convertLead,
    addActivity: addActivity, updateActivity: updateActivity, toggleActivity: toggleActivity, deleteActivity: deleteActivity,
    addNote: addNote, updateNote: updateNote, deleteNote: deleteNote,
    addProduct: addProduct, updateProduct: updateProduct, deleteProduct: deleteProduct,
    addPipeline: addPipeline, renamePipeline: renamePipeline, deletePipeline: deletePipeline,
    addStage: addStage, updateStage: updateStage, moveStage: moveStage, deleteStage: deleteStage,
    listAdd: listAdd, listUpdate: listUpdate, listRemove: listRemove,
    addUser: addUser, updateUser: updateUser, removeUser: removeUser, setProfile: setProfile,
    exportJSON: exportJSON, importJSON: importJSON, reset: reset, snapshot: snapshot, restore: restore, log: log
  };
  load();
})(window.AX = window.AX || {});
