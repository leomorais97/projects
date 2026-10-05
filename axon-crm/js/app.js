/* Axon CRM — shell da aplicação: rota (hash), navegação, busca global, tema, onboarding */
(function (AX) {
  'use strict';
  var u = AX.u, h = u.h, icon = AX.icon, ui = AX.ui, S = AX.store, q = S.q;
  AX.views = AX.views || {};

  var NAV = [
    { label: 'Vendas' },
    { id: 'pipeline', href: '#/pipeline', icon: 'kanban', text: 'Negócios' },
    { id: 'leads', href: '#/leads', icon: 'inbox', text: 'Leads' },
    { id: 'activities', href: '#/activities', icon: 'calendar-check', text: 'Atividades' },
    { label: 'Cadastros' },
    { id: 'people', href: '#/people', icon: 'users', text: 'Pessoas' },
    { id: 'orgs', href: '#/orgs', icon: 'building', text: 'Organizações' },
    { id: 'products', href: '#/products', icon: 'package', text: 'Produtos', mobileHide: true },
    { label: 'Análise' },
    { id: 'insights', href: '#/insights', icon: 'chart', text: 'Insights' }
  ];
  var NAV_OF = { pipeline: 'pipeline', deal: 'pipeline', leads: 'leads', activities: 'activities', people: 'people', person: 'people', orgs: 'orgs', org: 'orgs', products: 'products', insights: 'insights', settings: 'settings' };
  var TITLES = { pipeline: 'Negócios', deal: 'Negócio', leads: 'Leads', activities: 'Atividades', people: 'Pessoas', person: 'Pessoa', orgs: 'Organizações', org: 'Organização', products: 'Produtos', insights: 'Insights', settings: 'Configurações' };

  var els = {}, current = { name: 'pipeline', arg: null, query: {} }, renderQueued = false;

  /* ---------- tema ----------
     "auto" não escreve data-theme: o CSS segue prefers-color-scheme ou o data-theme que o host (Claude) definir.
     Só uma escolha explícita (botão de tema) grava data-theme. */
  var mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var root$ = document.documentElement;
  function resolvedTheme() {
    var p = S.prefs.get('theme', 'auto');
    if (p !== 'auto') return p;
    return root$.dataset.theme || (mql && mql.matches ? 'dark' : 'light');
  }
  function applyTheme() {
    var p = S.prefs.get('theme', 'auto');
    if (p === 'auto') { if (root$.dataset.axonTheme) { delete root$.dataset.theme; delete root$.dataset.axonTheme; } }
    else { root$.dataset.theme = p; root$.dataset.axonTheme = '1'; }
    var dark = resolvedTheme() === 'dark';
    if (els.themeBtn) { u.clear(els.themeBtn); els.themeBtn.appendChild(icon(dark ? 'sun' : 'moon', 17)); els.themeBtn.setAttribute('aria-label', dark ? 'Usar tema claro' : 'Usar tema escuro'); }
  }
  if (mql && mql.addEventListener) mql.addEventListener('change', function () { applyTheme(); scheduleRender(); });
  // o host pode trocar data-theme a qualquer momento
  if (window.MutationObserver) new MutationObserver(function () { if (S.prefs.get('theme', 'auto') === 'auto') applyTheme(); }).observe(root$, { attributes: true, attributeFilter: ['data-theme'] });
  function toggleTheme() { S.prefs.set('theme', resolvedTheme() === 'dark' ? 'light' : 'dark'); applyTheme(); scheduleRender(); }

  /* ---------- rota ----------
     A rota fica em memória (route) e é espelhada em location.hash quando possível — assim a navegação
     funciona mesmo se o ambiente (iframe do Claude) ignorar mudanças de hash. */
  var route = location.hash || '#/pipeline';
  function parseHash() {
    var raw = route.replace(/^#\/?/, ''), qs = {};
    var qi = raw.indexOf('?');
    if (qi >= 0) { raw.slice(qi + 1).split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) qs[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); }); raw = raw.slice(0, qi); }
    var parts = raw.split('/').filter(Boolean);
    return { name: parts[0] || 'pipeline', arg: parts[1] ? decodeURIComponent(parts[1]) : null, query: qs };
  }
  AX.nav = function (hash) {
    route = hash;
    ui.closePopover();
    try { if (location.hash !== hash) location.hash = hash; } catch (e) { /* ambiente sem hash: segue em memória */ }
    scheduleRender();
  };
  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(function () { renderQueued = false; render(); });
  }
  function captureUi() {
    var scrolls = {}, drafts = {};
    els.view.querySelectorAll('[data-scroll]').forEach(function (e) { scrolls[e.dataset.scroll] = [e.scrollLeft, e.scrollTop]; });
    scrolls.__page = [els.view.scrollLeft, els.view.scrollTop];
    els.view.querySelectorAll('[data-draft]').forEach(function (e) { if (e.value) drafts[e.dataset.draft] = e.value; });
    var ae = document.activeElement;
    var focusKey = ae && ae.dataset && ae.dataset.draft && els.view.contains(ae) ? ae.dataset.draft : null;
    return { scrolls: scrolls, drafts: drafts, focusKey: focusKey };
  }
  function restoreUi(st, sameRoute) {
    els.view.querySelectorAll('[data-draft]').forEach(function (e) {
      if (sameRoute && st.drafts[e.dataset.draft] != null && !e.value) e.value = st.drafts[e.dataset.draft];
      if (sameRoute && st.focusKey === e.dataset.draft) { e.focus(); try { e.setSelectionRange(e.value.length, e.value.length); } catch (x) { /* ignora */ } }
    });
    if (!sameRoute) return;
    els.view.querySelectorAll('[data-scroll]').forEach(function (e) { var s = st.scrolls[e.dataset.scroll]; if (s) { e.scrollLeft = s[0]; e.scrollTop = s[1]; } });
    var pg = st.scrolls.__page; if (pg) { els.view.scrollLeft = pg[0]; els.view.scrollTop = pg[1]; }
  }
  var lastRouteKey = '';
  function render() {
    var r = parseHash();
    var key = r.name + '/' + (r.arg || '');
    var sameRoute = key === lastRouteKey;
    var st = els.view.firstChild ? captureUi() : null;
    var view = AX.views[r.name] || AX.views.pipeline;
    if (!AX.views[r.name]) r = { name: 'pipeline', arg: null, query: {} };
    current = r;
    els.view.className = 'page';
    u.clear(els.view);
    try { view(els.view, { arg: r.arg, query: r.query }); }
    catch (e) {
      console.error(e);
      els.view.appendChild(ui.empty({ icon: 'alert-triangle', title: 'Algo deu errado ao abrir esta tela', text: String(e && e.message || e), action: { label: 'Voltar ao pipeline', onClick: function () { AX.nav('#/pipeline'); } } }));
    }
    if (st) restoreUi(st, sameRoute);
    if (!sameRoute) els.view.scrollTop = 0;
    lastRouteKey = key;
    document.title = (TITLES[r.name] || 'Axon CRM') + ' · Axon CRM';
    updateChrome();
  }

  /* ---------- chrome: sidebar, banner ---------- */
  function badge(n, crit) { return n > 0 ? h('span', { class: 'nav-badge' + (crit ? ' crit' : '') }, n > 99 ? '99+' : n) : null; }
  function updateChrome() {
    var activeNav = NAV_OF[current.name];
    var overdue = S.s.activities.filter(q.isOverdue).length;
    var leads = S.s.leads.filter(function (l) { return !l.archived; }).length;
    u.clear(els.nav);
    NAV.forEach(function (n) {
      if (n.label) { els.nav.appendChild(h('div', { class: 'nav-label' }, n.label)); return; }
      els.nav.appendChild(h('a', { href: n.href, class: 'nav-item' + (activeNav === n.id ? ' active' : '') + (n.mobileHide ? ' hide-mobile' : ''), 'aria-current': activeNav === n.id ? 'page' : null, 'data-tip': n.text },
        icon(n.icon, 19), h('span', { class: 'lbl' }, n.text), n.id === 'leads' ? badge(leads) : n.id === 'activities' ? badge(overdue, true) : null));
    });
    u.clear(els.foot);
    els.foot.appendChild(h('a', { href: '#/settings', class: 'nav-item' + (activeNav === 'settings' ? ' active' : ''), 'data-tip': 'Configurações' }, icon('settings', 19), h('span', { class: 'lbl' }, 'Configurações')));
    var me = q.me();
    els.avatarBtn.firstChild && els.avatarBtn.removeChild(els.avatarBtn.firstChild);
    els.avatarBtn.appendChild(ui.avatar(me, 'lg'));
    updateBanner();
  }
  function updateBanner() {
    u.clear(els.banner);
    var s = S.s;
    var hasData = s.deals.length + s.leads.length + s.persons.length > 0;
    var ref = s.lastBackupAt || s.createdAt;
    var dismissed = S.prefs.get('bannerDismissed', 0);
    if (S.mode === 'cloud' || !hasData || !ref || u.daysSince(ref) < 7 || Date.now() - dismissed < 3 * 864e5) return;
    els.banner.appendChild(h('div', { class: 'banner' }, icon('alert-triangle', 16),
      h('span', null, s.lastBackupAt ? 'Seu último backup foi ' + u.timeAgo(s.lastBackupAt) + '.' : 'Você ainda não fez backup dos seus dados.', ' Eles ficam salvos neste navegador — exporte uma cópia para não perder nada.'),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn sm primary', type: 'button', onclick: AX.exportBackup }, icon('download', 14), 'Exportar backup'),
      h('button', { class: 'btn sm ghost', type: 'button', 'aria-label': 'Dispensar', onclick: function () { S.prefs.set('bannerDismissed', Date.now()); updateBanner(); } }, icon('x', 14))));
  }
  AX.exportBackup = function () {
    u.download('axon-crm-backup-' + u.today() + '.json', S.exportJSON(), 'application/json').then(function (ok) {
      if (!ok) return;
      S.markBackup();
      ui.toast('Backup exportado', { kind: 'success' });
    });
  };

  /* ---------- indicador de sincronização (modo nuvem) ---------- */
  var SYNC_TEXT = { saving: 'Salvando…', saved: 'Salvo na nuvem', error: 'Não salvo — tentar de novo' };
  function drawSync(st, err) {
    if (!els.sync) return;
    u.clear(els.sync);
    if (!SYNC_TEXT[st] || S.mode !== 'cloud') { els.sync.className = 'sync hidden'; return; }
    els.sync.className = 'sync ' + st;
    var tip = st === 'error' ? 'Falha ao salvar' + (err && err.message ? ': ' + err.message : '') + '. Clique para tentar de novo.' : st === 'saved' ? 'Seus dados estão salvos na sua conta do Claude.' : 'Gravando alterações…';
    els.sync.setAttribute('data-tip', tip);
    els.sync.appendChild(icon(st === 'error' ? 'alert-triangle' : st === 'saved' ? 'cloud' : 'refresh', 14, st === 'saving' ? 'spin' : ''));
    els.sync.appendChild(h('span', null, SYNC_TEXT[st]));
  }

  /* ---------- busca global ---------- */
  var searchSel = 0, searchItems = [];
  function runSearch(text) {
    var t = u.norm(text), s = S.s, out = [];
    if (!t) return out;
    var has = function () { return Array.prototype.some.call(arguments, function (x) { return u.norm(x).indexOf(t) >= 0; }); };
    s.deals.filter(function (d) { return has(d.title, q.orgName(d.orgId), q.personName(d.personId)); }).slice(0, 6).forEach(function (d) {
      out.push({ group: 'Negócios', icon: 'dollar', title: d.title, sub: u.money(d.value) + ' · ' + (d.status === 'open' ? (q.stageInfo(d.stageId) || { stage: { name: '' } }).stage.name : d.status === 'won' ? 'Ganho' : 'Perdido'), href: '#/deal/' + d.id });
    });
    s.persons.filter(function (p) { return has(p.name, p.email, p.phone); }).slice(0, 5).forEach(function (p) {
      out.push({ group: 'Pessoas', icon: 'user', title: p.name, sub: [p.role, q.orgName(p.orgId)].filter(Boolean).join(' · '), href: '#/person/' + p.id });
    });
    s.orgs.filter(function (o) { return has(o.name, o.website, o.segment); }).slice(0, 5).forEach(function (o) {
      out.push({ group: 'Organizações', icon: 'building', title: o.name, sub: [o.segment, o.city].filter(Boolean).join(' · '), href: '#/org/' + o.id });
    });
    s.leads.filter(function (l) { return !l.archived && has(l.title, l.orgName, l.personName, l.email); }).slice(0, 4).forEach(function (l) {
      out.push({ group: 'Leads', icon: 'inbox', title: l.title, sub: l.personName, href: '#/leads' });
    });
    return out;
  }
  function closeSearch() { u.clear(els.searchPanel); els.searchPanel.classList.add('hidden'); searchItems = []; }
  function drawSearch() {
    var text = els.searchInput.value;
    if (!text.trim()) { closeSearch(); return; }
    searchItems = runSearch(text);
    u.clear(els.searchPanel);
    els.searchPanel.classList.remove('hidden');
    if (!searchItems.length) { els.searchPanel.appendChild(h('div', { class: 'picker-empty' }, 'Nada encontrado para “' + text + '”')); return; }
    if (searchSel >= searchItems.length) searchSel = 0;
    var lastGroup = '';
    searchItems.forEach(function (it, i) {
      if (it.group !== lastGroup) { els.searchPanel.appendChild(h('div', { class: 'search-group' }, it.group)); lastGroup = it.group; }
      els.searchPanel.appendChild(h('div', { class: 'search-item' + (i === searchSel ? ' sel' : ''), role: 'option', onmousedown: function (e) { e.preventDefault(); openResult(it); } },
        icon(it.icon, 16), h('div', { style: { minWidth: 0 } }, h('div', { class: 'truncate' }, it.title), it.sub ? h('div', { class: 'sub truncate' }, it.sub) : null)));
    });
  }
  function openResult(it) { els.searchInput.value = ''; closeSearch(); els.searchInput.blur(); AX.nav(it.href); }

  /* ---------- novo (+) ---------- */
  function quickAddMenu(anchor) {
    ui.menu(anchor, [
      { label: 'Negócio', icon: 'dollar', onClick: function () { AX.forms.deal({ defaults: ctxDefaults() }); } },
      { label: 'Lead', icon: 'inbox', onClick: function () { AX.forms.lead(); } },
      { label: 'Atividade', icon: 'calendar-check', onClick: function () { AX.forms.activity({ defaults: ctxDefaults() }); } },
      { sep: true },
      { label: 'Pessoa', icon: 'user', onClick: function () { AX.forms.person(); } },
      { label: 'Organização', icon: 'building', onClick: function () { AX.forms.org(); } },
      { sep: true },
      { label: 'Importar leads (CSV)', icon: 'upload', onClick: function () { AX.forms.importLeads(); } }
    ], { align: 'right' });
  }
  function ctxDefaults() {
    if (current.name === 'deal') { var d = q.deal(current.arg); if (d) return { dealId: d.id, personId: d.personId, orgId: d.orgId }; }
    if (current.name === 'person') return { personId: current.arg };
    if (current.name === 'org') return { orgId: current.arg };
    return {};
  }

  /* ---------- onboarding ---------- */
  function onboarding() {
    var name = ui.textInput({ placeholder: 'Como você se chama?', value: q.me().name === 'Eu' ? '' : q.me().name });
    var company = ui.textInput({ value: S.s.profile.company || 'Axon Tech' });
    function finish(demo) {
      var n = name.value.trim();
      if (n) S.updateUser(S.s.currentUser, { name: n });
      S.setProfile({ onboarded: true, company: company.value.trim() || 'Axon Tech' });
      if (demo) S.reset(true);
      AX.nav('#/pipeline');
    }
    var m = ui.modal({
      title: 'Bem-vindo ao Axon CRM', size: 'md',
      content: h('div', null,
        h('p', { class: 'text-2', style: { marginBottom: '16px' } }, 'Seu pipeline de criação de sites, com a lógica que você já conhece: negócios em etapas, atividades, leads, contatos e previsão de receita. Tudo já vem configurado para a Axon Tech — você ajusta o que quiser em Configurações.'),
        h('div', { class: 'form-grid' }, ui.field('Seu nome', name), ui.field('Empresa', company))),
      footer: function () {
        return [
          h('button', { class: 'btn', type: 'button', onclick: function () { finish(true); m.close(); } }, icon('sparkles', 15), 'Explorar com dados de exemplo'),
          h('button', { class: 'btn primary', type: 'button', onclick: function () { finish(false); m.close(); } }, 'Começar do zero')
        ];
      },
      onSubmit: function () { finish(false); },
      onClose: function () { if (!S.s.profile.onboarded) finish(false); }
    });
  }

  /* ---------- montagem ---------- */
  function build() {
    var root = document.getElementById('app');
    els.nav = h('nav', { 'aria-label': 'Principal', style: { display: 'contents' } });
    els.foot = h('div', { class: 'side-foot' });
    els.searchInput = h('input', {
      type: 'search', placeholder: 'Buscar negócios, pessoas, organizações…', 'aria-label': 'Busca global', autocomplete: 'off',
      oninput: function () { searchSel = 0; drawSearch(); },
      onfocus: drawSearch,
      onblur: function () { setTimeout(closeSearch, 120); },
      onkeydown: function (e) {
        if (e.key === 'ArrowDown') { searchSel = Math.min(searchSel + 1, searchItems.length - 1); drawSearch(); e.preventDefault(); }
        else if (e.key === 'ArrowUp') { searchSel = Math.max(searchSel - 1, 0); drawSearch(); e.preventDefault(); }
        else if (e.key === 'Enter' && searchItems[searchSel]) { openResult(searchItems[searchSel]); }
        else if (e.key === 'Escape') { els.searchInput.value = ''; closeSearch(); els.searchInput.blur(); }
      }
    });
    els.searchPanel = h('div', { class: 'search-panel hidden', role: 'listbox' });
    els.themeBtn = h('button', { class: 'btn ghost icon theme-btn', type: 'button', onclick: toggleTheme }, icon('moon', 17));
    els.avatarBtn = h('button', { class: 'btn ghost icon', type: 'button', 'aria-label': 'Conta', style: { borderRadius: '50%' }, onclick: function () {
      ui.menu(els.avatarBtn, [
        { head: q.me().name },
        { label: 'Configurações', icon: 'settings', onClick: function () { AX.nav('#/settings'); } },
        { label: resolvedTheme() === 'dark' ? 'Tema claro' : 'Tema escuro', icon: resolvedTheme() === 'dark' ? 'sun' : 'moon', onClick: toggleTheme },
        { label: 'Exportar backup', icon: 'download', onClick: AX.exportBackup },
        { label: 'Importar leads (CSV)', icon: 'upload', onClick: function () { AX.forms.importLeads(); } }
      ], { align: 'right' });
    } }, h('span'));
    els.banner = h('div');
    els.sync = h('button', { type: 'button', class: 'sync hidden', onclick: function () { if (AX.cloud.status === 'error') AX.cloud.retry(); } });
    els.view = h('main', { class: 'page', id: 'view' });
    var addBtn = h('div', { class: 'btn-split' },
      h('button', { class: 'btn primary', type: 'button', onclick: function () { AX.forms.deal({ defaults: current.name === 'pipeline' ? {} : {} }); } }, icon('plus', 16), 'Negócio'),
      h('button', { class: 'btn primary', type: 'button', 'aria-label': 'Mais opções de criação', onclick: function (e) { quickAddMenu(e.currentTarget); } }, icon('chevron-down', 16)));

    root.appendChild(h('div', { class: 'app' },
      h('aside', { class: 'sidebar' },
        h('div', { class: 'brand' }, h('div', { class: 'brand-mark' }, icon('logo', 20)), h('div', { class: 'brand-name' }, 'Axon', h('small', null, 'CRM · Axon Tech'))),
        els.nav, els.foot),
      h('div', { class: 'main' },
        els.banner,
        h('header', { class: 'topbar' },
          h('div', { class: 'search' }, icon('search', 16, 'ic-lead'), els.searchInput, h('kbd', null, '/'), els.searchPanel),
          h('span', { class: 'spacer' }), els.sync, addBtn, els.themeBtn, els.avatarBtn),
        els.view)));
  }

  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    var typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
    if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); els.searchInput.focus(); }
    else if (e.key === 'n' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && !document.querySelector('.modal-backdrop')) { e.preventDefault(); AX.forms.deal({}); }
  });

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#/"]');
    if (!a || e.defaultPrevented || e.button || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    AX.nav(a.getAttribute('href'));
  });

  AX.rerender = scheduleRender;
  AX.current = function () { return current; };

  function boot() {
    build();
    applyTheme();
    window.addEventListener('hashchange', function () { if (location.hash && location.hash !== route) { route = location.hash; ui.closePopover(); scheduleRender(); } });
    // enquanto a nuvem responde mostra uma tela de carregamento (no navegador comum isso é instantâneo)
    if (u.hasHost()) els.view.appendChild(ui.empty({ icon: 'cloud', title: 'Carregando seus dados…', text: 'Conectando ao armazenamento seguro da sua conta.' }));
    AX.ready.then(function (mode) {
      S.subscribe(scheduleRender);
      AX.cloud.onStatus(drawSync);
      if (mode === 'browser-fallback') ui.toast('Não consegui acessar a nuvem agora; usando o armazenamento deste navegador.', { kind: 'error', duration: 7000 });
      render();
      if (!S.s.profile.onboarded) onboarding();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.AX = window.AX || {});
