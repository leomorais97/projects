/* Axon CRM — Pessoas e Organizações (listas e páginas de detalhe) */
(function (AX) {
  'use strict';
  var u = AX.u, h = u.h, icon = AX.icon, ui = AX.ui, S = AX.store, q = S.q;
  var pSort = { key: 'name', dir: 'asc' }, oSort = { key: 'name', dir: 'asc' }, pText = '', oText = '';
  var tab = 'deals', lastKey = '';

  function openDealsBy(field) {
    var m = u.groupBy(S.s.deals.filter(function (d) { return d.status === 'open' && d[field]; }), function (d) { return d[field]; });
    return m;
  }
  function dealsCell(list) {
    if (!list || !list.length) return h('span', { class: 'muted' }, '—');
    return h('span', null, list.length + ' · ' + u.money(u.sum(list, function (d) { return Number(d.value) || 0; }), { compact: true }));
  }
  function searchBox(value, onInput, key, ph) {
    return h('input', { class: 'input sm', type: 'search', placeholder: ph, 'aria-label': ph, value: value, style: { width: '240px' }, dataset: { draft: key }, oninput: u.debounce(function (e) { onInput(e.target.value); AX.rerender(); }, 200) });
  }

  /* ---------- listas ---------- */
  AX.views.people = function (root) {
    var t = u.norm(pText), deals = openDealsBy('personId');
    var rows = S.s.persons.filter(function (p) { return !t || u.norm([p.name, p.email, p.phone, p.role, q.orgName(p.orgId)].join(' ')).indexOf(t) >= 0; });
    rows = ui.sortRows(rows, pSort, {
      name: function (p) { return p.name; }, org: function (p) { return q.orgName(p.orgId); }, email: function (p) { return p.email; },
      deals: function (p) { return (deals.get(p.id) || []).length; }, owner: function (p) { return (q.user(p.ownerId) || {}).name; }
    });
    var cols = [
      { key: 'name', label: 'Nome', sortable: true, render: function (p) { return h('div', { class: 'cell-flex' }, ui.personAvatar(p), h('div', { style: { minWidth: 0 } }, h('a', { href: '#/person/' + p.id, class: 'cell-title' }, p.name), p.role ? h('div', { class: 'cell-sub' }, p.role) : null)); } },
      { key: 'org', label: 'Organização', sortable: true, render: function (p) { var o = q.org(p.orgId); return o ? h('a', { href: '#/org/' + o.id }, o.name) : '—'; } },
      { key: 'email', label: 'E-mail', sortable: true, render: function (p) { return p.email ? h('a', { href: 'mailto:' + p.email }, p.email) : '—'; } },
      { key: 'phone', label: 'Telefone', render: function (p) { return p.phone || '—'; } },
      { key: 'deals', label: 'Negócios abertos', sortable: true, render: function (p) { return dealsCell(deals.get(p.id)); } },
      { key: 'owner', label: 'Resp.', sortable: true, render: function (p) { return ui.avatar(q.user(p.ownerId)); } }
    ];
    root.appendChild(h('div', { class: 'page-narrow' },
      h('div', { class: 'page-head' }, h('div', null, h('h1', { class: 'page-title' }, 'Pessoas'), h('div', { class: 'page-sub' }, S.s.persons.length + ' contato(s)')), h('span', { class: 'spacer' }),
        searchBox(pText, function (v) { pText = v; }, 'people-text', 'Buscar pessoas…'),
        h('button', { class: 'btn primary', type: 'button', onclick: function () { AX.forms.person({}); } }, icon('plus', 15), 'Pessoa')),
      ui.dataTable({ columns: cols, rows: rows, sort: pSort, onSort: function (k) { pSort = ui.nextSort(pSort, k); AX.rerender(); },
        empty: ui.empty({ icon: 'users', title: S.s.persons.length ? 'Nenhuma pessoa encontrada' : 'Nenhuma pessoa cadastrada', text: 'Pessoas são criadas ao converter leads ou ao cadastrar negócios.', action: S.s.persons.length ? null : { label: 'Nova pessoa', icon: 'plus', onClick: function () { AX.forms.person({}); } } }) })));
  };

  AX.views.orgs = function (root) {
    var t = u.norm(oText), deals = openDealsBy('orgId'), people = u.groupBy(S.s.persons.filter(function (p) { return p.orgId; }), function (p) { return p.orgId; });
    var rows = S.s.orgs.filter(function (o) { return !t || u.norm([o.name, o.segment, o.city, o.website].join(' ')).indexOf(t) >= 0; });
    rows = ui.sortRows(rows, oSort, {
      name: function (o) { return o.name; }, segment: function (o) { return o.segment; }, city: function (o) { return o.city; },
      people: function (o) { return (people.get(o.id) || []).length; }, deals: function (o) { return (deals.get(o.id) || []).length; }, owner: function (o) { return (q.user(o.ownerId) || {}).name; }
    });
    var cols = [
      { key: 'name', label: 'Organização', sortable: true, render: function (o) { return h('div', { class: 'cell-flex' }, ui.orgAvatar(o.name), h('div', { style: { minWidth: 0 } }, h('a', { href: '#/org/' + o.id, class: 'cell-title' }, o.name), o.website ? h('div', { class: 'cell-sub' }, u.hostname(o.website)) : null)); } },
      { key: 'segment', label: 'Segmento', sortable: true, render: function (o) { return o.segment || '—'; } },
      { key: 'city', label: 'Cidade', sortable: true, render: function (o) { return o.city || '—'; } },
      { key: 'people', label: 'Pessoas', sortable: true, cls: 'num', render: function (o) { return (people.get(o.id) || []).length; } },
      { key: 'deals', label: 'Negócios abertos', sortable: true, render: function (o) { return dealsCell(deals.get(o.id)); } },
      { key: 'owner', label: 'Resp.', sortable: true, render: function (o) { return ui.avatar(q.user(o.ownerId)); } }
    ];
    root.appendChild(h('div', { class: 'page-narrow' },
      h('div', { class: 'page-head' }, h('div', null, h('h1', { class: 'page-title' }, 'Organizações'), h('div', { class: 'page-sub' }, S.s.orgs.length + ' empresa(s)')), h('span', { class: 'spacer' }),
        searchBox(oText, function (v) { oText = v; }, 'orgs-text', 'Buscar organizações…'),
        h('button', { class: 'btn primary', type: 'button', onclick: function () { AX.forms.org({}); } }, icon('plus', 15), 'Organização')),
      ui.dataTable({ columns: cols, rows: rows, sort: oSort, onSort: function (k) { oSort = ui.nextSort(oSort, k); AX.rerender(); },
        empty: ui.empty({ icon: 'building', title: S.s.orgs.length ? 'Nenhuma organização encontrada' : 'Nenhuma organização cadastrada', text: 'Organizações são criadas ao converter leads ou ao cadastrar negócios.', action: S.s.orgs.length ? null : { label: 'Nova organização', icon: 'plus', onClick: function () { AX.forms.org({}); } } }) })));
  };

  /* ---------- detalhe (abas compartilhadas) ---------- */
  function entityTabs(kind, id, deals, acts, notes, defaults) {
    var ta = h('textarea', { class: 'textarea', rows: 3, placeholder: 'Escreva uma nota…', dataset: { draft: 'ent-note-' + id }, 'aria-label': 'Nova nota' });
    var content;
    if (tab === 'deals') {
      content = h('div', { class: 'stack' },
        h('div', { class: 'toolbar' }, h('button', { class: 'btn primary', type: 'button', onclick: function () { AX.forms.deal({ defaults: defaults }); } }, icon('plus', 15), 'Negócio')),
        deals.length ? h('div', { class: 'card' }, deals.map(function (d) { return AX.parts.dealMini(d); })) : ui.empty({ icon: 'dollar', title: 'Nenhum negócio', text: 'Crie um negócio para este contato.' }));
    } else if (tab === 'acts') {
      var todo = acts.filter(function (a) { return !a.done; }).sort(function (a, b) { return a.dueDate < b.dueDate ? -1 : 1; }), done = acts.filter(function (a) { return a.done; }).sort(function (a, b) { return (b.doneAt || '') < (a.doneAt || '') ? -1 : 1; });
      content = h('div', { class: 'stack' },
        h('div', { class: 'toolbar' }, h('button', { class: 'btn primary', type: 'button', onclick: function () { AX.forms.activity({ defaults: defaults }); } }, icon('plus', 15), 'Atividade')),
        acts.length ? h('div', { class: 'card' }, todo.concat(done).map(function (a) { return AX.parts.activityRow(a, { showDeal: true, showPerson: kind === 'org' }); })) : ui.empty({ icon: 'calendar-check', title: 'Nenhuma atividade' }));
    } else {
      var save = function () {
        var t = ta.value.trim(); if (!t) { ta.focus(); return; }
        var f = { content: t }; f[kind === 'person' ? 'personId' : 'orgId'] = id; S.addNote(f); ta.value = ''; ui.toast('Nota salva', { kind: 'success' });
      };
      content = h('div', { class: 'stack' },
        h('div', { class: 'card card-pad' }, ta, h('div', { class: 'toolbar', style: { justifyContent: 'flex-end', marginTop: '8px' } }, h('button', { class: 'btn primary sm', type: 'button', onclick: save }, 'Salvar nota'))),
        notes.length ? h('div', { class: 'stack-sm' }, notes.map(function (n) { return AX.parts.noteItem(n, { showDeal: true }); })) : ui.empty({ icon: 'file-text', title: 'Sem notas' }));
    }
    return h('div', { class: 'deal-main' },
      ui.tabs([{ id: 'deals', label: 'Negócios', count: deals.length }, { id: 'acts', label: 'Atividades', count: acts.length }, { id: 'notes', label: 'Notas', count: notes.length }], tab, function (v) { tab = v; AX.rerender(); }),
      content);
  }
  function sortedNotes(notes) { return notes.slice().sort(function (a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (a.createdAt < b.createdAt ? 1 : -1); }); }
  function fieldRow(label, node) { return h('div', { class: 'kv' }, h('div', { class: 'kv-k' }, label), h('div', { class: 'kv-v' }, node)); }
  function textField(label, value, ph, onSave, display) {
    return fieldRow(label, ui.editable({ value: value, label: label, placeholder: ph, display: display, onSave: onSave }));
  }

  AX.views.person = function (root, params) {
    var p = q.person(params.arg);
    if (!p) { root.appendChild(ui.empty({ icon: 'search', title: 'Pessoa não encontrada', action: { label: 'Voltar', onClick: function () { location.hash = '#/people'; } } })); return; }
    if (lastKey !== 'p' + p.id) { tab = 'deals'; lastKey = 'p' + p.id; }
    var org = q.org(p.orgId);
    var deals = S.s.deals.filter(function (d) { return d.personId === p.id; }).sort(function (a, b) { return a.status === b.status ? 0 : a.status === 'open' ? -1 : 1; });
    var acts = S.s.activities.filter(function (a) { return a.personId === p.id; });
    var notes = sortedNotes(S.s.notes.filter(function (n) { return n.personId === p.id; }));
    var save = function (k) { return function (v) { var o = {}; o[k] = v; S.updatePerson(p.id, o); }; };
    var orgPick;
    root.appendChild(h('div', { class: 'deal-page' },
      h('a', { href: '#/people', class: 'back' }, icon('chevron-left', 16), 'Pessoas'),
      h('div', { class: 'deal-titlebar' },
        h('div', { class: 'cell-flex', style: { flex: 1, minWidth: '260px', gap: '14px' } }, ui.personAvatar(p, 'xl'),
          h('div', { style: { minWidth: 0 } }, ui.editable({ value: p.name, label: 'nome', display: function (v) { return h('h1', { class: 'deal-h1' }, v); }, onSave: function (v) { if (v) S.updatePerson(p.id, { name: v }); } }),
            h('div', { class: 'deal-chips' }, p.role ? h('span', { class: 'muted' }, p.role) : null, org ? h('a', { class: 'chip', href: '#/org/' + org.id }, icon('building', 12), org.name) : null))),
        h('div', { class: 'deal-actions' },
          h('button', { class: 'btn', type: 'button', onclick: function () { AX.forms.activity({ defaults: { personId: p.id, orgId: p.orgId } }); } }, icon('calendar-check', 15), 'Atividade'),
          h('button', { class: 'btn primary', type: 'button', onclick: function () { AX.forms.deal({ defaults: { personId: p.id, orgId: p.orgId } }); } }, icon('plus', 15), 'Negócio'),
          h('button', { class: 'btn icon', type: 'button', 'aria-label': 'Mais ações', onclick: function (e) {
            ui.menu(e.currentTarget, [
              { label: 'Editar pessoa', icon: 'pencil', onClick: function () { AX.forms.person({ person: p }); } },
              { sep: true },
              { label: 'Excluir pessoa', icon: 'trash', danger: true, onClick: function () {
                ui.confirm({ title: 'Excluir pessoa', message: 'Excluir “' + p.name + '”? Os negócios vinculados permanecem, sem contato.', confirmText: 'Excluir', danger: true }).then(function (ok) { if (ok) { ui.withUndo('Pessoa excluída', function () { S.deletePerson(p.id); }); location.hash = '#/people'; } });
              } }
            ], { align: 'right' });
          } }, icon('more', 18)))),
      h('div', { class: 'deal-grid' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('div', { class: 'card-head' }, 'Detalhes'), h('div', { class: 'card-pad kvs' },
            textField('Cargo', p.role, 'Adicionar cargo', save('role')),
            textField('E-mail', p.email, 'Adicionar e-mail', save('email'), function (v) { return v ? (/^[^\s@]+@[^\s@]+$/.test(v) ? h('a', { href: 'mailto:' + v }, v) : v) : null; }),
            textField('Telefone', p.phone, 'Adicionar telefone', save('phone'), function (v) { var wa = u.waLink(v); return v ? h('span', null, v, wa ? h('a', { href: wa, target: '_blank', rel: 'noopener', style: { marginLeft: '8px' }, 'data-tip': 'Abrir no WhatsApp' }, icon('message', 13)) : null) : null; }),
            textField('LinkedIn', p.linkedin, 'linkedin.com/in/…', save('linkedin'), function (v) { var href = u.safeUrl(v); return v ? (href ? h('a', { href: href, target: '_blank', rel: 'noopener' }, href.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), ' ', icon('external', 12)) : v) : null; }),
            fieldRow('Responsável', ui.editable({ value: p.ownerId, kind: 'select', label: 'responsável', options: S.s.users.map(function (x) { return { value: x.id, label: x.name }; }), display: function (v) { var x = q.user(v); return x ? h('span', { class: 'cell-flex' }, ui.avatar(x), x.name) : null; }, onSave: save('ownerId') })),
            )),
          h('div', { class: 'card' }, h('div', { class: 'card-head' }, 'Organização', h('span', { class: 'spacer' }), h('button', { class: 'link-btn', type: 'button', onclick: function () {
            ui.modal({ title: 'Organização', size: 'sm', content: (orgPick = ui.picker({ value: p.orgId, placeholder: 'Buscar ou criar organização…', items: function () { return S.s.orgs.map(function (x) { return { id: x.id, label: x.name, sub: x.city }; }); }, onCreate: function (n) { return S.addOrg({ name: n }).id; } })), onSubmit: function () { S.updatePerson(p.id, { orgId: orgPick.value }); } });
          } }, org ? 'Alterar' : 'Adicionar')),
            h('div', { class: 'card-pad' }, org ? h('div', { class: 'cell-flex' }, ui.orgAvatar(org.name, 'lg'), h('div', null, h('a', { href: '#/org/' + org.id, class: 'cell-title' }, org.name), h('div', { class: 'cell-sub' }, [org.segment, org.city].filter(Boolean).join(' · ')))) : h('p', { class: 'muted' }, 'Sem organização.')))),
        entityTabs('person', p.id, deals, acts, notes, { personId: p.id, orgId: p.orgId }))));
  };

  AX.views.org = function (root, params) {
    var o = q.org(params.arg);
    if (!o) { root.appendChild(ui.empty({ icon: 'search', title: 'Organização não encontrada', action: { label: 'Voltar', onClick: function () { location.hash = '#/orgs'; } } })); return; }
    if (lastKey !== 'o' + o.id) { tab = 'deals'; lastKey = 'o' + o.id; }
    var people = S.s.persons.filter(function (p) { return p.orgId === o.id; });
    var deals = S.s.deals.filter(function (d) { return d.orgId === o.id; }).sort(function (a, b) { return a.status === b.status ? 0 : a.status === 'open' ? -1 : 1; });
    var acts = S.s.activities.filter(function (a) { return a.orgId === o.id; });
    var notes = sortedNotes(S.s.notes.filter(function (n) { return n.orgId === o.id; }));
    var save = function (k) { return function (v) { var x = {}; x[k] = v; S.updateOrg(o.id, x); }; };
    root.appendChild(h('div', { class: 'deal-page' },
      h('a', { href: '#/orgs', class: 'back' }, icon('chevron-left', 16), 'Organizações'),
      h('div', { class: 'deal-titlebar' },
        h('div', { class: 'cell-flex', style: { flex: 1, minWidth: '260px', gap: '14px' } }, ui.orgAvatar(o.name, 'xl'),
          h('div', { style: { minWidth: 0 } }, ui.editable({ value: o.name, label: 'nome', display: function (v) { return h('h1', { class: 'deal-h1' }, v); }, onSave: function (v) { if (v) S.updateOrg(o.id, { name: v }); } }),
            h('div', { class: 'deal-chips' }, o.segment ? h('span', { class: 'muted' }, o.segment) : null, o.city ? h('span', { class: 'muted' }, '· ' + o.city) : null))),
        h('div', { class: 'deal-actions' },
          h('button', { class: 'btn', type: 'button', onclick: function () { AX.forms.activity({ defaults: { orgId: o.id } }); } }, icon('calendar-check', 15), 'Atividade'),
          h('button', { class: 'btn primary', type: 'button', onclick: function () { AX.forms.deal({ defaults: { orgId: o.id } }); } }, icon('plus', 15), 'Negócio'),
          h('button', { class: 'btn icon', type: 'button', 'aria-label': 'Mais ações', onclick: function (e) {
            ui.menu(e.currentTarget, [
              { label: 'Editar organização', icon: 'pencil', onClick: function () { AX.forms.org({ org: o }); } },
              { sep: true },
              { label: 'Excluir organização', icon: 'trash', danger: true, onClick: function () {
                ui.confirm({ title: 'Excluir organização', message: 'Excluir “' + o.name + '”? Pessoas e negócios vinculados permanecem, sem organização.', confirmText: 'Excluir', danger: true }).then(function (ok) { if (ok) { ui.withUndo('Organização excluída', function () { S.deleteOrg(o.id); }); location.hash = '#/orgs'; } });
              } }
            ], { align: 'right' });
          } }, icon('more', 18)))),
      h('div', { class: 'deal-grid' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' }, h('div', { class: 'card-head' }, 'Detalhes'), h('div', { class: 'card-pad kvs' },
            textField('Site', o.website, 'empresa.com.br', save('website'), function (v) { var href = u.safeUrl(v); return v ? (href ? h('a', { href: href, target: '_blank', rel: 'noopener' }, u.hostname(v), ' ', icon('external', 12)) : v) : null; }),
            textField('Segmento', o.segment, 'Adicionar segmento', save('segment')),
            textField('Cidade', o.city, 'Cidade, UF', save('city')),
            textField('Telefone', o.phone, 'Adicionar telefone', save('phone')),
            textField('CNPJ', o.cnpj, '00.000.000/0000-00', save('cnpj')),
            fieldRow('Responsável', ui.editable({ value: o.ownerId, kind: 'select', label: 'responsável', options: S.s.users.map(function (x) { return { value: x.id, label: x.name }; }), display: function (v) { var x = q.user(v); return x ? h('span', { class: 'cell-flex' }, ui.avatar(x), x.name) : null; }, onSave: save('ownerId') })))),
          h('div', { class: 'card' }, h('div', { class: 'card-head' }, 'Pessoas', h('span', { class: 'count-pill' }, people.length), h('span', { class: 'spacer' }), h('button', { class: 'link-btn', type: 'button', onclick: function () { AX.forms.person({ defaults: { orgId: o.id } }); } }, 'Adicionar')),
            people.length ? h('div', null, people.map(function (p) { return h('a', { class: 'deal-mini', href: '#/person/' + p.id }, h('div', { class: 'cell-flex' }, ui.personAvatar(p), h('div', null, h('div', { class: 'cell-title' }, p.name), p.role ? h('div', { class: 'cell-sub' }, p.role) : null))); })) : h('div', { class: 'card-pad muted' }, 'Nenhuma pessoa cadastrada.'))),
        entityTabs('org', o.id, deals, acts, notes, { orgId: o.id }))));
  };
})(window.AX = window.AX || {});
