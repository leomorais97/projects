/* Axon CRM — Produtos: catálogo de serviços (projeto único e recorrência mensal) */
(function (AX) {
  'use strict';
  var u = AX.u, h = u.h, icon = AX.icon, ui = AX.ui, S = AX.store;
  var sort = { key: 'name', dir: 'asc' };

  AX.views.products = function (root) {
    var s = S.s, usage = {};
    s.deals.forEach(function (d) {
      (d.products || []).forEach(function (l) {
        if (!l.productId) return;
        usage[l.productId] = usage[l.productId] || { n: 0, open: 0 };
        usage[l.productId].n++; if (d.status === 'open') usage[l.productId].open++;
      });
    });
    var rows = ui.sortRows(s.products, sort, {
      name: function (p) { return p.name; }, price: function (p) { return Number(p.price) || 0; }, billing: function (p) { return p.billing; },
      used: function (p) { return (usage[p.id] || { n: 0 }).n; }
    });
    var cols = [
      { key: 'name', label: 'Produto', sortable: true, render: function (p) { return h('div', null, h('div', { class: 'cell-title' }, p.name), p.description ? h('div', { class: 'cell-sub' }, p.description) : null); } },
      { key: 'billing', label: 'Cobrança', sortable: true, render: function (p) { return p.billing === 'monthly' ? h('span', { class: 'badge accent' }, icon('repeat', 12), 'Mensal (MRR)') : h('span', { class: 'badge neutral' }, 'Projeto único'); } },
      { key: 'price', label: 'Preço', sortable: true, cls: 'num', render: function (p) { return u.money(p.price, { cents: true }) + (p.billing === 'monthly' ? '/mês' : ''); } },
      { key: 'used', label: 'Em negócios', sortable: true, cls: 'num', render: function (p) { var x = usage[p.id]; return x ? x.n + (x.open ? ' (' + x.open + ' abertos)' : '') : '—'; } },
      { key: 'active', label: 'Status', render: function (p) { return p.active ? h('span', { class: 'badge good' }, 'Ativo') : h('span', { class: 'badge neutral' }, 'Inativo'); } },
      { key: 'edit', label: '', cls: 'right', render: function (p) { return h('button', { class: 'btn ghost icon sm', type: 'button', 'aria-label': 'Editar ' + p.name, onclick: function () { AX.forms.product({ product: p }); } }, icon('pencil', 15)); } }
    ];
    var recurring = s.products.filter(function (p) { return p.billing === 'monthly'; }).length;
    root.appendChild(h('div', { class: 'page-narrow' },
      h('div', { class: 'page-head' },
        h('div', null, h('h1', { class: 'page-title' }, 'Produtos'), h('div', { class: 'page-sub' }, s.products.length + ' item(ns) no catálogo · ' + recurring + ' recorrente(s). Os preços são ponto de partida — ajuste à vontade.')),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn primary', type: 'button', onclick: function () { AX.forms.product({}); } }, icon('plus', 15), 'Produto')),
      ui.dataTable({ columns: cols, rows: rows, sort: sort, onSort: function (k) { sort = ui.nextSort(sort, k); AX.rerender(); }, onRow: function (p) { AX.forms.product({ product: p }); },
        empty: ui.empty({ icon: 'package', title: 'Catálogo vazio', text: 'Cadastre os serviços que a Axon vende (site institucional, e-commerce, manutenção…).', action: { label: 'Novo produto', icon: 'plus', onClick: function () { AX.forms.product({}); } } }) })));
  };
})(window.AX = window.AX || {});
