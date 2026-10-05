/* Axon CRM — utilitários (DOM, datas, moeda, CSV). Sem dependências. */
(function (AX) {
  'use strict';

  /* ---------- DOM: h(tag, attrs, ...children) — sempre usa textContent (seguro contra XSS) ---------- */
  var ATTR_ALIAS = { for: 'htmlFor', class: 'className' };
  function appendChild(el, c) {
    if (c == null || c === false || c === true) return;
    if (Array.isArray(c)) { c.forEach(function (x) { appendChild(el, x); }); return; }
    if (c instanceof Node) { el.appendChild(c); return; }
    el.appendChild(document.createTextNode(String(c)));
  }
  function h(tag, attrs) {
    var el = document.createElement(tag);
    var deferred = null;
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'value' || k === 'checked' || k === 'selected') (deferred = deferred || {})[k] = v;
        else if (k === 'html') throw new Error('h(): use children, not html');
        else if (v === true) el.setAttribute(k, '');
        else if (ATTR_ALIAS[k]) el[ATTR_ALIAS[k]] = v;
        else el.setAttribute(k, v);
      });
    }
    for (var i = 2; i < arguments.length; i++) appendChild(el, arguments[i]);
    if (deferred) Object.keys(deferred).forEach(function (k) { el[k] = deferred[k]; });
    return el;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  /* ---------- ids / misc ---------- */
  function uid(prefix) {
    return (prefix || 'x') + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  }
  function debounce(fn, ms) {
    var t;
    return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); };
  }
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  }
  function initials(name) {
    var p = String(name || '?').trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '?';
    return ((p[0][0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }
  function sum(arr, fn) { return arr.reduce(function (a, x) { return a + (fn ? fn(x) : x); }, 0); }
  function groupBy(arr, fn) {
    var m = new Map();
    arr.forEach(function (x) { var k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); });
    return m;
  }

  /* ---------- datas (strings locais 'YYYY-MM-DD'; timestamps em ISO) ---------- */
  var MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  var MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  var WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  function pad(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return ymd(new Date()); }
  function nowIso() { return new Date().toISOString(); }
  function parseYmd(s) { var p = String(s).slice(0, 10).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function toYmd(x) { if (!x) return ''; return String(x).length === 10 ? String(x) : ymd(new Date(x)); }
  function addDays(s, n) { var d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); }
  function diffDays(a, b) { return Math.round((parseYmd(b) - parseYmd(a)) / 864e5); }
  function daysSince(iso) { return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 864e5)); }
  function monthKey(x) { return toYmd(x).slice(0, 7); }
  function monthLabel(key, long) {
    var p = key.split('-').map(Number);
    return long ? MONTHS_LONG[p[1] - 1] + ' de ' + p[0] : MONTHS[p[1] - 1] + '/' + String(p[0]).slice(2);
  }
  function startOfWeek(s) { var d = parseYmd(s); d.setDate(d.getDate() - d.getDay()); return ymd(d); }
  function fmtDate(x) { return x ? parseYmd(toYmd(x)).toLocaleDateString('pt-BR') : '—'; }
  function fmtDateShort(x) {
    if (!x) return '—';
    var s = toYmd(x), d = parseYmd(s), cur = new Date().getFullYear();
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + (d.getFullYear() !== cur ? ' ' + d.getFullYear() : '');
  }
  function fmtDateLong(x) {
    var d = parseYmd(toYmd(x));
    return WEEKDAYS[d.getDay()] + ', ' + d.getDate() + ' de ' + MONTHS_LONG[d.getMonth()];
  }
  function fmtTime(iso) { var d = new Date(iso); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function relDay(x) {
    if (!x) return '';
    var n = diffDays(today(), toYmd(x));
    if (n === 0) return 'Hoje';
    if (n === 1) return 'Amanhã';
    if (n === -1) return 'Ontem';
    return fmtDateShort(x);
  }
  function timeAgo(iso) {
    var s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'agora';
    if (s < 3600) return 'há ' + Math.floor(s / 60) + ' min';
    if (s < 86400) return 'há ' + Math.floor(s / 3600) + ' h';
    if (s < 86400 * 7) return 'há ' + Math.floor(s / 86400) + ' d';
    return fmtDate(iso);
  }

  /* ---------- moeda ---------- */
  var BRL0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  var BRL2 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  var NUM1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
  function compact(n) {
    var a = Math.abs(n), sign = n < 0 ? '-' : '';
    if (a >= 1e6) return sign + 'R$ ' + NUM1.format(a / 1e6) + ' mi';
    if (a >= 1e4) return sign + 'R$ ' + NUM1.format(a / 1e3) + ' mil';
    return BRL0.format(n);
  }
  function money(n, o) {
    n = Number(n) || 0;
    if (o && o.compact) return compact(n);
    return (o && o.cents ? BRL2 : BRL0).format(n);
  }
  function pct(n, d) { return NUM1.format(n) + '%'; }
  function num(n) { return NUM1.format(n); }
  function parseMoney(str) {
    if (typeof str === 'number') return str;
    var s = String(str == null ? '' : str).replace(/[^\d.,-]/g, '');
    if (!s) return 0;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var v = parseFloat(s);
    return isFinite(v) ? v : 0;
  }

  /* ---------- URLs / contato ---------- */
  function safeUrl(u) {
    u = String(u || '').trim();
    if (!u) return '';
    if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
    return /^https?:\/\//i.test(u) ? u : '';
  }
  function hostname(u) { try { return new URL(safeUrl(u)).hostname.replace(/^www\./, ''); } catch (e) { return String(u || ''); } }
  function waLink(phone) {
    var d = String(phone || '').replace(/\D/g, '');
    if (d.length < 10) return '';
    if (d.length <= 11) d = '55' + d;
    return 'https://wa.me/' + d;
  }

  /* ---------- CSV (detecta , ; e tab; aspas; BOM) ---------- */
  function parseCSV(text) {
    text = String(text || '').replace(/^﻿/, '');
    var first = text.split(/\r?\n/)[0] || '', counts = { ',': 0, ';': 0, '\t': 0 }, inq = false, i, c;
    for (i = 0; i < first.length; i++) {
      c = first[i];
      if (c === '"') inq = !inq;
      else if (!inq && counts[c] != null) counts[c]++;
    }
    var delim = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
    var rows = [], row = [], cell = '';
    inq = false;
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (inq) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inq = false; } else cell += c;
      } else if (c === '"') inq = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = ''; rows.push(row); row = [];
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    rows = rows.filter(function (r) { return r.some(function (x) { return String(x).trim() !== ''; }); });
    var headers = (rows.shift() || []).map(function (s) { return String(s).trim(); });
    return { headers: headers, rows: rows };
  }
  function csvCell(v) {
    if (v == null) return '';
    if (typeof v === 'number') return String(v).replace('.', ',');
    var s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // evita injeção de fórmula no Excel
    return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCSV(columns, rows) {
    var lines = [columns.map(function (c) { return csvCell(c.label); }).join(';')];
    rows.forEach(function (r) { lines.push(columns.map(function (c) { return csvCell(c.get(r)); }).join(';')); });
    return '﻿' + lines.join('\r\n');
  }
  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = h('a', { href: url, download: filename });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  AX.u = {
    h: h, clear: clear, uid: uid, debounce: debounce, norm: norm, initials: initials, sum: sum, groupBy: groupBy,
    pad: pad, ymd: ymd, today: today, nowIso: nowIso, parseYmd: parseYmd, toYmd: toYmd, addDays: addDays, diffDays: diffDays,
    daysSince: daysSince, monthKey: monthKey, monthLabel: monthLabel, startOfWeek: startOfWeek,
    fmtDate: fmtDate, fmtDateShort: fmtDateShort, fmtDateLong: fmtDateLong, fmtTime: fmtTime, relDay: relDay, timeAgo: timeAgo,
    MONTHS: MONTHS, MONTHS_LONG: MONTHS_LONG, WEEKDAYS: WEEKDAYS,
    money: money, pct: pct, num: num, parseMoney: parseMoney,
    safeUrl: safeUrl, hostname: hostname, waLink: waLink,
    parseCSV: parseCSV, toCSV: toCSV, download: download
  };
  AX.h = h;
  AX.views = AX.views || {}; // telas registram-se aqui (js/views/*.js)
})(window.AX = window.AX || {});
