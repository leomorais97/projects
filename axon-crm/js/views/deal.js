/* Axon CRM — página do negócio (estilo Pipedrive): barra de etapas, resumo, foco, notas, atividades e produtos */
(function (AX) {
  'use strict';
  var u = AX.u, h = u.h, icon = AX.icon, ui = AX.ui, S = AX.store, q = S.q;
  var dealTab = 'focus', composeMode = 'note', inlineType = 'call', lastDeal = null;

  function stageDays(d) {
    var out = {}, hist = d.history || [], end = new Date(d.wonAt || d.lostAt || Date.now()).getTime();
    hist.forEach(function (e, i) {
      var start = new Date(e.at).getTime(), stop = i + 1 < hist.length ? new Date(hist[i + 1].at).getTime() : end;
      out[e.stageId] = (out[e.stageId] || 0) + Math.max(0, stop - start);
    });
    return out;
  }

  function stageBar(d) {
    var pl = q.pipeline(d.pipelineId), cur = q.stageInfo(d.stageId).index, days = stageDays(d);
    var closed = d.status !== 'open';
    return h('div', { class: 'stagebar' + (closed ? ' closed ' + d.status : ''), role: 'group', 'aria-label': 'Etapas do negócio' }, pl.stages.map(function (st, i) {
      var visited = days[st.id] != null, n = visited ? Math.floor(days[st.id] / 864e5) : null;
      var state = closed ? (d.status === 'won' ? 'done' : (i <= cur ? 'lostdone' : '')) : (i < cur ? 'done' : i === cur ? 'current' : '');
      var rot = !closed && i === cur && q.isRotting(d);
      return h('button', {
        type: 'button', class: 'stg ' + state + (rot ? ' rot' : ''), 'aria-current': !closed && i === cur ? 'step' : null, disabled: closed,
        'data-tip': st.name + ' · ' + st.prob + '% de probabilidade' + (visited ? ' · ' + (n === 0 ? 'menos de 1 dia' : n + ' dia(s)') + ' aqui' : ''),
        onclick: function () { if (i !== cur) ui.withUndo('Movido para “' + st.name + '”', function () { S.moveDeal(d.id, st.id); }); }
      }, h('span', { class: 'stg-name' }, st.name), h('span', { class: 'stg-days' }, visited ? (n === 0 ? '<1d' : n + 'd') : ' '));
    }));
  }

  function kv(label, node) { return h('div', { class: 'kv' }, h('div', { class: 'kv-k' }, label), h('div', { class: 'kv-v' }, node)); }

  function changeLink(d, kind) {
    var isPerson = kind === 'person';
    var p;
    var api = ui.modal({
      title: isPerson ? 'Pessoa de contato' : 'Organização', size: 'sm',
      content: (p = isPerson
        ? ui.picker({ placeholder: 'Buscar ou criar pessoa…', value: d.personId, items: function () { return S.s.persons.map(function (x) { return { id: x.id, label: x.name, sub: q.orgName(x.orgId) }; }); }, onCreate: function (n) { return S.addPerson({ name: n, orgId: d.orgId }).id; } })
        : ui.picker({ placeholder: 'Buscar ou criar organização…', value: d.orgId, items: function () { return S.s.orgs.map(function (x) { return { id: x.id, label: x.name, sub: x.city || x.segment }; }); }, onCreate: function (n) { return S.addOrg({ name: n }).id; } })),
      submitText: 'Salvar',
      onSubmit: function () {
        var patch = isPerson ? { personId: p.value } : { orgId: p.value };
        if (isPerson && p.value && !d.orgId) { var pp = q.person(p.value); if (pp && pp.orgId) patch.orgId = pp.orgId; }
        S.updateDeal(d.id, patch);
      }
    });
    return api;
  }

  /* ---------- barra lateral ---------- */
  function summaryCard(d) {
    var si = q.stageInfo(d.stageId), locked = d.products && d.products.length, rot = q.isRotting(d);
    var save = function (patch) { return function (v) { var o = {}; o[patch] = v; S.updateDeal(d.id, o); }; };
    var userOpts = S.s.users.map(function (x) { return { value: x.id, label: x.name }; });
    function selOpts(list, blank) { return [{ value: '', label: blank }].concat(S.s.lists[list].map(function (x) { return { value: x.id, label: x.name }; })); }
    var closeLate = d.status === 'open' && d.expectedClose && d.expectedClose < u.today();
    return h('div', { class: 'card' },
      h('div', { class: 'card-head' }, 'Resumo'),
      h('div', { class: 'card-pad kvs' },
        kv('Valor do projeto', locked ? h('div', { class: 'editable-static' }, u.money(d.value, { cents: true }), h('div', { class: 'cell-sub' }, 'Calculado pelos produtos'))
          : ui.editable({ value: d.value, kind: 'money', label: 'valor', placeholder: 'R$ 0', display: function (v) { return v ? u.money(v, { cents: true }) : null; }, onSave: save('value') })),
        kv('Recorrência mensal', locked ? h('div', { class: 'editable-static' }, d.mrr ? u.money(d.mrr, { cents: true }) + '/mês' : '—')
          : ui.editable({ value: d.mrr, kind: 'money', label: 'recorrência', placeholder: 'Sem recorrência', display: function (v) { return v ? u.money(v, { cents: true }) + '/mês' : null; }, onSave: save('mrr') })),
        kv('Probabilidade', h('div', { class: 'editable-static' }, d.status === 'won' ? '100%' : d.status === 'lost' ? '0%' : si.stage.prob + '%', d.status === 'open' ? h('span', { class: 'muted' }, ' · ponderado ' + u.money(q.weighted(d))) : null)),
        kv('Fechamento previsto', ui.editable({ value: d.expectedClose, kind: 'date', label: 'fechamento previsto', placeholder: 'Definir data',
          display: function (v) { return v ? h('span', { class: closeLate ? 'late-text' : '' }, u.fmtDate(v), closeLate ? ' (atrasado)' : '') : null; }, onSave: save('expectedClose') })),
        kv('Responsável', ui.editable({ value: d.ownerId, kind: 'select', options: userOpts, label: 'responsável', display: function (v) { var x = q.user(v); return x ? h('span', { class: 'cell-flex' }, ui.avatar(x), x.name) : null; }, onSave: save('ownerId') })),
        kv('Etiqueta', ui.editable({ value: d.labelId || '', kind: 'select', options: selOpts('labels', 'Sem etiqueta'), label: 'etiqueta', placeholder: 'Sem etiqueta', display: function (v) { return ui.labelChip(q.label(v)); }, onSave: function (v) { S.updateDeal(d.id, { labelId: v || null }); } })),
        kv('Origem', ui.editable({ value: d.sourceId || '', kind: 'select', options: selOpts('sources', 'Selecione…'), label: 'origem', placeholder: 'Definir origem', display: function (v) { var x = q.source(v); return x ? x.name : null; }, onSave: function (v) { S.updateDeal(d.id, { sourceId: v || null }); } })),
        kv('Tipo de projeto', ui.editable({ value: d.projectTypeId || '', kind: 'select', options: selOpts('projectTypes', 'Selecione…'), label: 'tipo de projeto', placeholder: 'Definir tipo', display: function (v) { var x = q.projectType(v); return x ? x.name : null; }, onSave: function (v) { S.updateDeal(d.id, { projectTypeId: v || null }); } })),
        kv('Site atual', ui.editable({ value: d.siteUrl, kind: 'text', label: 'site', placeholder: 'https://…', display: function (v) { var href = u.safeUrl(v); return v ? (href ? h('a', { href: href, target: '_blank', rel: 'noopener' }, u.hostname(v), ' ', icon('external', 12)) : v) : null; }, onSave: save('siteUrl') })),
        h('div', { class: 'kv-sep' }),
        kv('Criado em', h('div', { class: 'editable-static' }, u.fmtDate(d.createdAt) + ' · ' + u.daysSince(d.createdAt) + ' dias')),
        d.status === 'open' ? kv('Nesta etapa há', h('div', { class: 'editable-static' }, h('span', { class: rot ? 'late-text' : '' }, q.daysInStage(d) + ' dia(s)'), si.stage.rot ? h('span', { class: 'muted' }, ' · limite ' + si.stage.rot + 'd') : null)) : null,
        d.status === 'won' ? kv('Ganho em', h('div', { class: 'editable-static' }, u.fmtDate(d.wonAt))) : null,
        d.status === 'lost' ? kv('Perdido em', h('div', { class: 'editable-static' }, u.fmtDate(d.lostAt))) : null,
        d.status === 'lost' ? kv('Motivo', h('div', { class: 'editable-static' }, (q.lostReason(d.lostReasonId) || { name: '—' }).name, d.lostNote ? h('div', { class: 'cell-sub' }, d.lostNote) : null)) : null));
  }

  function personCard(d) {
    var p = q.person(d.personId);
    return h('div', { class: 'card' },
      h('div', { class: 'card-head' }, 'Pessoa', h('span', { class: 'spacer' }), h('button', { class: 'link-btn', type: 'button', onclick: function () { changeLink(d, 'person'); } }, p ? 'Alterar' : 'Adicionar')),
      h('div', { class: 'card-pad' }, p ? h('div', null,
        h('div', { class: 'cell-flex' }, ui.personAvatar(p, 'lg'), h('div', { style: { minWidth: 0 } }, h('a', { href: '#/person/' + p.id, class: 'cell-title' }, p.name), p.role ? h('div', { class: 'cell-sub' }, p.role) : null)),
        h('div', { class: 'contact-bits' }, AX.parts.contactBits(p)))
        : h('p', { class: 'muted' }, 'Nenhuma pessoa vinculada. Adicione o decisor para registrar contatos e atividades.')));
  }
  function orgCard(d) {
    var o = q.org(d.orgId);
    return h('div', { class: 'card' },
      h('div', { class: 'card-head' }, 'Organização', h('span', { class: 'spacer' }), h('button', { class: 'link-btn', type: 'button', onclick: function () { changeLink(d, 'org'); } }, o ? 'Alterar' : 'Adicionar')),
      h('div', { class: 'card-pad' }, o ? h('div', null,
        h('div', { class: 'cell-flex' }, ui.orgAvatar(o.name, 'lg'), h('div', { style: { minWidth: 0 } }, h('a', { href: '#/org/' + o.id, class: 'cell-title' }, o.name), h('div', { class: 'cell-sub' }, [o.segment, o.city].filter(Boolean).join(' · ')))),
        h('div', { class: 'contact-bits' },
          o.website && u.safeUrl(o.website) ? h('a', { class: 'contact-bit', href: u.safeUrl(o.website), target: '_blank', rel: 'noopener' }, icon('globe', 14), u.hostname(o.website)) : null,
          o.phone ? h('a', { class: 'contact-bit', href: 'tel:' + o.phone.replace(/[^\d+]/g, '') }, icon('phone', 14), o.phone) : null))
        : h('p', { class: 'muted' }, 'Nenhuma organização vinculada.')));
  }

  /* ---------- compositor (nota / atividade) ---------- */
  function composer(d, onlyNote) {
    var mode = onlyNote ? 'note' : composeMode;
    var card = h('div', { class: 'card composer' });
    if (!onlyNote) card.appendChild(h('div', { class: 'composer-tabs' }, ui.segmented([{ value: 'note', label: 'Nota', icon: 'file-text' }, { value: 'activity', label: 'Atividade', icon: 'calendar-check' }], mode, function (v) { composeMode = v; AX.rerender(); })));
    if (mode === 'note') {
      var ta = h('textarea', { class: 'textarea', rows: 3, placeholder: 'Escreva uma nota: contexto do cliente, objeções, próximos passos…', dataset: { draft: 'note-' + d.id }, 'aria-label': 'Nova nota' });
      var save = function () { var t = ta.value.trim(); if (!t) { ta.focus(); return; } S.addNote({ content: t, dealId: d.id }); ta.value = ''; ui.toast('Nota salva', { kind: 'success' }); };
      ta.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') save(); });
      card.appendChild(h('div', { class: 'card-pad' }, ta, h('div', { class: 'toolbar', style: { justifyContent: 'space-between', marginTop: '8px' } }, h('span', { class: 'muted', style: { fontSize: '12px' } }, 'Ctrl/⌘ + Enter para salvar'), h('button', { class: 'btn primary sm', type: 'button', onclick: save }, 'Salvar nota'))));
    } else {
      var subject = h('input', { class: 'input', type: 'text', placeholder: q.actType(inlineType).name + ' — assunto', dataset: { draft: 'act-subject-' + d.id }, 'aria-label': 'Assunto' });
      var date = h('input', { class: 'input', type: 'date', value: u.addDays(u.today(), 1), 'aria-label': 'Data' });
      var time = h('input', { class: 'input', type: 'time', 'aria-label': 'Horário', style: { width: '120px' } });
      var add = function () { S.addActivity({ type: inlineType, subject: subject.value, dueDate: date.value || u.today(), dueTime: time.value, dealId: d.id, duration: inlineType === 'meeting' ? 45 : 0 }); subject.value = ''; ui.toast('Atividade agendada', { kind: 'success' }); };
      subject.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); add(); } });
      card.appendChild(h('div', { class: 'card-pad' },
        h('div', { class: 'type-chips', style: { marginBottom: '10px' } }, AX.ACTIVITY_TYPES.map(function (t) {
          return h('button', { type: 'button', class: 'type-chip' + (t.id === inlineType ? ' on' : ''), onclick: function () { inlineType = t.id; AX.rerender(); } }, icon(t.icon, 15), t.name);
        })),
        h('div', { class: 'inline-form' }, subject, date, time, h('button', { class: 'btn primary', type: 'button', onclick: add }, 'Agendar')),
        h('div', { class: 'toolbar', style: { marginTop: '8px' } }, h('button', { class: 'link-btn', type: 'button', onclick: function () { AX.forms.activity({ defaults: { dealId: d.id, type: inlineType } }); } }, 'Mais opções…'))));
    }
    return card;
  }

  /* ---------- abas ---------- */
  function focusTab(d) {
    var wrap = h('div', { class: 'stack' }, composer(d));
    var planned = q.openActs(d.id);
    wrap.appendChild(h('div', { class: 'card' },
      h('div', { class: 'card-head' }, icon('calendar-check', 16), 'Planejado', h('span', { class: 'count-pill' }, planned.length)),
      planned.length ? h('div', { class: 'act-list' }, planned.map(function (a) { return AX.parts.activityRow(a, { showPerson: true }); }))
        : h('div', { class: 'card-pad' }, d.status === 'open'
          ? h('div', { class: 'warn-note' }, icon('alert-triangle', 16), h('div', null, h('strong', null, 'Nenhuma atividade planejada.'), h('div', null, 'Negócios sem próxima ação esfriam. Agende o próximo contato acima.')))
          : h('p', { class: 'muted' }, 'Nenhuma atividade pendente.'))));
    var pinned = q.dealNotes(d.id).filter(function (n) { return n.pinned; });
    if (pinned.length) wrap.appendChild(h('div', { class: 'card' }, h('div', { class: 'card-head' }, icon('pin', 16), 'Notas fixadas'), h('div', { class: 'card-pad stack-sm' }, pinned.map(function (n) { return AX.parts.noteItem(n); }))));
    var feed = AX.parts.dealFeed(d).filter(function (it) { return !(it.kind === 'note' && it.note.pinned); });
    wrap.appendChild(h('div', { class: 'card' }, h('div', { class: 'card-head' }, icon('clock', 16), 'Histórico'), h('div', { class: 'card-pad' }, AX.parts.feedView(feed))));
    return wrap;
  }
  function notesTab(d) {
    var notes = q.dealNotes(d.id).slice().sort(function (a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (a.createdAt < b.createdAt ? 1 : -1); });
    return h('div', { class: 'stack' }, composer(d, true), notes.length ? h('div', { class: 'stack-sm' }, notes.map(function (n) { return AX.parts.noteItem(n); })) : ui.empty({ icon: 'file-text', title: 'Sem notas', text: 'Registre o contexto do cliente, objeções e combinados.' }));
  }
  function actsTab(d) {
    var all = q.dealActs(d.id), todo = all.filter(function (a) { return !a.done; }).sort(function (a, b) { return (a.dueDate + (a.dueTime || '')) < (b.dueDate + (b.dueTime || '')) ? -1 : 1; });
    var done = all.filter(function (a) { return a.done; }).sort(function (a, b) { return (b.doneAt || '') < (a.doneAt || '') ? -1 : 1; });
    return h('div', { class: 'stack' },
      h('div', { class: 'toolbar' }, h('button', { class: 'btn primary', type: 'button', onclick: function () { AX.forms.activity({ defaults: { dealId: d.id } }); } }, icon('plus', 15), 'Atividade')),
      h('div', { class: 'card' }, h('div', { class: 'card-head' }, 'A fazer', h('span', { class: 'count-pill' }, todo.length)), todo.length ? h('div', { class: 'act-list' }, todo.map(function (a) { return AX.parts.activityRow(a); })) : h('div', { class: 'card-pad muted' }, 'Nada pendente.')),
      h('div', { class: 'card' }, h('div', { class: 'card-head' }, 'Concluídas', h('span', { class: 'count-pill' }, done.length)), done.length ? h('div', { class: 'act-list' }, done.map(function (a) { return AX.parts.activityRow(a); })) : h('div', { class: 'card-pad muted' }, 'Nenhuma atividade concluída.')));
  }
  function productsTab(d) {
    var lines = (d.products || []).map(function (l) { return Object.assign({}, l); });
    var totals = S.calcProducts(lines);
    function commit(next, quiet) { S.setDealProducts(d.id, next, quiet); }
    var catalog = S.s.products.filter(function (p) { return p.active; });
    var pick = ui.select([{ value: '', label: 'Adicionar produto do catálogo…' }].concat(catalog.map(function (p) { return { value: p.id, label: p.name + ' — ' + u.money(p.price) + (p.billing === 'monthly' ? '/mês' : '') }; })), '', { class: 'select auto', style: { minWidth: '280px' }, 'aria-label': 'Adicionar produto' });
    pick.addEventListener('change', function () {
      var p = q.product(pick.value); if (!p) return;
      commit(lines.concat([{ id: u.uid('dp'), productId: p.id, name: p.name, price: p.price, qty: 1, discount: 0, billing: p.billing }]));
    });
    function numInput(l, key, o) {
      var inp = h('input', { class: 'input sm', type: 'number', min: o.min, max: o.max, step: o.step || 1, value: l[key], style: { width: o.w }, 'aria-label': o.label });
      inp.addEventListener('change', function () { l[key] = Math.max(o.min, Math.min(o.max || 1e9, Number(inp.value) || 0)); commit(lines, true); });
      return inp;
    }
    var body = lines.map(function (l, i) {
      var name = h('input', { class: 'input sm', type: 'text', value: l.name, 'aria-label': 'Nome do item' });
      name.addEventListener('change', function () { l.name = name.value.trim() || l.name; commit(lines, true); });
      var price = ui.moneyInput(l.price, { class: 'input sm', 'aria-label': 'Preço' });
      price.input.addEventListener('change', function () { l.price = price.get(); commit(lines, true); });
      var bill = ui.select([{ value: 'once', label: 'Único' }, { value: 'monthly', label: 'Mensal' }], l.billing, { class: 'select sm auto', 'aria-label': 'Cobrança' });
      bill.addEventListener('change', function () { l.billing = bill.value; commit(lines, true); });
      var tot = (Number(l.price) || 0) * (Number(l.qty) || 0) * (1 - (Number(l.discount) || 0) / 100);
      return h('tr', null,
        h('td', { style: { minWidth: '260px' } }, name), h('td', null, bill), h('td', { style: { minWidth: '150px' } }, price),
        h('td', null, numInput(l, 'qty', { min: 1, w: '70px', label: 'Quantidade' })), h('td', null, numInput(l, 'discount', { min: 0, max: 100, w: '76px', label: 'Desconto %' })),
        h('td', { class: 'num nowrap' }, u.money(tot, { cents: true }) + (l.billing === 'monthly' ? '/mês' : '')),
        h('td', null, h('button', { class: 'btn ghost icon sm', type: 'button', 'aria-label': 'Remover item', onclick: function () { commit(lines.filter(function (_, j) { return j !== i; })); } }, icon('trash', 15))));
    });
    return h('div', { class: 'stack' },
      h('div', { class: 'toolbar' }, pick, h('button', { class: 'btn', type: 'button', onclick: function () { commit(lines.concat([{ id: u.uid('dp'), productId: null, name: 'Item avulso', price: 0, qty: 1, discount: 0, billing: 'once' }])); } }, icon('plus', 15), 'Item avulso')),
      lines.length ? h('div', { class: 'card' }, h('div', { class: 'table-wrap flat' }, h('table', { class: 'table' },
        h('thead', null, h('tr', null, ['Produto', 'Cobrança', 'Preço unit.', 'Qtd', 'Desc. %', 'Total', ''].map(function (c, i) { return h('th', { class: i === 5 ? 'num' : '' }, c); }))), h('tbody', null, body))),
        h('div', { class: 'totals' }, h('div', null, h('span', { class: 'muted' }, 'Projeto (único)'), h('strong', null, u.money(totals.once, { cents: true }))), h('div', null, h('span', { class: 'muted' }, 'Recorrência (MRR)'), h('strong', null, u.money(totals.monthly, { cents: true }) + '/mês'))))
        : ui.empty({ icon: 'package', title: 'Nenhum produto neste negócio', text: 'Adicione itens do catálogo para calcular automaticamente o valor do projeto e a recorrência mensal.' }),
      lines.length ? h('p', { class: 'muted' }, 'O valor do negócio e a recorrência mensal são calculados a partir destes itens.') : null);
  }

  /* ---------- página ---------- */
  AX.views.deal = function (root, params) {
    var d = q.deal(params.arg);
    if (!d) { root.appendChild(ui.empty({ icon: 'search', title: 'Negócio não encontrado', text: 'Ele pode ter sido excluído.', action: { label: 'Voltar ao pipeline', onClick: function () { AX.nav('#/pipeline'); } } })); return; }
    if (lastDeal !== d.id) { dealTab = 'focus'; composeMode = 'note'; lastDeal = d.id; }
    var org = q.org(d.orgId), person = q.person(d.personId), rot = q.isRotting(d);

    var menuBtn = h('button', { class: 'btn icon', type: 'button', 'aria-label': 'Mais ações', onclick: function (e) {
      ui.menu(e.currentTarget, [
        { label: 'Editar negócio', icon: 'pencil', onClick: function () { AX.forms.deal({ deal: d }); } },
        { label: 'Duplicar', icon: 'copy', onClick: function () {
          var c = S.addDeal({ title: d.title + ' (cópia)', value: d.value, mrr: d.mrr, pipelineId: d.pipelineId, orgId: d.orgId, personId: d.personId, ownerId: d.ownerId, labelId: d.labelId, sourceId: d.sourceId, projectTypeId: d.projectTypeId, siteUrl: d.siteUrl, expectedClose: d.expectedClose });
          if (d.products.length) S.setDealProducts(c.id, d.products.map(function (l) { return Object.assign({}, l, { id: u.uid('dp') }); }), true);
          ui.toast('Negócio duplicado', { kind: 'success' }); AX.nav('#/deal/' + c.id);
        } },
        { sep: true },
        { label: 'Excluir negócio', icon: 'trash', danger: true, onClick: function () {
          ui.confirm({ title: 'Excluir negócio', message: 'Excluir “' + d.title + '” e todas as suas atividades e notas?', confirmText: 'Excluir', danger: true }).then(function (ok) {
            if (ok) { ui.withUndo('Negócio excluído', function () { S.deleteDeal(d.id); }); AX.nav('#/pipeline'); }
          });
        } }
      ], { align: 'right' });
    } }, icon('more', 18));

    var actions = d.status === 'open' ? [
      h('button', { class: 'btn success', type: 'button', onclick: function () { AX.forms.win(d); } }, icon('trophy', 15), 'Ganho'),
      h('button', { class: 'btn danger', type: 'button', onclick: function () { AX.forms.lost(d); } }, icon('thumbs-down', 15), 'Perdido'),
      menuBtn
    ] : [
      ui.dealStatusBadge(d),
      h('button', { class: 'btn', type: 'button', onclick: function () { S.reopenDeal(d.id); ui.toast('Negócio reaberto', { kind: 'success' }); } }, icon('undo', 15), 'Reabrir'),
      menuBtn
    ];

    root.appendChild(h('div', { class: 'deal-page' },
      h('a', { href: '#/pipeline', class: 'back' }, icon('chevron-left', 16), 'Negócios'),
      h('div', { class: 'deal-titlebar' },
        h('div', { class: 'deal-titleblock' },
          ui.editable({ value: d.title, label: 'título', display: function (v) { return h('h1', { class: 'deal-h1' }, v); }, onSave: function (v) { if (v) S.updateDeal(d.id, { title: v }); } }),
          h('div', { class: 'deal-chips' },
            d.status === 'open' ? h('span', { class: 'badge accent' }, q.stageInfo(d.stageId).stage.name) : null,
            rot ? h('span', { class: 'badge crit' }, icon('clock', 12), 'Parado há ' + q.daysInStage(d) + ' dias') : null,
            org ? h('a', { class: 'chip', href: '#/org/' + org.id }, icon('building', 12), org.name) : null,
            person ? h('a', { class: 'chip', href: '#/person/' + person.id }, icon('user', 12), person.name) : null,
            ui.labelChip(q.label(d.labelId)))),
        h('div', { class: 'deal-actions' }, actions)),
      d.status === 'won' ? h('div', { class: 'closed-banner won' }, icon('trophy', 16), h('span', null, 'Negócio ganho em ' + u.fmtDate(d.wonAt) + ' · ' + u.money(d.value) + (d.mrr ? ' + ' + u.money(d.mrr) + '/mês' : ''))) : null,
      d.status === 'lost' ? h('div', { class: 'closed-banner lost' }, icon('thumbs-down', 16), h('span', null, 'Negócio perdido em ' + u.fmtDate(d.lostAt) + ' · ' + (q.lostReason(d.lostReasonId) || { name: 'sem motivo' }).name)) : null,
      stageBar(d),
      h('div', { class: 'deal-grid' },
        h('div', { class: 'stack' }, summaryCard(d), personCard(d), orgCard(d)),
        h('div', { class: 'deal-main' },
          ui.tabs([
            { id: 'focus', label: 'Foco' },
            { id: 'notes', label: 'Notas', count: q.dealNotes(d.id).length },
            { id: 'acts', label: 'Atividades', count: q.dealActs(d.id).length },
            { id: 'products', label: 'Produtos', count: (d.products || []).length }
          ], dealTab, function (t) { dealTab = t; AX.rerender(); }),
          dealTab === 'focus' ? focusTab(d) : dealTab === 'notes' ? notesTab(d) : dealTab === 'acts' ? actsTab(d) : productsTab(d)))));
  };
})(window.AX = window.AX || {});
