/* Axon CRM — componentes de interface reutilizáveis (modal, menu, picker, tabela, edição inline…) */
(function (AX) {
  'use strict';
  var u = AX.u, h = u.h, clear = u.clear, icon = AX.icon, S = AX.store, q = S.q;

  /* ---------- toast ---------- */
  var toastBox;
  function toast(msg, o) {
    o = o || {};
    if (!toastBox) { toastBox = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(toastBox); }
    var timer;
    function dismiss() { clearTimeout(timer); el.remove(); }
    var el = h('div', { class: 'toast ' + (o.kind || '') },
      o.kind === 'success' ? icon('check', 16) : null,
      h('span', null, msg),
      o.action ? h('button', { type: 'button', onclick: function () { o.action.fn(); dismiss(); } }, o.action.label) : null);
    toastBox.appendChild(el);
    while (toastBox.children.length > 3) toastBox.removeChild(toastBox.firstChild);
    timer = setTimeout(dismiss, o.duration || (o.action ? 7000 : 3400));
    return dismiss;
  }
  // executa a ação e oferece "Desfazer" (restaura um snapshot do estado)
  function withUndo(message, action) {
    var snap = S.snapshot();
    action();
    toast(message, { action: { label: 'Desfazer', fn: function () { S.restore(snap); } } });
  }

  /* ---------- modal ---------- */
  var modalStack = [];
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modalStack.length) { e.preventDefault(); modalStack[modalStack.length - 1].close(); }
  });
  function modal(o) {
    var prev = document.activeElement;
    var backdrop = h('div', { class: 'modal-backdrop' });
    var api = { el: null, close: null };
    var closed = false;
    function close(result) {
      if (closed) return; closed = true;
      var i = modalStack.indexOf(api); if (i >= 0) modalStack.splice(i, 1);
      backdrop.remove();
      if (!modalStack.length) document.documentElement.style.overflow = '';
      if (o.onClose) o.onClose(result);
      try { if (prev && prev.focus && document.contains(prev)) prev.focus(); } catch (e) { /* ignora */ }
    }
    var head = h('div', { class: 'modal-head' }, h('h3', null, o.title),
      h('button', { class: 'btn ghost icon sm', type: 'button', 'aria-label': 'Fechar', onclick: function () { close(); } }, icon('x', 16)));
    var body = h('div', { class: 'modal-body' }, o.content);
    var parts = [head, body];
    var box;
    if (o.onSubmit || o.footer) {
      var foot = h('div', { class: 'modal-foot' },
        o.footerLeft ? h('div', { class: 'left' }, o.footerLeft) : null,
        o.footer ? o.footer(close) : [
          h('button', { class: 'btn', type: 'button', onclick: function () { close(); } }, o.cancelText || 'Cancelar'),
          h('button', { class: 'btn ' + (o.danger ? 'danger-solid' : 'primary'), type: 'submit' }, o.submitText || 'Salvar')
        ]);
      parts.push(foot);
    }
    if (o.onSubmit) {
      box = h('form', { class: 'modal ' + (o.size || ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title }, parts);
      box.addEventListener('submit', function (e) {
        e.preventDefault();
        var r = o.onSubmit(close);
        if (r === false) return;
        close(r);
      });
    } else {
      box = h('div', { class: 'modal ' + (o.size || ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title }, parts);
    }
    backdrop.appendChild(box);
    backdrop.addEventListener('mousedown', function (e) { if (e.target === backdrop) close(); });
    document.body.appendChild(backdrop);
    document.documentElement.style.overflow = 'hidden';
    api.el = box; api.close = close; api.body = body;
    modalStack.push(api);
    var first = box.querySelector('[autofocus]') || body.querySelector('input:not([type=hidden]):not([type=file]), select, textarea');
    if (first) setTimeout(function () { try { if (!box.contains(document.activeElement)) first.focus(); } catch (e) { /* ignora */ } }, 20);
    return api;
  }
  function confirmDialog(o) {
    return new Promise(function (resolve) {
      var done = false;
      modal({
        title: o.title || 'Confirmar', size: 'sm',
        content: h('div', null, h('p', null, o.message || ''), o.detail ? h('p', { class: 'muted', style: { marginTop: '8px' } }, o.detail) : null),
        onSubmit: function () { done = true; resolve(true); },
        onClose: function () { if (!done) resolve(false); },
        submitText: o.confirmText || 'Confirmar', danger: o.danger
      });
    });
  }

  /* ---------- popover / menu ---------- */
  var openPop = null;
  function closePopover() {
    if (!openPop) return;
    var p = openPop; openPop = null;
    document.removeEventListener('mousedown', p.onDoc, true);
    document.removeEventListener('keydown', p.onKey, true);
    window.removeEventListener('scroll', p.onScroll, true);
    window.removeEventListener('resize', closePopover);
    p.el.remove();
    if (p.onClose) p.onClose();
  }
  function placeFloating(el, anchor, align, matchWidth) {
    var r = anchor.getBoundingClientRect();
    if (matchWidth) el.style.width = r.width + 'px';
    var w = el.offsetWidth, hgt = el.offsetHeight;
    var left = align === 'right' ? r.right - w : r.left;
    var top = r.bottom + 6;
    if (left + w > innerWidth - 8) left = innerWidth - w - 8;
    if (left < 8) left = 8;
    if (top + hgt > innerHeight - 8) top = Math.max(8, r.top - hgt - 6);
    el.style.left = left + 'px'; el.style.top = top + 'px';
  }
  function popover(anchor, content, o) {
    o = o || {};
    closePopover();
    var el = h('div', { class: 'popover', style: o.width ? { width: o.width } : null }, content);
    document.body.appendChild(el);
    placeFloating(el, anchor, o.align, o.matchWidth);
    var p = {
      el: el, onClose: o.onClose,
      onDoc: function (e) { if (!el.contains(e.target) && !anchor.contains(e.target)) closePopover(); },
      onKey: function (e) { if (e.key === 'Escape') { e.stopPropagation(); closePopover(); } },
      onScroll: function (e) { var t = e.target; if (!el.contains(t) && t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA') closePopover(); }
    };
    openPop = p;
    document.addEventListener('mousedown', p.onDoc, true);
    document.addEventListener('keydown', p.onKey, true);
    window.addEventListener('scroll', p.onScroll, true);
    window.addEventListener('resize', closePopover);
    return el;
  }
  function menu(anchor, items, o) {
    var box = h('div', { role: 'menu' }, items.filter(Boolean).map(function (it) {
      if (it.sep) return h('div', { class: 'menu-sep' });
      if (it.head) return h('div', { class: 'menu-head' }, it.head);
      return h('button', {
        type: 'button', role: 'menuitem', class: 'menu-item' + (it.danger ? ' danger' : '') + (it.selected ? ' sel' : ''),
        onclick: function () { closePopover(); if (it.onClick) it.onClick(); }
      }, it.icon ? icon(it.icon, 16) : null, h('span', null, it.label), it.sub ? h('span', { class: 'sub' }, it.sub) : null,
      it.selected ? h('span', { class: 'sub' }, icon('check', 15)) : null);
    }));
    return popover(anchor, box, o);
  }

  /* ---------- tooltip (data-tip) ---------- */
  var tipEl = null;
  function showTip(target) {
    var text = target.getAttribute('data-tip');
    if (!text) return;
    hideTip();
    tipEl = h('div', { class: 'tip', role: 'tooltip' }, text);
    document.body.appendChild(tipEl);
    var r = target.getBoundingClientRect();
    var w = tipEl.offsetWidth, hgt = tipEl.offsetHeight;
    var left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8);
    var top = r.top - hgt - 8;
    if (top < 8) top = r.bottom + 8;
    tipEl.style.left = left + 'px'; tipEl.style.top = top + 'px';
  }
  function hideTip() { if (tipEl) { tipEl.remove(); tipEl = null; } }
  document.addEventListener('mouseover', function (e) { var t = e.target.closest && e.target.closest('[data-tip]'); if (t) showTip(t); });
  document.addEventListener('mouseout', function (e) { var t = e.target.closest && e.target.closest('[data-tip]'); if (t) hideTip(); });
  document.addEventListener('focusin', function (e) { var t = e.target.closest && e.target.closest('[data-tip]'); if (t) showTip(t); });
  document.addEventListener('focusout', hideTip);
  document.addEventListener('mousedown', hideTip, true);
  document.addEventListener('dragstart', hideTip, true);

  /* ---------- peças pequenas ---------- */
  function avatar(user, cls) {
    user = user || { name: '?', color: '#7a8296' };
    return h('span', { class: 'avatar ' + (cls || ''), style: { background: user.color }, 'data-tip': user.name, 'aria-label': user.name }, u.initials(user.name));
  }
  function orgAvatar(name, cls) { return h('span', { class: 'avatar org ' + (cls || '') }, icon('building', cls === 'xl' ? 22 : cls === 'lg' ? 18 : 13)); }
  function personAvatar(p, cls) {
    return h('span', { class: 'avatar ' + (cls || ''), style: { background: '#6b7388' } }, u.initials(p ? p.name : '?'));
  }
  function labelChip(l) {
    if (!l) return null;
    return h('span', { class: 'chip' }, h('span', { class: 'dot', style: { background: l.color } }), l.name);
  }
  function actIcon(typeId, size) { return icon(q.actType(typeId).icon, size || 16); }
  function dealStatusBadge(d) {
    if (d.status === 'won') return h('span', { class: 'badge good' }, icon('trophy', 13), 'Ganho');
    if (d.status === 'lost') return h('span', { class: 'badge crit' }, icon('thumbs-down', 13), 'Perdido');
    var si = q.stageInfo(d.stageId);
    return h('span', { class: 'badge accent' }, si ? si.stage.name : 'Aberto');
  }
  function empty(o) {
    return h('div', { class: 'empty' },
      h('div', { class: 'ic-wrap' }, icon(o.icon || 'inbox', 24)),
      h('h3', null, o.title),
      o.text ? h('p', null, o.text) : null,
      o.action ? h('button', { class: 'btn primary', type: 'button', style: { marginTop: '8px' }, onclick: o.action.onClick }, o.action.icon ? icon(o.action.icon, 16) : null, o.action.label) : null);
  }
  function segmented(options, value, onChange) {
    return h('div', { class: 'seg', role: 'tablist' }, options.map(function (o) {
      return h('button', { type: 'button', role: 'tab', 'aria-selected': String(o.value === value), class: o.value === value ? 'on' : '', onclick: function () { onChange(o.value); } },
        o.icon ? icon(o.icon, 15) : null, o.label);
    }));
  }
  function tabs(items, active, onChange) {
    return h('div', { class: 'tabs', role: 'tablist' }, items.map(function (t) {
      return h('button', { type: 'button', role: 'tab', 'aria-selected': String(t.id === active), class: 'tab' + (t.id === active ? ' on' : ''), onclick: function () { onChange(t.id); } },
        t.label, t.count != null ? h('span', { class: 'count' }, t.count) : null);
    }));
  }

  /* ---------- formulário ---------- */
  function field(label, control, o) {
    o = o || {};
    var target = control.matches && control.matches('input,select,textarea') ? control : control.querySelector && control.querySelector('input,select,textarea');
    var id = null;
    if (target) { id = target.id || u.uid('f'); target.id = id; }
    return h('div', { class: 'field' + (o.req ? ' req' : '') + (o.full ? ' full' : '') },
      h('label', { for: id }, label), control, o.hint ? h('div', { class: 'hint' }, o.hint) : null);
  }
  function select(options, value, attrs) {
    var el = h('select', Object.assign({ class: 'select' }, attrs || {}),
      options.map(function (o) { o = typeof o === 'string' ? { value: o, label: o } : o; return h('option', { value: o.value }, o.label); }));
    el.value = value == null ? '' : value;
    if (el.value !== String(value == null ? '' : value) && options.length) el.selectedIndex = 0;
    return el;
  }
  function textInput(attrs) { return h('input', Object.assign({ class: 'input', type: 'text' }, attrs || {})); }
  function fmtMoneyInput(n) { return n ? Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : ''; }
  function moneyInput(value, attrs) {
    var input = h('input', Object.assign({ class: 'input', type: 'text', inputmode: 'decimal', placeholder: '0', autocomplete: 'off' }, attrs || {}));
    input.value = fmtMoneyInput(value);
    input.addEventListener('blur', function () { var v = u.parseMoney(input.value); input.value = fmtMoneyInput(v); });
    var wrap = h('div', { class: 'input-group' }, h('span', { class: 'prefix' }, 'R$'), input);
    wrap.get = function () { return u.parseMoney(input.value); };
    wrap.set = function (v) { input.value = fmtMoneyInput(v); };
    wrap.input = input;
    return wrap;
  }

  /* ---------- picker (combobox com "criar novo") ---------- */
  function picker(o) {
    var value = o.value || null, list = null, sel = 0, shown = [], dirty = false;
    var input = h('input', { class: 'input', type: 'text', placeholder: o.placeholder || 'Buscar…', autocomplete: 'off', role: 'combobox', 'aria-expanded': 'false' });
    var clearBtn = h('button', { type: 'button', class: 'clear', tabindex: '-1', 'aria-label': 'Limpar seleção', onclick: function () { set(null, true); input.focus(); } }, icon('x', 14));
    var wrap = h('div', { class: 'picker' }, input, clearBtn);
    function items() { return o.items(); }
    function labelOf(id) { var it = items().filter(function (x) { return x.id === id; })[0]; return it ? it.label : ''; }
    function set(id, fire) {
      value = id; dirty = false; input.value = id ? labelOf(id) : ''; clearBtn.style.display = id ? '' : 'none';
      if (fire && o.onChange) o.onChange(id);
    }
    function close() {
      if (list) { list.remove(); list = null; input.setAttribute('aria-expanded', 'false'); }
      window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', close);
    }
    // rolar a página/modal fecha a lista (posição ficaria errada); rolar a própria lista não
    function onScroll(e) { var t = e.target; if (t === input || (list && list.contains(t)) || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return; close(); }
    function render() {
      var text = dirty ? u.norm(input.value) : '';
      shown = items().filter(function (it) { return !text || u.norm(it.label + ' ' + (it.sub || '')).indexOf(text) >= 0; }).slice(0, 40);
      var raw = input.value.trim();
      var exact = items().some(function (it) { return u.norm(it.label) === u.norm(raw); });
      var canCreate = o.onCreate && dirty && raw && !exact;
      if (sel >= shown.length + (canCreate ? 1 : 0)) sel = 0;
      if (!list) {
        list = h('div', { class: 'picker-list', role: 'listbox' });
        document.body.appendChild(list);
        input.setAttribute('aria-expanded', 'true');
        window.addEventListener('scroll', onScroll, true); window.addEventListener('resize', close);
      }
      clear(list);
      shown.forEach(function (it, i) {
        list.appendChild(h('div', { class: 'picker-opt' + (i === sel ? ' sel' : ''), role: 'option', onmousedown: function (e) { e.preventDefault(); choose(i); } },
          h('span', null, it.label), it.sub ? h('span', { class: 'sub' }, it.sub) : null));
      });
      if (canCreate) {
        var ci = shown.length;
        list.appendChild(h('div', { class: 'picker-opt create' + (ci === sel ? ' sel' : ''), role: 'option', onmousedown: function (e) { e.preventDefault(); create(raw); } },
          icon('plus', 15), 'Criar “' + raw + '”'));
      } else if (!shown.length) list.appendChild(h('div', { class: 'picker-empty' }, 'Nada encontrado'));
      placeFloating(list, input, 'left', true);
    }
    function choose(i) { var it = shown[i]; if (it) { set(it.id, true); close(); } }
    function create(name) { var id = o.onCreate(name); if (id) { set(id, true); } close(); }
    input.addEventListener('focus', function () { input.select(); dirty = false; sel = 0; render(); });
    input.addEventListener('input', function () { dirty = true; sel = 0; render(); });
    input.addEventListener('blur', function () { setTimeout(function () { close(); if (value) input.value = labelOf(value); else if (!o.keepText) input.value = ''; dirty = false; }, 120); });
    input.addEventListener('keydown', function (e) {
      if (!list) { if (e.key === 'ArrowDown') { render(); e.preventDefault(); } return; }
      var total = list.querySelectorAll('.picker-opt').length;
      if (e.key === 'ArrowDown') { sel = (sel + 1) % Math.max(total, 1); render(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = (sel - 1 + total) % Math.max(total, 1); render(); e.preventDefault(); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (sel < shown.length) choose(sel); else if (o.onCreate && input.value.trim()) create(input.value.trim());
      } else if (e.key === 'Escape') { e.stopPropagation(); close(); input.blur(); }
    });
    Object.defineProperty(wrap, 'value', { get: function () { return value; } });
    wrap.setValue = function (id) { set(id, false); };
    wrap.input = input;
    set(value, false);
    return wrap;
  }

  /* ---------- edição inline ---------- */
  function editable(o) {
    var wrap = h('div');
    function display() {
      var v = o.value;
      var content = o.display ? o.display(v) : (v == null || v === '' ? null : String(v));
      var view = h('div', { class: 'editable', tabindex: 0, role: 'button', 'aria-label': 'Editar ' + (o.label || ''), onclick: function (e) { if (e.target.closest('a')) return; edit(); }, onkeydown: function (e) { if (e.key === 'Enter') { e.preventDefault(); edit(); } } },
        content != null && content !== '' ? content : h('span', { class: 'ph' }, o.placeholder || 'Adicionar…'),
        h('span', { class: 'pen' }, icon('pencil', 13)));
      clear(wrap); wrap.appendChild(view);
    }
    function edit() {
      var input, done = false;
      var kind = o.kind || 'text';
      if (kind === 'select') input = select(o.options, o.value, { class: 'editable-input select' });
      else if (kind === 'textarea') { input = h('textarea', { class: 'editable-input', rows: 3, style: { height: 'auto', padding: '6px 8px' } }); input.value = o.value || ''; }
      else {
        input = h('input', { class: 'editable-input', type: kind === 'date' ? 'date' : 'text', inputmode: kind === 'money' ? 'decimal' : null });
        input.value = kind === 'money' ? fmtMoneyInput(o.value) : (o.value || '');
      }
      function finish(save) {
        if (done) return; done = true;
        if (save) {
          var nv = kind === 'money' ? u.parseMoney(input.value) : (typeof input.value === 'string' ? input.value.trim() : input.value);
          var old = kind === 'money' ? Number(o.value) || 0 : (o.value || '');
          if (nv !== old) { o.onSave(nv); return; }
        }
        display();
      }
      input.addEventListener('blur', function () { finish(true); });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && kind !== 'textarea') { e.preventDefault(); finish(true); }
        else if (e.key === 'Escape') { e.stopPropagation(); finish(false); }
      });
      if (kind === 'select') input.addEventListener('change', function () { finish(true); });
      clear(wrap); wrap.appendChild(input); input.focus();
      if (input.select && kind !== 'select') input.select();
    }
    display();
    return wrap;
  }

  /* ---------- tabela ordenável ---------- */
  function dataTable(o) {
    if (!o.rows.length && o.empty) return o.empty;
    var head = h('tr', null, o.columns.map(function (c) {
      var active = o.sort && o.sort.key === c.key;
      return h('th', {
        class: (c.sortable ? 'sortable ' : '') + (c.cls || ''), style: c.width ? { width: c.width } : null,
        'aria-sort': active ? (o.sort.dir === 'asc' ? 'ascending' : 'descending') : null,
        onclick: c.sortable && o.onSort ? function () { o.onSort(c.key); } : null
      }, c.label, active ? h('span', { class: 'arrow' }, o.sort.dir === 'asc' ? '↑' : '↓') : null);
    }));
    var body = o.rows.map(function (r) {
      return h('tr', { class: o.onRow ? 'clickable' : '', tabindex: o.onRow ? 0 : null,
        onclick: o.onRow ? function (e) { if (!e.target.closest('a,button,input,select')) o.onRow(r); } : null,
        onkeydown: o.onRow ? function (e) { if (e.key === 'Enter' && !e.target.closest('a,button,input,select')) o.onRow(r); } : null },
        o.columns.map(function (c) { return h('td', { class: c.cls || '' }, c.render(r)); }));
    });
    return h('div', { class: 'table-wrap' }, h('table', { class: 'table' + (o.tableClass ? ' ' + o.tableClass : '') }, h('thead', null, head), h('tbody', null, body)));
  }
  function nextSort(sort, key) { return sort.key === key ? { key: key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key: key, dir: 'asc' }; }
  function sortRows(rows, sort, getters) {
    var g = getters[sort.key]; if (!g) return rows;
    var dir = sort.dir === 'asc' ? 1 : -1;
    return rows.slice().sort(function (a, b) {
      var x = g(a), y = g(b);
      if (x == null || x === '') return y == null || y === '' ? 0 : 1;
      if (y == null || y === '') return -1;
      if (typeof x === 'string') return x.localeCompare(y, 'pt-BR') * dir;
      return (x - y) * dir;
    });
  }

  /* ---------- links de navegação ---------- */
  function link(href, children, cls) { return h('a', { href: href, class: cls || null }, children); }

  AX.ui = {
    toast: toast, withUndo: withUndo, modal: modal, confirm: confirmDialog, popover: popover, menu: menu, closePopover: closePopover,
    avatar: avatar, orgAvatar: orgAvatar, personAvatar: personAvatar, labelChip: labelChip, actIcon: actIcon, dealStatusBadge: dealStatusBadge,
    empty: empty, segmented: segmented, tabs: tabs, field: field, select: select, textInput: textInput, moneyInput: moneyInput, picker: picker,
    editable: editable, dataTable: dataTable, nextSort: nextSort, sortRows: sortRows, link: link, fmtMoneyInput: fmtMoneyInput
  };
})(window.AX = window.AX || {});
