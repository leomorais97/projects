/* Axon CRM — Leads: caixa de entrada de contatos ainda não qualificados */
(function (AX) {
  'use strict';
  var u = AX.u, h = u.h, icon = AX.icon, ui = AX.ui, S = AX.store, q = S.q;
  var tab = 'inbox', sort = { key: 'created', dir: 'desc' }, text = '', srcFilter = 'all';

  AX.views.leads = function (root) {
    var s = S.s;
    var inbox = s.leads.filter(function (l) { return !l.archived; }), archived = s.leads.filter(function (l) { return l.archived; });
    var list = tab === 'inbox' ? inbox : archived;
    var t = u.norm(text);
    list = list.filter(function (l) {
      if (srcFilter !== 'all' && (l.sourceId || 'none') !== srcFilter) return false;
      return !t || u.norm([l.title, l.orgName, l.personName, l.email, l.role].join(' ')).indexOf(t) >= 0;
    });
    list = ui.sortRows(list, sort, {
      title: function (l) { return l.title; }, source: function (l) { return (q.source(l.sourceId) || {}).name; },
      value: function (l) { return Number(l.value) || 0; }, created: function (l) { return l.createdAt; }
    });

    var search = h('input', { class: 'input sm', type: 'search', placeholder: 'Buscar leads…', 'aria-label': 'Buscar leads', value: text, style: { width: '210px' }, dataset: { draft: 'lead-text' },
      oninput: u.debounce(function (e) { text = e.target.value; AX.rerender(); }, 200) });
    var srcSel = ui.select([{ value: 'all', label: 'Todas as origens' }].concat(s.lists.sources.map(function (x) { return { value: x.id, label: x.name }; })), srcFilter, { class: 'select sm auto', 'aria-label': 'Origem' });
    srcSel.addEventListener('change', function () { srcFilter = srcSel.value; AX.rerender(); });

    root.appendChild(h('div', { class: 'page-narrow' },
      h('div', { class: 'page-head' },
        h('div', null, h('h1', { class: 'page-title' }, 'Leads'), h('div', { class: 'page-sub' }, 'Contatos ainda não qualificados. Converta em negócio quando houver interesse.')),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn', type: 'button', onclick: function () { AX.forms.importLeads(); } }, icon('upload', 15), 'Importar CSV'),
        h('button', { class: 'btn primary', type: 'button', onclick: function () { AX.forms.lead(); } }, icon('plus', 15), 'Lead')),
      ui.tabs([{ id: 'inbox', label: 'Caixa de entrada', count: inbox.length }, { id: 'archived', label: 'Arquivados', count: archived.length }], tab, function (v) { tab = v; AX.rerender(); }),
      h('div', { class: 'toolbar', style: { marginBottom: '12px' } }, search, srcSel),
      leadTable(list, inbox.length + archived.length)));
  };

  function leadTable(list, totalAll) {
    var cols = [
      { key: 'title', label: 'Lead', sortable: true, render: function (l) {
        return h('div', null, h('a', { class: 'cell-title', href: '#', onclick: function (e) { e.preventDefault(); AX.forms.lead({ lead: l }); } }, l.title),
          h('div', { class: 'cell-sub' }, [l.personName, l.role].filter(Boolean).join(' · ') || '—'));
      } },
      { key: 'source', label: 'Origem', sortable: true, render: function (l) { var x = q.source(l.sourceId); return x ? h('span', { class: 'chip' }, x.name) : '—'; } },
      { key: 'contact', label: 'Contato', render: function (l) {
        var wa = u.waLink(l.phone);
        return h('div', { class: 'lead-contact' },
          l.email ? h('a', { href: 'mailto:' + l.email, class: 'truncate', 'data-tip': l.email }, l.email) : null,
          l.phone ? h('span', { class: 'cell-sub' }, l.phone, wa ? h('a', { href: wa, target: '_blank', rel: 'noopener', 'aria-label': 'Abrir WhatsApp', 'data-tip': 'Abrir no WhatsApp', style: { marginLeft: '6px' } }, icon('message', 13)) : null) : null,
          !l.email && !l.phone ? '—' : null);
      } },
      { key: 'value', label: 'Valor est.', sortable: true, cls: 'num', render: function (l) { return l.value ? u.money(l.value) : '—'; } },
      { key: 'created', label: 'Entrada', sortable: true, render: function (l) { return u.timeAgo(l.createdAt); } },
      { key: 'actions', label: '', cls: 'right', render: function (l) {
        if (l.archived) {
          var deal = q.deal(l.convertedDealId);
          return h('div', { class: 'toolbar', style: { justifyContent: 'flex-end' } },
            deal ? h('a', { class: 'btn sm', href: '#/deal/' + deal.id }, 'Ver negócio') : h('button', { class: 'btn sm', type: 'button', onclick: function () { S.updateLead(l.id, { archived: false }); } }, 'Restaurar'),
            h('button', { class: 'btn ghost icon sm', type: 'button', 'aria-label': 'Excluir lead', onclick: function () { ui.withUndo('Lead excluído', function () { S.deleteLead(l.id); }); } }, icon('trash', 15)));
        }
        return h('div', { class: 'toolbar', style: { justifyContent: 'flex-end', flexWrap: 'nowrap' } },
          h('button', { class: 'btn sm primary', type: 'button', onclick: function () { AX.forms.convertLead(l); } }, icon('arrow-right', 14), 'Converter'),
          h('button', { class: 'btn ghost icon sm', type: 'button', 'aria-label': 'Mais ações', onclick: function (e) {
            ui.menu(e.currentTarget, [
              { label: 'Editar', icon: 'pencil', onClick: function () { AX.forms.lead({ lead: l }); } },
              { label: 'Arquivar', icon: 'inbox', onClick: function () { S.updateLead(l.id, { archived: true }); ui.toast('Lead arquivado', { action: { label: 'Desfazer', fn: function () { S.updateLead(l.id, { archived: false }); } } }); } },
              { sep: true },
              { label: 'Excluir', icon: 'trash', danger: true, onClick: function () { ui.withUndo('Lead excluído', function () { S.deleteLead(l.id); }); } }
            ], { align: 'right' });
          } }, icon('more', 16)));
      } }
    ];
    var emptyEl = totalAll === 0
      ? ui.empty({ icon: 'inbox', title: 'Sua caixa de leads está vazia', text: 'Importe uma lista (por exemplo, exportada do Apollo) ou cadastre leads manualmente. Quando o contato demonstrar interesse, converta em negócio.', action: { label: 'Importar CSV', icon: 'upload', onClick: function () { AX.forms.importLeads(); } } })
      : ui.empty({ icon: 'search', title: 'Nenhum lead encontrado', text: tab === 'inbox' ? 'Ajuste os filtros ou adicione um novo lead.' : 'Nenhum lead arquivado com esses filtros.' });
    return ui.dataTable({ columns: cols, rows: list, sort: sort, onSort: function (k) { sort = ui.nextSort(sort, k); AX.rerender(); }, empty: emptyEl });
  }
})(window.AX = window.AX || {});
