/* Axon CRM — Negócios: Kanban com drag & drop e visão em lista */
(function (AX) {
  'use strict';
  var u = AX.u, h = u.h, icon = AX.icon, ui = AX.ui, S = AX.store, q = S.q;
  var boardText = '';
  var listSort = { key: 'created', dir: 'desc' };

  function stageColor(i, n) { return 'var(--ord-' + (Math.round(i * 4 / Math.max(n - 1, 1)) + 1) + ')'; }

  function actIndicator(d) {
    var st = q.actState(d.id), a = q.nextAct(d.id), cls, ic, tip;
    if (st === 'overdue') { var od = q.openActs(d.id).filter(q.isOverdue)[0]; cls = 'late'; ic = 'alert-circle'; tip = 'Atrasada: ' + od.subject + ' (' + u.relDay(od.dueDate) + ')'; }
    else if (st === 'scheduled') { cls = 'ok'; ic = 'calendar-check'; tip = 'Próxima: ' + a.subject + ' — ' + u.relDay(a.dueDate) + (a.dueTime ? ' ' + a.dueTime : ''); }
    else { cls = 'none'; ic = 'alert-triangle'; tip = 'Sem atividade agendada — clique para agendar'; }
    return h('button', {
      type: 'button', class: 'act-ind ' + cls, 'data-tip': tip, 'aria-label': tip,
      onclick: function (e) { e.stopPropagation(); AX.forms.activity({ defaults: { dealId: d.id } }); },
      draggable: 'false'
    }, icon(ic, 14));
  }

  function dealCard(d, ctx) {
    var org = q.org(d.orgId), person = q.person(d.personId), label = q.label(d.labelId), owner = q.user(d.ownerId);
    var rot = q.isRotting(d);
    var card = h('div', {
      class: 'deal-card' + (rot ? ' rotting' : ''), draggable: 'true', tabindex: 0, role: 'button', dataset: { id: d.id },
      'aria-label': d.title + ', ' + u.money(d.value),
      onclick: function () { location.hash = '#/deal/' + d.id; },
      onkeydown: function (e) {
        if (e.key === 'Enter') { location.hash = '#/deal/' + d.id; }
        else if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
          e.preventDefault();
          var si = q.stageInfo(d.stageId), ni = si.index + (e.key === 'ArrowRight' ? 1 : -1), tgt = si.pipeline.stages[ni];
          if (tgt) { S.moveDeal(d.id, tgt.id, null); setTimeout(function () { var el = document.querySelector('.deal-card[data-id="' + d.id + '"]'); if (el) el.focus(); }, 60); }
        }
      }
    },
      h('div', { class: 'deal-title' }, d.title),
      h('div', { class: 'deal-sub' }, org ? h('span', { class: 'truncate' }, icon('building', 12), ' ', org.name) : null, person ? h('span', { class: 'truncate' }, icon('user', 12), ' ', person.name) : null),
      h('div', { class: 'deal-foot' },
        h('span', { class: 'deal-value' }, u.money(d.value), d.mrr ? h('small', null, ' +' + u.money(d.mrr) + '/mês') : null),
        h('span', { class: 'spacer' }),
        rot ? h('span', { class: 'rot', 'data-tip': 'Parado há ' + q.daysInStage(d) + ' dias nesta etapa' }, icon('clock', 13), q.daysInStage(d) + 'd') : null,
        label ? h('span', { class: 'label-dot', style: { background: label.color }, 'data-tip': label.name, 'aria-label': 'Etiqueta ' + label.name }) : null,
        owner && S.s.users.length > 1 ? ui.avatar(owner) : null,
        actIndicator(d)));
    card.addEventListener('dragstart', function (e) {
      ctx.dragId = d.id; e.dataTransfer.setData('text/plain', d.id); e.dataTransfer.effectAllowed = 'move';
      setTimeout(function () { card.classList.add('dragging'); ctx.zones.classList.add('show'); }, 0);
    });
    card.addEventListener('dragend', function () { ctx.dragId = null; card.classList.remove('dragging'); ctx.zones.classList.remove('show'); clearIndicators(ctx); });
    return card;
  }

  function clearIndicators(ctx) {
    if (ctx.line) { ctx.line.remove(); ctx.line = null; }
    ctx.board.querySelectorAll('.col.over, .dropzone.over').forEach(function (c) { c.classList.remove('over'); });
  }
  function insertIndex(body, y) {
    var cards = Array.prototype.slice.call(body.querySelectorAll('.deal-card:not(.dragging)'));
    var idx = 0;
    cards.forEach(function (c) { var r = c.getBoundingClientRect(); if (y > r.top + r.height / 2) idx++; });
    return { idx: idx, cards: cards };
  }

  function column(st, i, n, deals, ctx) {
    var total = u.sum(deals, function (d) { return Number(d.value) || 0; });
    var body = h('div', { class: 'col-body', dataset: { stage: st.id, scroll: 'col-' + st.id } });
    deals.forEach(function (d) { body.appendChild(dealCard(d, ctx)); });
    if (!deals.length) body.appendChild(h('div', { class: 'col-empty' }, 'Arraste negócios para cá'));
    var col = h('section', { class: 'col', 'aria-label': st.name },
      h('div', { class: 'col-bar', style: { background: stageColor(i, n) } }),
      h('header', { class: 'col-head' },
        h('div', { class: 'col-title' }, h('span', { class: 'truncate' }, st.name), h('span', { class: 'col-count' }, deals.length)),
        h('div', { class: 'col-sum' }, u.money(total, { compact: true }), h('span', { class: 'muted' }, ' · ' + st.prob + '%')),
        h('button', { class: 'btn ghost icon sm col-add', type: 'button', 'aria-label': 'Novo negócio em ' + st.name, 'data-tip': 'Novo negócio nesta etapa', onclick: function () { AX.forms.deal({ defaults: { pipelineId: ctx.pl.id, stageId: st.id } }); } }, icon('plus', 16))),
      body);
    body.addEventListener('dragover', function (e) {
      if (!ctx.dragId) return;
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      col.classList.add('over');
      var r = insertIndex(body, e.clientY);
      if (!ctx.line) ctx.line = h('div', { class: 'drop-line' });
      var empty = body.querySelector('.col-empty'); if (empty) empty.classList.add('hidden');
      if (r.cards[r.idx]) body.insertBefore(ctx.line, r.cards[r.idx]); else body.appendChild(ctx.line);
    });
    body.addEventListener('dragleave', function (e) {
      if (!col.contains(e.relatedTarget)) { col.classList.remove('over'); if (ctx.line) { ctx.line.remove(); ctx.line = null; } var empty = body.querySelector('.col-empty'); if (empty) empty.classList.remove('hidden'); }
    });
    body.addEventListener('drop', function (e) {
      e.preventDefault();
      var id = ctx.dragId; if (!id) return;
      var r = insertIndex(body, e.clientY), d = q.deal(id);
      var sibs = deals.filter(function (x) { return x.id !== id; });
      var prev = sibs[r.idx - 1], next = sibs[r.idx];
      var order = prev && next ? (prev.order + next.order) / 2 : prev ? prev.order + 1 : next ? next.order - 1 : 0;
      clearIndicators(ctx); ctx.zones.classList.remove('show');
      if (d.stageId !== st.id) ui.withUndo('“' + d.title + '” movido para ' + st.name, function () { S.moveDeal(id, st.id, order); });
      else S.moveDeal(id, st.id, order);
    });
    return col;
  }

  function dropZones(ctx) {
    function zone(kind, ic, label) {
      var z = h('div', { class: 'dropzone ' + kind }, icon(ic, 18), label);
      z.addEventListener('dragover', function (e) { if (!ctx.dragId) return; e.preventDefault(); z.classList.add('over'); });
      z.addEventListener('dragleave', function () { z.classList.remove('over'); });
      z.addEventListener('drop', function (e) {
        e.preventDefault(); z.classList.remove('over');
        var d = q.deal(ctx.dragId); ctx.dragId = null; ctx.zones.classList.remove('show'); if (!d) return;
        if (kind === 'won') AX.forms.win(d);
        else if (kind === 'lost') AX.forms.lost(d);
        else ui.confirm({ title: 'Excluir negócio', message: 'Excluir “' + d.title + '” e suas atividades e notas?', confirmText: 'Excluir', danger: true }).then(function (ok) { if (ok) ui.withUndo('Negócio excluído', function () { S.deleteDeal(d.id); }); });
      });
      return z;
    }
    ctx.zones = h('div', { class: 'dropzones' }, zone('won', 'trophy', 'Ganho'), zone('lost', 'thumbs-down', 'Perdido'), zone('del', 'trash', 'Excluir'));
    return ctx.zones;
  }

  /* ---------- lista ---------- */
  function listView(pl, deals) {
    var status = S.prefs.get('listStatus', 'open');
    var rows = deals.filter(function (d) { return status === 'all' || d.status === status; });
    var getters = {
      title: function (d) { return d.title; }, org: function (d) { return q.orgName(d.orgId); }, person: function (d) { return q.personName(d.personId); },
      value: function (d) { return Number(d.value) || 0; }, stage: function (d) { var si = q.stageInfo(d.stageId); return si ? si.index : 0; },
      close: function (d) { return d.expectedClose || ''; }, next: function (d) { var a = q.nextAct(d.id); return a ? a.dueDate : ''; },
      owner: function (d) { return (q.user(d.ownerId) || {}).name; }, created: function (d) { return d.createdAt; }
    };
    rows = ui.sortRows(rows, listSort, getters);
    var cols = [
      { key: 'title', label: 'Negócio', sortable: true, cls: 'wrap', render: function (d) { return h('a', { href: '#/deal/' + d.id, class: 'cell-title' }, d.title); } },
      { key: 'org', label: 'Organização', sortable: true, render: function (d) { var o = q.org(d.orgId); return o ? h('a', { href: '#/org/' + o.id }, o.name) : '—'; } },
      { key: 'person', label: 'Pessoa', sortable: true, render: function (d) { var p = q.person(d.personId); return p ? h('a', { href: '#/person/' + p.id }, p.name) : '—'; } },
      { key: 'value', label: 'Valor', sortable: true, cls: 'num', render: function (d) { return h('span', null, u.money(d.value), d.mrr ? h('div', { class: 'cell-sub' }, '+' + u.money(d.mrr) + '/mês') : null); } },
      { key: 'stage', label: 'Etapa', sortable: true, render: function (d) { return ui.dealStatusBadge(d); } },
      { key: 'close', label: 'Fechamento', sortable: true, render: function (d) { return d.expectedClose ? u.fmtDate(d.expectedClose) : '—'; } },
      { key: 'next', label: 'Próx. atividade', sortable: true, render: function (d) {
        var a = q.nextAct(d.id); if (d.status !== 'open') return '—';
        if (!a) return h('span', { class: 'badge warn' }, icon('alert-triangle', 12), 'Sem atividade');
        return h('span', { class: 'cell-flex' }, ui.actIcon(a.type, 15), h('span', { class: q.isOverdue(a) ? 'late-text' : '' }, u.relDay(a.dueDate)));
      } },
      { key: 'owner', label: 'Resp.', sortable: true, render: function (d) { return ui.avatar(q.user(d.ownerId)); } },
      { key: 'created', label: 'Criado em', sortable: true, render: function (d) { return u.fmtDate(d.createdAt); } }
    ];
    return h('div', { class: 'list-scroll', dataset: { scroll: 'list' } }, ui.dataTable({
      columns: cols, rows: rows, sort: listSort, tableClass: 'nowrap',
      onSort: function (k) { listSort = ui.nextSort(listSort, k); AX.rerender(); },
      onRow: function (d) { location.hash = '#/deal/' + d.id; },
      empty: ui.empty({ icon: 'dollar', title: 'Nenhum negócio aqui', text: 'Ajuste os filtros ou crie um novo negócio.' })
    }));
  }

  AX.views.pipeline = function (root) {
    root.classList.add('fill');
    var s = S.s;
    var pl = q.pipeline(S.prefs.get('pipelineId')) || s.pipelines[0];
    var mode = S.prefs.get('boardView', 'kanban');
    var fOwner = S.prefs.get('fOwner', 'all'), fLabel = S.prefs.get('fLabel', 'all');
    var t = u.norm(boardText);
    function matches(d) {
      if (fOwner !== 'all' && d.ownerId !== fOwner) return false;
      if (fLabel !== 'all' && (d.labelId || 'none') !== fLabel) return false;
      if (t && u.norm(d.title + ' ' + q.orgName(d.orgId) + ' ' + q.personName(d.personId)).indexOf(t) < 0) return false;
      return true;
    }
    var inPl = s.deals.filter(function (d) { return d.pipelineId === pl.id && matches(d); });
    var open = inPl.filter(function (d) { return d.status === 'open'; });
    var total = u.sum(open, function (d) { return Number(d.value) || 0; });
    var weighted = u.sum(open, q.weighted);
    var mrr = u.sum(open, function (d) { return Number(d.mrr) || 0; });

    var plBtn = h('button', { class: 'btn', type: 'button', onclick: function (e) {
      var items = s.pipelines.map(function (p) { return { label: p.name, selected: p.id === pl.id, onClick: function () { S.prefs.set('pipelineId', p.id); AX.rerender(); } }; });
      items.push({ sep: true }, { label: 'Gerenciar pipelines', icon: 'settings', onClick: function () { location.hash = '#/settings/pipelines'; } });
      ui.menu(e.currentTarget, items);
    } }, icon('kanban', 16), pl.name, icon('chevron-down', 14));

    var search = h('input', { class: 'input sm', type: 'search', placeholder: 'Filtrar negócios…', 'aria-label': 'Filtrar negócios', style: { width: '170px' }, dataset: { draft: 'board-text' }, value: boardText,
      oninput: u.debounce(function (e) { boardText = e.target.value; AX.rerender(); }, 200) });
    var ownerSel = s.users.length > 1 ? ui.select([{ value: 'all', label: 'Todos os responsáveis' }].concat(s.users.map(function (x) { return { value: x.id, label: x.name }; })), fOwner, { class: 'select sm auto', 'aria-label': 'Responsável' }) : null;
    if (ownerSel) ownerSel.addEventListener('change', function () { S.prefs.set('fOwner', ownerSel.value); AX.rerender(); });
    var labelSel = ui.select([{ value: 'all', label: 'Todas as etiquetas' }].concat(s.lists.labels.map(function (x) { return { value: x.id, label: x.name }; }), [{ value: 'none', label: 'Sem etiqueta' }]), fLabel, { class: 'select sm auto', 'aria-label': 'Etiqueta' });
    labelSel.addEventListener('change', function () { S.prefs.set('fLabel', labelSel.value); AX.rerender(); });

    var head = h('div', { class: 'board-head' },
      h('div', { class: 'toolbar' }, plBtn,
        h('div', { class: 'summary' }, h('strong', null, u.money(total, { compact: true })), h('span', { class: 'muted' }, ' · ' + open.length + (open.length === 1 ? ' negócio' : ' negócios') + ' · previsão ' + u.money(weighted, { compact: true }) + (mrr ? ' · MRR ' + u.money(mrr, { compact: true }) : '')))),
      h('span', { class: 'spacer' }),
      h('div', { class: 'toolbar' }, search, ownerSel, labelSel,
        ui.segmented([{ value: 'kanban', label: 'Kanban', icon: 'kanban' }, { value: 'list', label: 'Lista', icon: 'list' }], mode, function (v) { S.prefs.set('boardView', v); AX.rerender(); })));
    root.appendChild(head);

    if (!s.deals.length) {
      root.appendChild(h('div', { class: 'callout' },
        h('div', null, h('strong', null, 'Seu pipeline está vazio.'), h('div', { class: 'text-2' }, 'Crie o primeiro negócio, importe uma lista de leads (ex.: exportação do Apollo) ou carregue dados de exemplo para explorar.')),
        h('div', { class: 'toolbar' },
          h('button', { class: 'btn primary', type: 'button', onclick: function () { AX.forms.deal({}); } }, icon('plus', 15), 'Criar negócio'),
          h('button', { class: 'btn', type: 'button', onclick: function () { AX.forms.importLeads(); } }, icon('upload', 15), 'Importar leads'),
          h('button', { class: 'btn', type: 'button', onclick: function () { S.reset(true); ui.toast('Dados de exemplo carregados', { kind: 'success' }); } }, icon('sparkles', 15), 'Dados de exemplo'))));
    }

    if (mode === 'list') {
      var status = S.prefs.get('listStatus', 'open');
      root.appendChild(h('div', { class: 'toolbar', style: { marginBottom: '10px' } },
        ui.segmented([{ value: 'open', label: 'Abertos' }, { value: 'won', label: 'Ganhos' }, { value: 'lost', label: 'Perdidos' }, { value: 'all', label: 'Todos' }], status, function (v) { S.prefs.set('listStatus', v); AX.rerender(); })));
      root.appendChild(listView(pl, inPl));
      return;
    }

    var ctx = { pl: pl, dragId: null, line: null, zones: null, board: null };
    var board = h('div', { class: 'board', dataset: { scroll: 'board' } });
    ctx.board = board;
    var zones = dropZones(ctx);
    pl.stages.forEach(function (st, i) {
      var ds = open.filter(function (d) { return d.stageId === st.id; }).sort(function (a, b) { return a.order - b.order; });
      board.appendChild(column(st, i, pl.stages.length, ds, ctx));
    });
    root.appendChild(board);
    root.appendChild(zones);
  };
})(window.AX = window.AX || {});
