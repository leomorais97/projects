/* Axon CRM — Insights: KPIs, funil, ganhos × perdidos, previsão, origem, motivos de perda e atividades.
   Gráficos em HTML/CSS (sem bibliotecas): marcas finas, grid discreto, tooltip em toda marca e tabela equivalente. */
(function (AX) {
  'use strict';
  var u = AX.u, h = u.h, icon = AX.icon, ui = AX.ui, S = AX.store, q = S.q;

  var PERIODS = [
    { id: 'this_month', label: 'Este mês' }, { id: 'last_month', label: 'Mês passado' }, { id: '30d', label: 'Últimos 30 dias' },
    { id: '90d', label: 'Últimos 90 dias' }, { id: 'quarter', label: 'Este trimestre' }, { id: 'year', label: 'Este ano' }, { id: 'all', label: 'Todo o período' }
  ];

  function rangeOf(p) {
    var t = u.today(), d = u.parseYmd(t), y = d.getFullYear(), m = d.getMonth();
    var first = function (yy, mm) { return yy + '-' + u.pad(mm + 1) + '-01'; };
    if (p === 'last_month') { var pm = new Date(y, m - 1, 1); return { from: first(pm.getFullYear(), pm.getMonth()), to: u.ymd(new Date(y, m, 0)) }; }
    if (p === '30d') return { from: u.addDays(t, -29), to: t };
    if (p === '90d') return { from: u.addDays(t, -89), to: t };
    if (p === 'quarter') return { from: first(y, Math.floor(m / 3) * 3), to: t };
    if (p === 'year') return { from: first(y, 0), to: t };
    if (p === 'all') return { from: '0000-01-01', to: '9999-12-31' };
    return { from: first(y, m), to: t };
  }
  function prevRange(r, p) {
    if (p === 'all') return null;
    var len = u.diffDays(r.from, r.to) + 1, to = u.addDays(r.from, -1);
    return { from: u.addDays(to, -(len - 1)), to: to };
  }
  function within(iso, r) { if (!iso) return false; var d = u.toYmd(iso); return d >= r.from && d <= r.to; }

  /* ---------- tooltip dos gráficos (conteúdo sempre via textContent) ---------- */
  var tipBox = null;
  function hideTip() { if (tipBox) tipBox.classList.add('hidden'); }
  function bindTip(el, content) {
    el.setAttribute('tabindex', '0');
    function fill() {
      if (!tipBox) { tipBox = h('div', { class: 'chart-tip hidden', role: 'tooltip' }); document.body.appendChild(tipBox); }
      u.clear(tipBox);
      tipBox.appendChild(h('div', { class: 'ct-title' }, content.title));
      (content.rows || []).forEach(function (r) {
        tipBox.appendChild(h('div', { class: 'ct-row' }, r.color ? h('span', { class: 'ct-key', style: { background: r.color } }) : null, h('strong', null, r.value), h('span', { class: 'muted' }, r.label)));
      });
      if (content.foot) tipBox.appendChild(h('div', { class: 'ct-foot' }, content.foot));
      tipBox.classList.remove('hidden');
    }
    function place(x, y) {
      var w = tipBox.offsetWidth, hh = tipBox.offsetHeight;
      var left = Math.min(Math.max(8, x + 14), innerWidth - w - 8), top = y - hh - 14;
      if (top < 8) top = y + 18;
      tipBox.style.left = left + 'px'; tipBox.style.top = top + 'px';
    }
    el.addEventListener('pointerenter', function (e) { fill(); place(e.clientX, e.clientY); });
    el.addEventListener('pointermove', function (e) { if (tipBox) place(e.clientX, e.clientY); });
    el.addEventListener('pointerleave', hideTip);
    el.addEventListener('focus', function () { fill(); var r = el.getBoundingClientRect(); place(r.left + r.width / 2, r.top); });
    el.addEventListener('blur', hideTip);
    el.setAttribute('aria-label', content.title + ': ' + (content.rows || []).map(function (r) { return r.value + ' ' + r.label; }).join(', '));
  }

  /* ---------- peças ---------- */
  function tile(label, value, o) {
    o = o || {};
    var delta = null;
    if (o.delta != null && isFinite(o.delta)) {
      var up = o.delta >= 0, good = o.upGood === false ? !up : up;
      delta = h('div', { class: 'delta ' + (o.delta === 0 ? '' : good ? 'good' : 'bad') },
        h('span', { class: 'dir' + (up ? '' : ' flip') }, icon('arrow-up-right', 13)),
        h('span', null, (up ? '+' : '') + u.num(o.delta) + '% ', h('span', { class: 'muted' }, 'vs. anterior')));
    }
    return h('div', { class: 'stat' }, h('div', { class: 'stat-label' }, label), h('div', { class: 'stat-value' }, value), delta, o.sub ? h('div', { class: 'stat-sub' }, o.sub) : null);
  }
  function pctChange(cur, prev) { if (!prev) return cur ? null : 0; return Math.round(((cur - prev) / prev) * 1000) / 10; }

  function simpleTable(headers, rows) {
    return h('div', { class: 'table-wrap flat chart-table' }, h('table', { class: 'table' },
      h('thead', null, h('tr', null, headers.map(function (c, i) { return h('th', { class: i ? 'num' : '' }, c); }))),
      h('tbody', null, rows.map(function (r) { return h('tr', null, r.map(function (c, i) { return h('td', { class: i ? 'num' : '' }, c); })); }))));
  }
  function chartCard(title, sub, chart, table, wide) {
    var view = 'chart';
    var body = h('div', { class: 'chart-body' });
    var seg = h('div', { class: 'seg seg-sm' });
    function draw() {
      u.clear(body); u.clear(seg);
      body.appendChild(view === 'chart' ? chart : table);
      [['chart', 'Gráfico', 'chart'], ['table', 'Tabela', 'table']].forEach(function (o) {
        seg.appendChild(h('button', { type: 'button', class: view === o[0] ? 'on' : '', 'aria-pressed': String(view === o[0]), 'aria-label': 'Ver ' + o[1].toLowerCase(), onclick: function () { view = o[0]; draw(); } }, icon(o[2], 14)));
      });
    }
    draw();
    return h('section', { class: 'card chart-card' + (wide ? ' wide' : '') }, h('header', { class: 'chart-head' }, h('div', null, h('h3', null, title), sub ? h('div', { class: 'chart-sub' }, sub) : null), seg), body);
  }

  // escala "limpa" (0, 5, 10, 15…) para o eixo y
  function niceScale(max, ticks, integer) {
    if (max <= 0) return { top: 1, step: 1, ticks: [0, 1] };
    var raw = max / (ticks || 4), mag = Math.pow(10, Math.floor(Math.log10(raw))), norm = raw / mag;
    var step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    if (integer) step = Math.max(1, Math.ceil(step));
    var top = Math.ceil(max / step) * step, out = [];
    for (var v = 0; v <= top + step / 1000; v += step) out.push(v);
    return { top: top, step: step, ticks: out };
  }

  function columnChart(o) {
    var maxV = 0;
    o.cats.forEach(function (c) { c.series.forEach(function (s) { maxV = Math.max(maxV, s.value); }); });
    var sc = niceScale(maxV, 4, o.integer), H = 190;
    var grid = sc.ticks.map(function (t) {
      return h('div', { class: 'gl', style: { bottom: (t / sc.top) * 100 + '%' } }, h('span', { class: 'gl-label' }, o.fmt(t)));
    });
    var groups = o.cats.map(function (c) {
      var g = h('div', { class: 'cgroup' }, c.series.map(function (s) {
        return h('div', { class: 'cbar', style: { height: (s.value / sc.top) * 100 + '%', background: s.color, display: s.value ? '' : 'none' } });
      }));
      bindTip(g, c.tip);
      return g;
    });
    return h('div', { class: 'cchart' },
      h('div', { class: 'cplot', style: { height: H + 'px' } }, grid, h('div', { class: 'cgroups' }, groups)),
      h('div', { class: 'cxlabels' }, o.cats.map(function (c) { return h('div', { class: 'cx' }, c.label); })),
      o.legend ? h('div', { class: 'legend' }, o.legend.map(function (l) { return h('span', { class: 'lg' }, h('span', { class: 'lg-key', style: { background: l.color } }), l.label); })) : null);
  }

  function hbarChart(o) {
    if (!o.rows.length) return h('p', { class: 'muted', style: { padding: '24px 0', textAlign: 'center' } }, o.emptyText || 'Sem dados no período.');
    var maxV = Math.max.apply(null, o.rows.map(function (r) { return r.value; })) || 1;
    return h('div', { class: 'hbars' }, o.rows.map(function (r) {
      var row = h('div', { class: 'hrow' },
        h('div', { class: 'hlabel', title: r.label }, r.icon ? icon(r.icon, 13) : null, r.icon ? ' ' : null, r.label),
        h('div', { class: 'htrack' },
          h('div', { class: 'hbar', style: { '--r': String(r.value / maxV), '--vw': (o.valueW || 70) + 'px', background: r.color || 'var(--chart-1)' } }),
          h('span', { class: 'hval' }, r.display || String(r.value), r.sub ? h('span', { class: 'muted hsub' }, ' ' + r.sub) : null)));
      bindTip(row, r.tip);
      return row;
    }));
  }

  /* ---------- tela ---------- */
  AX.views.insights = function (root) {
    var s = S.s;
    var period = S.prefs.get('insPeriod', '90d'), plF = S.prefs.get('insPipeline', 'all'), ownF = S.prefs.get('insOwner', 'all');
    if (plF !== 'all' && !q.pipeline(plF)) plF = 'all';
    if (ownF !== 'all' && !q.user(ownF)) ownF = 'all';
    var r = rangeOf(period), pr = prevRange(r, period), pLabel = PERIODS.filter(function (x) { return x.id === period; })[0].label.toLowerCase();

    var periodSel = ui.select(PERIODS.map(function (x) { return { value: x.id, label: x.label }; }), period, { class: 'select sm auto', 'aria-label': 'Período' });
    periodSel.addEventListener('change', function () { S.prefs.set('insPeriod', periodSel.value); AX.rerender(); });
    var plSel = s.pipelines.length > 1 ? ui.select([{ value: 'all', label: 'Todos os pipelines' }].concat(s.pipelines.map(function (p) { return { value: p.id, label: p.name }; })), plF, { class: 'select sm auto', 'aria-label': 'Pipeline' }) : null;
    if (plSel) plSel.addEventListener('change', function () { S.prefs.set('insPipeline', plSel.value); AX.rerender(); });
    var ownSel = s.users.length > 1 ? ui.select([{ value: 'all', label: 'Todos os responsáveis' }].concat(s.users.map(function (x) { return { value: x.id, label: x.name }; })), ownF, { class: 'select sm auto', 'aria-label': 'Responsável' }) : null;
    if (ownSel) ownSel.addEventListener('change', function () { S.prefs.set('insOwner', ownSel.value); AX.rerender(); });

    var head = h('div', { class: 'page-head' },
      h('div', null, h('h1', { class: 'page-title' }, 'Insights'), h('div', { class: 'page-sub' }, 'Como está o funil da Axon — ' + pLabel + '.')),
      h('span', { class: 'spacer' }), h('div', { class: 'toolbar filters' }, periodSel, plSel, ownSel));
    var page = h('div', { class: 'page-narrow' }, head);
    root.appendChild(page);

    var base = s.deals.filter(function (d) { return (plF === 'all' || d.pipelineId === plF) && (ownF === 'all' || d.ownerId === ownF); });
    if (!s.deals.length) {
      page.appendChild(ui.empty({ icon: 'chart', title: 'Ainda não há dados para analisar', text: 'Crie negócios ou carregue os dados de exemplo para ver o funil, a previsão de receita e o desempenho por origem.', action: { label: 'Carregar dados de exemplo', icon: 'sparkles', onClick: function () { S.reset(true); } } }));
      return;
    }

    /* métricas */
    var open = base.filter(function (d) { return d.status === 'open'; });
    var won = base.filter(function (d) { return d.status === 'won' && within(d.wonAt, r); });
    var lost = base.filter(function (d) { return d.status === 'lost' && within(d.lostAt, r); });
    var wonPrev = pr ? base.filter(function (d) { return d.status === 'won' && within(d.wonAt, pr); }) : [];
    var created = base.filter(function (d) { return within(d.createdAt, r); });
    var val = function (list) { return u.sum(list, function (d) { return Number(d.value) || 0; }); };
    var mrrOf = function (list) { return u.sum(list, function (d) { return Number(d.mrr) || 0; }); };
    var wonVal = val(won), wonValPrev = val(wonPrev);
    var closedN = won.length + lost.length, winRate = closedN ? (won.length / closedN) * 100 : null;
    var avgTicket = won.length ? wonVal / won.length : 0;
    var cycle = won.length ? u.sum(won, function (d) { return u.diffDays(u.toYmd(d.createdAt), u.toYmd(d.wonAt)); }) / won.length : null;
    var outCreated = created.filter(function (d) { var sr = q.source(d.sourceId); return sr && sr.group === 'outbound'; }).length;
    var acts = s.activities.filter(function (a) { return a.done && within(a.doneAt, r) && (ownF === 'all' || a.ownerId === ownF); });
    var overdueNow = s.activities.filter(function (a) { return q.isOverdue(a) && (ownF === 'all' || a.ownerId === ownF); }).length;

    page.appendChild(h('div', { class: 'stats' },
      tile('Receita ganha', u.money(wonVal, { compact: true }), { delta: pr ? pctChange(wonVal, wonValPrev) : null, sub: won.length + ' negócio(s)' + (mrrOf(won) ? ' · MRR +' + u.money(mrrOf(won), { compact: true }) : '') }),
      tile('Pipeline aberto', u.money(val(open), { compact: true }), { sub: open.length + ' negócio(s) · previsão ' + u.money(u.sum(open, q.weighted), { compact: true }) }),
      tile('Taxa de conversão', winRate == null ? '—' : u.num(Math.round(winRate * 10) / 10) + '%', { sub: won.length + ' ganho(s) · ' + lost.length + ' perdido(s)' }),
      tile('Ticket médio', won.length ? u.money(avgTicket, { compact: true }) : '—', { sub: cycle == null ? 'Sem ciclo no período' : 'Ciclo médio de ' + Math.round(cycle) + ' dias' }),
      tile('Novos negócios', String(created.length), { sub: created.length ? Math.round((outCreated / created.length) * 100) + '% via outbound · ' + u.money(val(created), { compact: true }) : 'Nenhum criado no período' }),
      tile('Atividades concluídas', String(acts.length), { sub: overdueNow ? overdueNow + ' atrasada(s) agora' : 'Nenhuma atrasada' })));

    var grid = h('div', { class: 'chart-grid' });
    page.appendChild(grid);

    /* 1 — funil por etapa (coorte: negócios criados no período) */
    var fpl = q.pipeline(plF === 'all' ? s.pipelines[0].id : plF);
    var cohort = base.filter(function (d) { return d.pipelineId === fpl.id && within(d.createdAt, r); });
    var reach = fpl.stages.map(function (st) { return cohort.filter(function (d) { return (d.history || []).some(function (x) { return x.stageId === st.id; }); }); });
    var wonCohort = cohort.filter(function (d) { return d.status === 'won'; });
    var funnelRows = reach.map(function (list, i) { return { label: fpl.stages[i].name, list: list }; }).concat([{ label: 'Ganhos', list: wonCohort }]);
    var top = funnelRows[0].list.length || 1, nStages = fpl.stages.length, rampStep = function (i) { return 'var(--ord-' + (Math.round(i * 4 / Math.max(nStages - 1, 1)) + 1) + ')'; };
    var funnel = funnelRows.map(function (fr, i) {
      var n = fr.list.length, prev = i ? funnelRows[i - 1].list.length : n, pTop = Math.round((n / top) * 100), pPrev = prev ? Math.round((n / prev) * 100) : 0;
      var isWon = i === funnelRows.length - 1;
      return { label: fr.label, icon: isWon ? 'trophy' : null, value: n, color: isWon ? 'var(--good)' : rampStep(i), display: String(n), sub: i ? pPrev + '% da anterior' : null, valueW: 150,
        tip: { title: fr.label, rows: [{ value: String(n), label: 'negócios' }, { value: u.money(val(fr.list)), label: 'em valor' }, { value: pTop + '%', label: 'do topo do funil' }].concat(i ? [{ value: pPrev + '%', label: 'da etapa anterior' }] : []) } };
    });
    grid.appendChild(chartCard('Funil de conversão', 'Negócios criados ' + pLabel + ' · ' + fpl.name, hbarChart({ rows: funnel, valueW: 150, emptyText: 'Nenhum negócio criado no período.' }),
      simpleTable(['Etapa', 'Negócios', '% do topo', '% da anterior', 'Valor'], funnel.map(function (f, i) { var n = f.value, prev = i ? funnel[i - 1].value : n; return [f.label, n, Math.round((n / top) * 100) + '%', i ? (prev ? Math.round((n / prev) * 100) + '%' : '—') : '—', u.money(val(funnelRows[i].list))]; })), true));

    /* 2 — ganhos × perdidos nos últimos 6 meses */
    var months = [], d0 = new Date();
    for (var i = 5; i >= 0; i--) { var dm = new Date(d0.getFullYear(), d0.getMonth() - i, 1); months.push(dm.getFullYear() + '-' + u.pad(dm.getMonth() + 1)); }
    var wl = months.map(function (mk) {
      var w = base.filter(function (d) { return d.status === 'won' && d.wonAt && u.monthKey(d.wonAt) === mk; }), l = base.filter(function (d) { return d.status === 'lost' && d.lostAt && u.monthKey(d.lostAt) === mk; });
      return { mk: mk, w: w, l: l };
    });
    grid.appendChild(chartCard('Ganhos × perdidos por mês', 'Negócios fechados nos últimos 6 meses',
      columnChart({ integer: true, fmt: function (v) { return String(v); }, legend: [{ label: 'Ganhos', color: 'var(--chart-1)' }, { label: 'Perdidos', color: 'var(--chart-muted)' }],
        cats: wl.map(function (m) { return { label: u.monthLabel(m.mk), series: [{ value: m.w.length, color: 'var(--chart-1)' }, { value: m.l.length, color: 'var(--chart-muted)' }],
          tip: { title: u.monthLabel(m.mk, true), rows: [{ value: String(m.w.length), label: 'ganhos · ' + u.money(val(m.w)), color: 'var(--chart-1)' }, { value: String(m.l.length), label: 'perdidos · ' + u.money(val(m.l)), color: 'var(--chart-muted)' }] } }; }) }),
      simpleTable(['Mês', 'Ganhos', 'Receita ganha', 'Perdidos', 'Valor perdido'], wl.map(function (m) { return [u.monthLabel(m.mk), m.w.length, u.money(val(m.w)), m.l.length, u.money(val(m.l))]; }))));

    /* 3 — previsão de receita por mês de fechamento previsto */
    var t0 = u.today(), fmonths = [];
    for (var j = 0; j < 6; j++) { var fm = new Date(d0.getFullYear(), d0.getMonth() + j, 1); fmonths.push(fm.getFullYear() + '-' + u.pad(fm.getMonth() + 1)); }
    var buckets = [{ key: 'late', label: 'Atrasados', list: open.filter(function (d) { return d.expectedClose && d.expectedClose < t0; }) }]
      .concat(fmonths.map(function (mk, idx) { return { key: mk, label: u.monthLabel(mk), list: open.filter(function (d) { return d.expectedClose && d.expectedClose >= t0 && u.monthKey(d.expectedClose) === mk; }) }; }),
        [{ key: 'later', label: 'Depois', list: open.filter(function (d) { return d.expectedClose && u.monthKey(d.expectedClose) > fmonths[5]; }) }, { key: 'none', label: 'Sem data', list: open.filter(function (d) { return !d.expectedClose; }) }]);
    var wsum = function (list) { return u.sum(list, q.weighted); };
    grid.appendChild(chartCard('Previsão de receita', 'Valor ponderado pela probabilidade da etapa · negócios abertos',
      columnChart({ fmt: function (v) { return u.money(v, { compact: true }).replace('R$ ', ''); },
        cats: buckets.map(function (b) { return { label: b.label, series: [{ value: wsum(b.list), color: 'var(--chart-1)' }],
          tip: { title: b.label, rows: [{ value: u.money(wsum(b.list)), label: 'previsto (ponderado)', color: 'var(--chart-1)' }, { value: u.money(val(b.list)), label: 'valor total' }, { value: String(b.list.length), label: 'negócio(s)' }] } }; }) }),
      simpleTable(['Fechamento previsto', 'Negócios', 'Valor total', 'Ponderado'], buckets.map(function (b) { return [b.label, b.list.length, u.money(val(b.list)), u.money(wsum(b.list))]; }))));

    /* 4 — origem dos negócios */
    var srcList = s.lists.sources.map(function (x) { return { id: x.id, name: x.name, group: x.group }; }).concat([{ id: null, name: 'Sem origem', group: 'other' }]);
    var srcRows = srcList.map(function (x) {
      var c = created.filter(function (d) { return (d.sourceId || null) === x.id; }), w = won.filter(function (d) { return (d.sourceId || null) === x.id; }), l = lost.filter(function (d) { return (d.sourceId || null) === x.id; });
      return { x: x, c: c, w: w, l: l };
    }).filter(function (z) { return z.c.length || z.w.length || z.l.length; });
    var bars = srcRows.slice().sort(function (a, b) { return b.c.length - a.c.length; }).filter(function (z) { return z.c.length; }).map(function (z) {
      return { label: z.x.name, value: z.c.length, display: String(z.c.length), tip: { title: z.x.name, rows: [{ value: String(z.c.length), label: 'negócios criados' }, { value: String(z.w.length), label: 'ganhos no período' }, { value: u.money(val(z.w)), label: 'receita ganha' }], foot: AX.SOURCE_GROUPS[z.x.group] } };
    });
    var groupCounts = {};
    created.forEach(function (d) { var g = (q.source(d.sourceId) || { group: 'other' }).group; groupCounts[g] = (groupCounts[g] || 0) + 1; });
    var split = Object.keys(AX.SOURCE_GROUPS).filter(function (g) { return groupCounts[g]; }).map(function (g) { return AX.SOURCE_GROUPS[g] + ' ' + Math.round((groupCounts[g] / created.length) * 100) + '%'; }).join(' · ');
    grid.appendChild(chartCard('Origem dos negócios', 'Criados ' + pLabel + (split ? ' · ' + split : ''), hbarChart({ rows: bars, emptyText: 'Nenhum negócio criado no período.' }),
      simpleTable(['Origem', 'Criados', 'Ganhos', 'Perdidos', 'Conversão', 'Receita ganha'], srcRows.map(function (z) { var cl = z.w.length + z.l.length; return [z.x.name, z.c.length, z.w.length, z.l.length, cl ? Math.round((z.w.length / cl) * 100) + '%' : '—', u.money(val(z.w))]; }))));

    /* 5 — motivos de perda */
    var lrMap = u.groupBy(lost, function (d) { return d.lostReasonId || '_none'; });
    var lrRows = Array.from(lrMap.entries()).map(function (e) { return { name: e[0] === '_none' ? 'Sem motivo' : (q.lostReason(e[0]) || { name: 'Removido' }).name, list: e[1] }; }).sort(function (a, b) { return b.list.length - a.list.length; });
    grid.appendChild(chartCard('Motivos de perda', 'Negócios perdidos ' + pLabel, hbarChart({ rows: lrRows.map(function (x) { return { label: x.name, value: x.list.length, display: String(x.list.length), sub: u.money(val(x.list), { compact: true }), valueW: 120, tip: { title: x.name, rows: [{ value: String(x.list.length), label: 'negócios' }, { value: u.money(val(x.list)), label: 'em valor perdido' }] } }; }), valueW: 120, emptyText: 'Nenhum negócio perdido no período.' }),
      simpleTable(['Motivo', 'Negócios', 'Valor perdido'], lrRows.map(function (x) { return [x.name, x.list.length, u.money(val(x.list))]; }))));

    /* 6 — atividades concluídas por tipo */
    var byType = AX.ACTIVITY_TYPES.map(function (t) { return { t: t, n: acts.filter(function (a) { return a.type === t.id; }).length }; }).filter(function (x) { return x.n; }).sort(function (a, b) { return b.n - a.n; });
    grid.appendChild(chartCard('Atividades concluídas', 'Por tipo ' + pLabel + ' · ritmo de prospecção', hbarChart({ rows: byType.map(function (x) { return { label: x.t.name, value: x.n, display: String(x.n), tip: { title: x.t.name, rows: [{ value: String(x.n), label: 'concluídas' }] } }; }), emptyText: 'Nenhuma atividade concluída no período.' }),
      simpleTable(['Tipo', 'Concluídas'], byType.map(function (x) { return [x.t.name, x.n]; }))));
  };
})(window.AX = window.AX || {});
