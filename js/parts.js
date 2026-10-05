/* Axon CRM — blocos compartilhados entre telas (linha de atividade, nota, linha do tempo) */
(function (AX) {
  'use strict';
  var u = AX.u, h = u.h, icon = AX.icon, ui = AX.ui, S = AX.store, q = S.q;

  function whenLabel(a) { return a.dueDate ? [u.relDay(a.dueDate), a.dueTime].filter(Boolean).join(' · ') : ''; }

  function completeToast(a) {
    ui.toast('Atividade concluída', {
      kind: 'success',
      action: a.dealId && q.deal(a.dealId) && q.deal(a.dealId).status === 'open'
        ? { label: 'Agendar próxima', fn: function () { AX.forms.activity({ defaults: { dealId: a.dealId, personId: a.personId, orgId: a.orgId, type: a.type } }); } } : null
    });
  }

  function activityRow(a, o) {
    o = o || {};
    var overdue = q.isOverdue(a), deal = q.deal(a.dealId), person = q.person(a.personId), owner = q.user(a.ownerId);
    var check = h('button', {
      type: 'button', class: 'check-circle' + (a.done ? ' on' : ''), 'aria-label': a.done ? 'Marcar como pendente' : 'Concluir atividade',
      'data-tip': a.done ? 'Marcar como pendente' : 'Concluir',
      onclick: function (e) { e.stopPropagation(); var was = a.done; S.toggleActivity(a.id); if (!was) completeToast(a); }
    }, a.done ? icon('check', 14) : null);
    var meta = [];
    if (o.showDeal && deal) meta.push(h('a', { href: '#/deal/' + deal.id, onclick: function (e) { e.stopPropagation(); } }, deal.title));
    if (person && (o.showPerson !== false)) meta.push(h('span', null, person.name));
    if (a.note) meta.push(h('span', { class: 'truncate' }, a.note));
    var metaEls = [];
    meta.forEach(function (m, i) { if (i) metaEls.push(h('span', { class: 'dotsep' }, '·')); metaEls.push(m); });
    return h('div', {
      class: 'act-row' + (a.done ? ' done' : '') + (overdue ? ' overdue' : ''), tabindex: 0, role: 'button', 'aria-label': 'Editar atividade ' + a.subject,
      onclick: function () { AX.forms.activity({ activity: a }); },
      onkeydown: function (e) { if (e.key === 'Enter' && e.target === e.currentTarget) AX.forms.activity({ activity: a }); }
    },
      check,
      h('span', { class: 'act-type', 'data-tip': q.actType(a.type).name }, ui.actIcon(a.type, 16)),
      h('div', { class: 'act-main' }, h('div', { class: 'act-subject' }, a.subject), metaEls.length ? h('div', { class: 'act-meta' }, metaEls) : null),
      h('div', { class: 'act-when' + (overdue ? ' late-text' : '') }, overdue ? icon('alert-circle', 13) : null, a.done ? (a.doneAt ? 'Concluída ' + u.relDay(a.doneAt) : 'Concluída') : whenLabel(a)),
      S.s.users.length > 1 && owner ? ui.avatar(owner) : null);
  }

  function noteItem(n, o) {
    o = o || {};
    var box = h('div', { class: 'note' + (n.pinned ? ' pinned' : '') });
    function view() {
      u.clear(box); box.className = 'note' + (n.pinned ? ' pinned' : '');
      var deal = q.deal(n.dealId);
      var head = h('div', { class: 'note-head' },
        n.pinned ? h('span', { class: 'pin', 'data-tip': 'Nota fixada' }, icon('pin', 13)) : null,
        h('span', { class: 'muted' }, u.fmtDate(n.createdAt) + ' às ' + u.fmtTime(n.createdAt) + (n.updatedAt ? ' · editada' : '')),
        o.showDeal && deal ? h('a', { href: '#/deal/' + deal.id }, deal.title) : null,
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn ghost icon sm', type: 'button', 'aria-label': 'Ações da nota', onclick: function (e) {
          ui.menu(e.currentTarget, [
            { label: n.pinned ? 'Desafixar' : 'Fixar no topo', icon: 'pin', onClick: function () { S.updateNote(n.id, { pinned: !n.pinned }); } },
            { label: 'Editar', icon: 'pencil', onClick: edit },
            { sep: true },
            { label: 'Excluir', icon: 'trash', danger: true, onClick: function () { ui.withUndo('Nota excluída', function () { S.deleteNote(n.id); }); } }
          ], { align: 'right' });
        } }, icon('more', 16)));
      box.appendChild(head);
      box.appendChild(h('div', { class: 'note-body' }, n.content));
    }
    function edit() {
      u.clear(box);
      var ta = h('textarea', { class: 'textarea' }); ta.value = n.content;
      box.appendChild(ta);
      box.appendChild(h('div', { class: 'toolbar', style: { marginTop: '8px', justifyContent: 'flex-end' } },
        h('button', { class: 'btn sm', type: 'button', onclick: view }, 'Cancelar'),
        h('button', { class: 'btn sm primary', type: 'button', onclick: function () { if (ta.value.trim()) S.updateNote(n.id, { content: ta.value.trim() }); } }, 'Salvar')));
      ta.focus();
    }
    view();
    return box;
  }

  // histórico unificado de um negócio: notas, atividades concluídas e alterações
  function dealFeed(d) {
    var items = [];
    q.dealNotes(d.id).forEach(function (n) { items.push({ at: n.createdAt, kind: 'note', note: n }); });
    q.dealActs(d.id).filter(function (a) { return a.done; }).forEach(function (a) { items.push({ at: a.doneAt || (a.dueDate + 'T12:00:00'), kind: 'act', act: a }); });
    S.s.log.filter(function (l) { return l.entity === 'deal' && l.entityId === d.id; }).forEach(function (l) { items.push({ at: l.at, kind: 'log', log: l }); });
    items.sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : 0; });
    return items;
  }
  function feedView(items) {
    if (!items.length) return h('p', { class: 'muted', style: { padding: '8px 2px' } }, 'Nada por aqui ainda.');
    return h('div', { class: 'feed' }, items.map(function (it) {
      var ic, body;
      if (it.kind === 'note') { ic = 'file-text'; body = noteItem(it.note); }
      else if (it.kind === 'act') {
        ic = q.actType(it.act.type).icon;
        body = h('div', { class: 'feed-text' }, h('strong', null, it.act.subject), h('span', { class: 'muted' }, ' · ' + q.actType(it.act.type).name + ' concluída'), it.act.note ? h('div', { class: 'text-2' }, it.act.note) : null);
      } else { ic = /^Movido/.test(it.log.text) ? 'arrow-right' : /ganho/i.test(it.log.text) ? 'trophy' : /perdido/i.test(it.log.text) ? 'thumbs-down' : 'pencil'; body = h('div', { class: 'feed-text' }, it.log.text); }
      return h('div', { class: 'feed-item' },
        h('span', { class: 'feed-ic ' + it.kind }, icon(ic, 14)),
        h('div', { class: 'feed-body' }, body, it.kind !== 'note' ? h('div', { class: 'feed-time muted' }, u.fmtDate(it.at) + ' · ' + u.fmtTime(it.at)) : null));
    }));
  }

  // linha compacta de negócio (páginas de pessoa e organização)
  function dealMini(d) {
    return h('a', { class: 'deal-mini', href: '#/deal/' + d.id },
      h('div', { class: 'truncate' }, h('div', { class: 'cell-title truncate' }, d.title), h('div', { class: 'cell-sub' }, u.money(d.value) + (d.mrr ? ' + ' + u.money(d.mrr) + '/mês' : ''))),
      ui.dealStatusBadge(d));
  }

  // e-mail, telefone, WhatsApp e LinkedIn de uma pessoa (links só para URLs seguras)
  function contactBits(p) {
    var bits = [];
    if (p.email) {
      if (/^[^\s@]+@[^\s@]+$/.test(p.email)) bits.push(h('a', { class: 'contact-bit', href: 'mailto:' + p.email }, icon('mail', 14), p.email));
      else bits.push(h('span', { class: 'contact-bit' }, icon('mail', 14), p.email));
    }
    if (p.phone) {
      bits.push(h('a', { class: 'contact-bit', href: 'tel:' + p.phone.replace(/[^\d+]/g, '') }, icon('phone', 14), p.phone));
      var wa = u.waLink(p.phone);
      if (wa) bits.push(h('a', { class: 'contact-bit', href: wa, target: '_blank', rel: 'noopener' }, icon('message', 14), 'WhatsApp'));
    }
    var li = u.safeUrl(p.linkedin);
    if (li) bits.push(h('a', { class: 'contact-bit', href: li, target: '_blank', rel: 'noopener' }, icon('linkedin', 14), 'LinkedIn'));
    return bits;
  }

  AX.parts = { contactBits: contactBits, activityRow: activityRow, noteItem: noteItem, dealFeed: dealFeed, feedView: feedView, dealMini: dealMini, completeToast: completeToast };
})(window.AX = window.AX || {});
