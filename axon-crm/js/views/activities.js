/* Axon CRM — Atividades: lista agrupada por prazo e calendário mensal */
(function (AX) {
  'use strict';
  var u = AX.u, h = u.h, icon = AX.icon, ui = AX.ui, S = AX.store, q = S.q;
  var mode = 'list', status = 'todo', typeFilter = 'all', ownerFilter = 'all', calMonth = u.today().slice(0, 7);

  function filtered() {
    return S.s.activities.filter(function (a) {
      if (typeFilter !== 'all' && a.type !== typeFilter) return false;
      if (ownerFilter !== 'all' && a.ownerId !== ownerFilter) return false;
      return true;
    });
  }

  function group(acts) {
    var t = u.today(), tomorrow = u.addDays(t, 1), weekEnd = u.addDays(t, 7);
    var g = { late: [], today: [], tomorrow: [], week: [], later: [], none: [] };
    acts.forEach(function (a) {
      if (!a.dueDate) g.none.push(a);
      else if (q.isOverdue(a)) g.late.push(a);
      else if (a.dueDate === t) g.today.push(a);
      else if (a.dueDate === tomorrow) g.tomorrow.push(a);
      else if (a.dueDate <= weekEnd) g.week.push(a);
      else g.later.push(a);
    });
    return g;
  }
  function sortByDue(a, b) { return (a.dueDate + (a.dueTime || '99')) < (b.dueDate + (b.dueTime || '99')) ? -1 : 1; }

  function section(title, acts, tone) {
    if (!acts.length) return null;
    return h('div', { class: 'card', style: { marginBottom: '14px' } },
      h('div', { class: 'card-head' }, tone === 'late' ? icon('alert-circle', 16) : null, h('span', { class: tone === 'late' ? 'late-text' : '' }, title), h('span', { class: 'count-pill' }, acts.length)),
      h('div', { class: 'act-list' }, acts.slice().sort(sortByDue).map(function (a) { return AX.parts.activityRow(a, { showDeal: true }); })));
  }

  function listView(acts) {
    if (status === 'done') {
      var done = acts.filter(function (a) { return a.done; }).sort(function (a, b) { return (b.doneAt || '') < (a.doneAt || '') ? -1 : 1; }).slice(0, 200);
      return done.length ? h('div', { class: 'card' }, h('div', { class: 'card-head' }, 'Concluídas', h('span', { class: 'count-pill' }, done.length)), h('div', { class: 'act-list' }, done.map(function (a) { return AX.parts.activityRow(a, { showDeal: true }); })))
        : ui.empty({ icon: 'check-square', title: 'Nenhuma atividade concluída', text: 'As atividades que você concluir aparecem aqui.' });
    }
    var open = acts.filter(function (a) { return status === 'all' ? true : !a.done; });
    if (status === 'all') open = open.filter(function (a) { return !a.done; });
    if (!open.length) {
      return ui.empty({ icon: 'calendar-check', title: 'Tudo em dia!', text: 'Nenhuma atividade pendente. Agende o próximo contato dos seus negócios para manter o ritmo.', action: { label: 'Nova atividade', icon: 'plus', onClick: function () { AX.forms.activity({}); } } });
    }
    var g = group(open);
    return h('div', null,
      section('Atrasadas', g.late, 'late'), section('Hoje', g.today), section('Amanhã', g.tomorrow),
      section('Próximos 7 dias', g.week), section('Mais tarde', g.later), section('Sem data', g.none));
  }

  /* ---------- calendário mensal ---------- */
  function calendarView(acts) {
    var parts = calMonth.split('-').map(Number), year = parts[0], month = parts[1] - 1;
    var first = new Date(year, month, 1), startDow = first.getDay(), days = new Date(year, month + 1, 0).getDate();
    var byDay = u.groupBy(acts, function (a) { return a.dueDate; });
    var t = u.today();
    var cells = [];
    for (var i = 0; i < startDow; i++) cells.push(h('div', { class: 'cal-cell empty' }));
    var MAX = 3;
    for (var d = 1; d <= days; d++) {
      (function (d) {
        var key = year + '-' + u.pad(month + 1) + '-' + u.pad(d);
        var list = (byDay.get(key) || []).slice().sort(sortByDue);
        cells.push(h('div', { class: 'cal-cell' + (key === t ? ' today' : ''), tabindex: 0, role: 'button', 'aria-label': 'Dia ' + d + ': ' + list.length + ' atividades',
          onclick: function (e) { if (e.target.closest('.cal-chip')) return; AX.forms.activity({ defaults: { dueDate: key } }); },
          onkeydown: function (e) { if (e.key === 'Enter' && e.target === e.currentTarget) AX.forms.activity({ defaults: { dueDate: key } }); } },
          h('div', { class: 'cal-day' }, d),
          list.slice(0, MAX).map(function (a) {
            return h('button', { type: 'button', class: 'cal-chip' + (a.done ? ' done' : '') + (q.isOverdue(a) ? ' late' : ''), 'data-tip': (a.dueTime ? a.dueTime + ' · ' : '') + a.subject,
              onclick: function () { AX.forms.activity({ activity: a }); } }, ui.actIcon(a.type, 12), h('span', { class: 'truncate' }, (a.dueTime ? a.dueTime + ' ' : '') + a.subject));
          }),
          list.length > MAX ? h('div', { class: 'cal-more' }, '+' + (list.length - MAX) + ' mais') : null));
      })(d);
    }
    var prev = new Date(year, month - 1, 1), next = new Date(year, month + 1, 1);
    var key = function (dt) { return dt.getFullYear() + '-' + u.pad(dt.getMonth() + 1); };
    return h('div', null,
      h('div', { class: 'toolbar', style: { marginBottom: '10px' } },
        h('button', { class: 'btn icon', type: 'button', 'aria-label': 'Mês anterior', onclick: function () { calMonth = key(prev); AX.rerender(); } }, icon('chevron-left', 16)),
        h('button', { class: 'btn icon', type: 'button', 'aria-label': 'Próximo mês', onclick: function () { calMonth = key(next); AX.rerender(); } }, icon('chevron-right', 16)),
        h('button', { class: 'btn', type: 'button', onclick: function () { calMonth = u.today().slice(0, 7); AX.rerender(); } }, 'Hoje'),
        h('h2', { style: { fontSize: '17px', marginLeft: '6px' } }, (function (t) { return t.charAt(0).toUpperCase() + t.slice(1); })(u.monthLabel(calMonth, true)))),
      h('div', { class: 'cal' },
        u.WEEKDAYS.map(function (w) { return h('div', { class: 'cal-dow' }, w); }), cells));
  }

  AX.views.activities = function (root) {
    var s = S.s, acts = filtered();
    var typeSel = ui.select([{ value: 'all', label: 'Todos os tipos' }].concat(AX.ACTIVITY_TYPES.map(function (t) { return { value: t.id, label: t.name }; })), typeFilter, { class: 'select sm auto', 'aria-label': 'Tipo' });
    typeSel.addEventListener('change', function () { typeFilter = typeSel.value; AX.rerender(); });
    var ownerSel = s.users.length > 1 ? ui.select([{ value: 'all', label: 'Todos os responsáveis' }].concat(s.users.map(function (x) { return { value: x.id, label: x.name }; })), ownerFilter, { class: 'select sm auto', 'aria-label': 'Responsável' }) : null;
    if (ownerSel) ownerSel.addEventListener('change', function () { ownerFilter = ownerSel.value; AX.rerender(); });
    var overdue = acts.filter(q.isOverdue).length;

    root.appendChild(h('div', { class: 'page-narrow' },
      h('div', { class: 'page-head' },
        h('div', null, h('h1', { class: 'page-title' }, 'Atividades'), h('div', { class: 'page-sub' }, overdue ? overdue + ' atrasada' + (overdue > 1 ? 's' : '') + ' — comece por elas.' : 'Seu plano de ação, do contato frio ao fechamento.')),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn primary', type: 'button', onclick: function () { AX.forms.activity({}); } }, icon('plus', 15), 'Atividade')),
      h('div', { class: 'toolbar', style: { marginBottom: '14px' } },
        ui.segmented([{ value: 'list', label: 'Lista', icon: 'list' }, { value: 'calendar', label: 'Calendário', icon: 'calendar' }], mode, function (v) { mode = v; AX.rerender(); }),
        mode === 'list' ? ui.segmented([{ value: 'todo', label: 'A fazer' }, { value: 'done', label: 'Concluídas' }], status === 'all' ? 'todo' : status, function (v) { status = v; AX.rerender(); }) : null,
        typeSel, ownerSel),
      mode === 'list' ? listView(acts) : calendarView(acts)));
  };
})(window.AX = window.AX || {});
