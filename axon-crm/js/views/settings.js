/* Axon CRM — Configurações: pipelines, listas, equipe, dados e backup */
(function (AX) {
  'use strict';
  var u = AX.u, h = u.h, icon = AX.icon, ui = AX.ui, S = AX.store, q = S.q;
  var editPipeline = null;

  var SECTIONS = [
    { id: 'pipelines', label: 'Pipelines e etapas', icon: 'kanban' },
    { id: 'lists', label: 'Listas e campos', icon: 'tag' },
    { id: 'team', label: 'Equipe', icon: 'users' },
    { id: 'data', label: 'Dados e backup', icon: 'download' }
  ];

  function numInput(value, o, onChange) {
    var el = h('input', { class: 'input sm', type: 'number', min: o.min, max: o.max, value: value, style: { width: o.w || '84px' }, 'aria-label': o.label });
    el.addEventListener('change', function () { onChange(Math.max(o.min, Math.min(o.max, Number(el.value) || 0))); });
    return el;
  }
  function textInput(value, label, onChange, w) {
    var el = h('input', { class: 'input sm', type: 'text', value: value, 'aria-label': label, style: w ? { width: w } : null });
    el.addEventListener('change', function () { var v = el.value.trim(); if (v && v !== value) onChange(v); else el.value = value; });
    return el;
  }

  /* ---------- pipelines ---------- */
  function pipelines() {
    var s = S.s;
    var pl = q.pipeline(editPipeline) || s.pipelines[0];
    editPipeline = pl.id;
    var counts = {};
    s.deals.forEach(function (d) { if (d.status === 'open') counts[d.stageId] = (counts[d.stageId] || 0) + 1; });
    var rows = pl.stages.map(function (st, i) {
      return h('tr', null,
        h('td', null, h('div', { class: 'toolbar', style: { gap: '2px', flexWrap: 'nowrap' } },
          h('button', { class: 'btn ghost icon sm', type: 'button', disabled: i === 0, 'aria-label': 'Mover etapa para cima', onclick: function () { S.moveStage(st.id, -1); } }, icon('chevron-left', 15, 'rot90'))
          , h('button', { class: 'btn ghost icon sm', type: 'button', disabled: i === pl.stages.length - 1, 'aria-label': 'Mover etapa para baixo', onclick: function () { S.moveStage(st.id, 1); } }, icon('chevron-right', 15, 'rot90')))),
        h('td', null, textInput(st.name, 'Nome da etapa', function (v) { S.updateStage(st.id, { name: v }); }, '230px')),
        h('td', null, numInput(st.prob, { min: 0, max: 100, label: 'Probabilidade %' }, function (v) { S.updateStage(st.id, { prob: v }); })),
        h('td', null, numInput(st.rot, { min: 0, max: 365, label: 'Dias para "parado"' }, function (v) { S.updateStage(st.id, { rot: v }); })),
        h('td', { class: 'num' }, counts[st.id] || 0),
        h('td', { class: 'right' }, h('button', { class: 'btn ghost icon sm', type: 'button', disabled: pl.stages.length < 2, 'aria-label': 'Excluir etapa', onclick: function () { removeStage(st); } }, icon('trash', 15))));
    });
    var newName = h('input', { class: 'input sm', type: 'text', placeholder: 'Nova etapa…', style: { width: '230px' }, 'aria-label': 'Nome da nova etapa' });
    var newProb = h('input', { class: 'input sm', type: 'number', min: 0, max: 100, value: 50, style: { width: '84px' }, 'aria-label': 'Probabilidade' });
    var add = function () { if (!newName.value.trim()) { newName.focus(); return; } S.addStage(pl.id, { name: newName.value, prob: Number(newProb.value) || 0, rot: 7 }); };
    newName.addEventListener('keydown', function (e) { if (e.key === 'Enter') add(); });

    return h('div', { class: 'stack' },
      h('div', { class: 'card' },
        h('div', { class: 'card-head' }, 'Pipelines'),
        h('div', { class: 'card-pad' },
          h('div', { class: 'toolbar' },
            ui.segmented(s.pipelines.map(function (p) { return { value: p.id, label: p.name }; }), pl.id, function (v) { editPipeline = v; AX.rerender(); }),
            h('button', { class: 'btn sm', type: 'button', onclick: function () {
              var inp = ui.textInput({ required: true, placeholder: 'Ex.: Pós-venda e upsell' });
              ui.modal({ title: 'Novo pipeline', size: 'sm', content: ui.field('Nome do pipeline', inp, { req: true }), submitText: 'Criar', onSubmit: function () { var n = S.addPipeline(inp.value); editPipeline = n.id; S.prefs.set('pipelineId', n.id); } });
            } }, icon('plus', 14), 'Novo pipeline'),
            h('button', { class: 'btn sm', type: 'button', onclick: function () {
              var inp = ui.textInput({ required: true, value: pl.name });
              ui.modal({ title: 'Renomear pipeline', size: 'sm', content: ui.field('Nome', inp, { req: true }), onSubmit: function () { S.renamePipeline(pl.id, inp.value); } });
            } }, icon('pencil', 14), 'Renomear'),
            h('button', { class: 'btn sm danger', type: 'button', onclick: function () {
              if (s.pipelines.length < 2) { ui.toast('É preciso manter ao menos um pipeline.', { kind: 'error' }); return; }
              if (s.deals.some(function (d) { return d.pipelineId === pl.id; })) { ui.toast('Este pipeline tem negócios. Mova ou exclua os negócios antes de apagá-lo.', { kind: 'error', duration: 5000 }); return; }
              ui.confirm({ title: 'Excluir pipeline', message: 'Excluir o pipeline “' + pl.name + '”?', confirmText: 'Excluir', danger: true }).then(function (ok) { if (ok) { S.deletePipeline(pl.id); editPipeline = null; } });
            } }, icon('trash', 14), 'Excluir')))),
      h('div', { class: 'card' },
        h('div', { class: 'card-head' }, 'Etapas de “' + pl.name + '”'),
        h('div', { class: 'table-wrap flat' }, h('table', { class: 'table' },
          h('thead', null, h('tr', null, [['Ordem', ''], ['Nome', ''], ['Probabilidade (%)', ''], ['Parado após (dias)', ''], ['Abertos', 'num'], ['', '']].map(function (c) { return h('th', { class: c[1] }, c[0]); }))),
          h('tbody', null, rows))),
        h('div', { class: 'card-pad toolbar', style: { borderTop: '1px solid var(--border)' } }, newName, newProb, h('button', { class: 'btn sm primary', type: 'button', onclick: add }, icon('plus', 14), 'Adicionar etapa')),
        h('div', { class: 'card-pad muted', style: { paddingTop: 0 } }, 'A probabilidade pondera a previsão de receita. “Parado após” marca o negócio em vermelho quando passa esse tempo na etapa (0 desativa).')));
  }
  function removeStage(st) {
    var si = q.stageInfo(st.id), others = si.pipeline.stages.filter(function (x) { return x.id !== st.id; });
    var affected = S.s.deals.filter(function (d) { return d.stageId === st.id; }).length;
    if (others.length < 1) return;
    var target = ui.select(others.map(function (x) { return { value: x.id, label: x.name }; }), others[0].id);
    ui.modal({
      title: 'Excluir etapa', size: 'sm', submitText: 'Excluir etapa', danger: true,
      content: h('div', { class: 'form-grid' },
        h('p', { class: 'full' }, 'Excluir a etapa “' + st.name + '”?' + (affected ? ' Há ' + affected + ' negócio(s) nela (incluindo ganhos/perdidos).' : '')),
        affected ? ui.field('Mover os negócios para', target, { full: true }) : null),
      onSubmit: function () { S.deleteStage(st.id, affected ? target.value : null); }
    });
  }

  /* ---------- listas ---------- */
  function listCard(name, title, hint, opts) {
    opts = opts || {};
    var items = S.s.lists[name];
    var rows = items.map(function (it) {
      return h('div', { class: 'list-row' },
        opts.color ? (function () { var c = h('input', { type: 'color', value: it.color, 'aria-label': 'Cor', class: 'color-input' }); c.addEventListener('change', function () { S.listUpdate(name, it.id, { color: c.value }); }); return c; })() : null,
        textInput(it.name, 'Nome', function (v) { S.listUpdate(name, it.id, { name: v }); }, '100%'),
        opts.group ? (function () { var g = ui.select(Object.keys(AX.SOURCE_GROUPS).map(function (k) { return { value: k, label: AX.SOURCE_GROUPS[k] }; }), it.group, { class: 'select sm auto', 'aria-label': 'Grupo' }); g.addEventListener('change', function () { S.listUpdate(name, it.id, { group: g.value }); }); return g; })() : null,
        h('button', { class: 'btn ghost icon sm', type: 'button', 'aria-label': 'Remover ' + it.name, onclick: function () { ui.withUndo('“' + it.name + '” removido', function () { S.listRemove(name, it.id); }); } }, icon('trash', 15)));
    });
    var inp = h('input', { class: 'input sm', type: 'text', placeholder: 'Adicionar…', 'aria-label': 'Adicionar a ' + title });
    var add = function () {
      var v = inp.value.trim(); if (!v) { inp.focus(); return; }
      var item = { name: v }; if (opts.color) item.color = '#7a8296'; if (opts.group) item.group = 'outbound';
      S.listAdd(name, item);
    };
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    return h('div', { class: 'card' }, h('div', { class: 'card-head' }, title, h('span', { class: 'count-pill' }, items.length)),
      h('div', { class: 'card-pad stack-sm' }, hint ? h('p', { class: 'muted' }, hint) : null, rows, h('div', { class: 'list-row' }, inp, h('button', { class: 'btn sm primary', type: 'button', onclick: add }, icon('plus', 14), 'Adicionar'))));
  }
  function lists() {
    return h('div', { class: 'stack' },
      listCard('sources', 'Origens', 'O grupo (Outbound, Inbound…) alimenta o comparativo do painel de Insights.', { group: true }),
      listCard('lostReasons', 'Motivos de perda', 'Aparecem ao marcar um negócio como perdido e nos relatórios.'),
      listCard('labels', 'Etiquetas', 'Temperatura ou prioridade do negócio.', { color: true }),
      listCard('projectTypes', 'Tipos de projeto'));
  }

  /* ---------- equipe ---------- */
  function team() {
    var s = S.s;
    var rows = s.users.map(function (x) {
      var isMe = x.id === s.currentUser;
      var color = h('input', { type: 'color', value: x.color, class: 'color-input', 'aria-label': 'Cor de ' + x.name });
      color.addEventListener('change', function () { S.updateUser(x.id, { color: color.value }); });
      return h('div', { class: 'list-row' }, ui.avatar(x, 'lg'), color, textInput(x.name, 'Nome', function (v) { S.updateUser(x.id, { name: v }); }, '100%'),
        isMe ? h('span', { class: 'badge accent' }, 'Você') : h('button', { class: 'btn sm', type: 'button', onclick: function () { s.currentUser = x.id; S.commit(); } }, 'Usar como eu'),
        h('button', { class: 'btn ghost icon sm', type: 'button', disabled: isMe || s.users.length < 2, 'aria-label': 'Remover ' + x.name, onclick: function () {
          ui.confirm({ title: 'Remover usuário', message: 'Remover “' + x.name + '”? Os registros dele passam para você.', confirmText: 'Remover', danger: true }).then(function (ok) { if (ok) S.removeUser(x.id); });
        } }, icon('trash', 15)));
    });
    var inp = h('input', { class: 'input sm', type: 'text', placeholder: 'Nome do novo vendedor…', 'aria-label': 'Nome do novo membro' });
    var add = function () { if (!inp.value.trim()) { inp.focus(); return; } S.addUser(inp.value); };
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') add(); });
    var company = textInput(s.profile.company || '', 'Empresa', function (v) { S.setProfile({ company: v }); }, '280px');
    return h('div', { class: 'stack' },
      h('div', { class: 'card' }, h('div', { class: 'card-head' }, 'Empresa'), h('div', { class: 'card-pad' }, ui.field('Nome da empresa', company))),
      h('div', { class: 'card' }, h('div', { class: 'card-head' }, 'Equipe comercial', h('span', { class: 'count-pill' }, s.users.length)),
        h('div', { class: 'card-pad stack-sm' }, h('p', { class: 'muted' }, 'Os usuários servem para atribuir responsáveis. Esta versão roda no navegador, sem login: “Você” é quem está usando este computador.'), rows,
          h('div', { class: 'list-row' }, inp, h('button', { class: 'btn sm primary', type: 'button', onclick: add }, icon('plus', 14), 'Adicionar')))));
  }

  /* ---------- dados ---------- */
  var EXPORTS = {
    deals: { label: 'Negócios', file: 'negocios', cols: [
      { label: 'Título', get: function (d) { return d.title; } }, { label: 'Organização', get: function (d) { return q.orgName(d.orgId); } }, { label: 'Pessoa', get: function (d) { return q.personName(d.personId); } },
      { label: 'Valor', get: function (d) { return d.value; } }, { label: 'MRR', get: function (d) { return d.mrr; } },
      { label: 'Pipeline', get: function (d) { return (q.pipeline(d.pipelineId) || {}).name; } }, { label: 'Etapa', get: function (d) { return (q.stageInfo(d.stageId) || { stage: {} }).stage.name; } },
      { label: 'Status', get: function (d) { return d.status === 'won' ? 'Ganho' : d.status === 'lost' ? 'Perdido' : 'Aberto'; } },
      { label: 'Fechamento previsto', get: function (d) { return d.expectedClose; } }, { label: 'Origem', get: function (d) { return (q.source(d.sourceId) || {}).name; } },
      { label: 'Tipo de projeto', get: function (d) { return (q.projectType(d.projectTypeId) || {}).name; } }, { label: 'Etiqueta', get: function (d) { return (q.label(d.labelId) || {}).name; } },
      { label: 'Responsável', get: function (d) { return (q.user(d.ownerId) || {}).name; } }, { label: 'Criado em', get: function (d) { return u.toYmd(d.createdAt); } },
      { label: 'Ganho em', get: function (d) { return u.toYmd(d.wonAt); } }, { label: 'Perdido em', get: function (d) { return u.toYmd(d.lostAt); } },
      { label: 'Motivo da perda', get: function (d) { return (q.lostReason(d.lostReasonId) || {}).name; } }, { label: 'Site atual', get: function (d) { return d.siteUrl; } }
    ] },
    persons: { label: 'Pessoas', file: 'pessoas', cols: [
      { label: 'Nome', get: function (p) { return p.name; } }, { label: 'Cargo', get: function (p) { return p.role; } }, { label: 'Organização', get: function (p) { return q.orgName(p.orgId); } },
      { label: 'E-mail', get: function (p) { return p.email; } }, { label: 'Telefone', get: function (p) { return p.phone; } }, { label: 'LinkedIn', get: function (p) { return p.linkedin; } },
      { label: 'Responsável', get: function (p) { return (q.user(p.ownerId) || {}).name; } }, { label: 'Criado em', get: function (p) { return u.toYmd(p.createdAt); } }
    ] },
    orgs: { label: 'Organizações', file: 'organizacoes', cols: [
      { label: 'Nome', get: function (o) { return o.name; } }, { label: 'Site', get: function (o) { return o.website; } }, { label: 'Segmento', get: function (o) { return o.segment; } },
      { label: 'Cidade', get: function (o) { return o.city; } }, { label: 'Telefone', get: function (o) { return o.phone; } }, { label: 'CNPJ', get: function (o) { return o.cnpj; } },
      { label: 'Responsável', get: function (o) { return (q.user(o.ownerId) || {}).name; } }
    ] },
    leads: { label: 'Leads', file: 'leads', cols: [
      { label: 'Título', get: function (l) { return l.title; } }, { label: 'Empresa', get: function (l) { return l.orgName; } }, { label: 'Contato', get: function (l) { return l.personName; } },
      { label: 'Cargo', get: function (l) { return l.role; } }, { label: 'E-mail', get: function (l) { return l.email; } }, { label: 'Telefone', get: function (l) { return l.phone; } },
      { label: 'Site', get: function (l) { return l.website; } }, { label: 'Origem', get: function (l) { return (q.source(l.sourceId) || {}).name; } }, { label: 'Valor', get: function (l) { return l.value; } },
      { label: 'Observações', get: function (l) { return l.note; } }, { label: 'Status', get: function (l) { return l.convertedDealId ? 'Convertido' : l.archived ? 'Arquivado' : 'Na caixa'; } }, { label: 'Criado em', get: function (l) { return u.toYmd(l.createdAt); } }
    ] },
    activities: { label: 'Atividades', file: 'atividades', cols: [
      { label: 'Tipo', get: function (a) { return q.actType(a.type).name; } }, { label: 'Assunto', get: function (a) { return a.subject; } }, { label: 'Data', get: function (a) { return a.dueDate; } },
      { label: 'Hora', get: function (a) { return a.dueTime; } }, { label: 'Concluída', get: function (a) { return a.done ? 'Sim' : 'Não'; } }, { label: 'Negócio', get: function (a) { return (q.deal(a.dealId) || {}).title; } },
      { label: 'Pessoa', get: function (a) { return q.personName(a.personId); } }, { label: 'Organização', get: function (a) { return q.orgName(a.orgId); } },
      { label: 'Responsável', get: function (a) { return (q.user(a.ownerId) || {}).name; } }, { label: 'Observações', get: function (a) { return a.note; } }
    ] }
  };
  function exportCsv(key) {
    var def = EXPORTS[key], list = key === 'persons' ? S.s.persons : key === 'orgs' ? S.s.orgs : S.s[key];
    u.download('axon-' + def.file + '-' + u.today() + '.csv', u.toCSV(def.cols, list), 'text/csv;charset=utf-8');
    ui.toast(def.label + ' exportados (' + list.length + ')', { kind: 'success' });
  }
  function data() {
    var s = S.s, file = h('input', { type: 'file', accept: '.json,application/json', class: 'hidden', 'aria-label': 'Arquivo de backup' });
    file.addEventListener('change', function () {
      var f = file.files[0]; if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        ui.confirm({ title: 'Restaurar backup', message: 'Restaurar “' + f.name + '”? Isso substitui TODOS os dados atuais por os do arquivo.', detail: 'Se quiser manter os dados atuais, exporte um backup antes.', confirmText: 'Restaurar', danger: true }).then(function (ok) {
          if (!ok) return;
          var snap = S.snapshot(), r = S.importJSON(String(fr.result));
          if (!r.ok) ui.toast(r.error, { kind: 'error', duration: 5000 });
          else ui.toast('Backup restaurado (' + r.deals + ' negócios)', { kind: 'success', action: { label: 'Desfazer', fn: function () { S.restore(snap); } } });
        });
      };
      fr.readAsText(f, 'utf-8'); file.value = '';
    });
    var kb = Math.round(JSON.stringify(s).length / 1024);
    return h('div', { class: 'stack' },
      h('div', { class: 'card' }, h('div', { class: 'card-head' }, icon('download', 16), 'Backup'),
        h('div', { class: 'card-pad stack-sm' },
          h('p', { class: 'text-2' }, 'Os dados ficam salvos neste navegador (' + kb + ' KB em uso). Exporte um backup com frequência — ele também serve para levar seus dados a outro computador ou navegador.'),
          h('p', { class: 'muted' }, s.lastBackupAt ? 'Último backup: ' + u.fmtDate(s.lastBackupAt) + ' às ' + u.fmtTime(s.lastBackupAt) + '.' : 'Nenhum backup exportado ainda.'),
          h('div', { class: 'toolbar' }, h('button', { class: 'btn primary', type: 'button', onclick: AX.exportBackup }, icon('download', 15), 'Exportar backup (JSON)'),
            h('button', { class: 'btn', type: 'button', onclick: function () { file.click(); } }, icon('upload', 15), 'Restaurar backup…'), file))),
      h('div', { class: 'card' }, h('div', { class: 'card-head' }, icon('table', 16), 'Exportar e importar planilhas (CSV)'),
        h('div', { class: 'card-pad stack-sm' }, h('p', { class: 'text-2' }, 'CSV com separador “;” e acentos preservados — abre direto no Excel e no Google Sheets.'),
          h('div', { class: 'toolbar' }, Object.keys(EXPORTS).map(function (k) { return h('button', { class: 'btn', type: 'button', onclick: function () { exportCsv(k); } }, icon('download', 14), EXPORTS[k].label); })),
          h('div', { class: 'toolbar' }, h('button', { class: 'btn', type: 'button', onclick: function () { AX.forms.importLeads(); } }, icon('upload', 15), 'Importar leads (CSV)')))),
      h('div', { class: 'card' }, h('div', { class: 'card-head' }, icon('alert-triangle', 16), 'Zona de risco'),
        h('div', { class: 'card-pad stack-sm' },
          h('div', { class: 'toolbar' },
            h('button', { class: 'btn', type: 'button', onclick: function () {
              ui.confirm({ title: 'Carregar dados de exemplo', message: 'Substituir os dados atuais por dados de exemplo?', detail: 'Útil para explorar o CRM. Seus dados atuais serão apagados (dá para desfazer logo em seguida).', confirmText: 'Carregar exemplo', danger: true }).then(function (ok) {
                if (ok) { var snap = S.snapshot(); S.reset(true); ui.toast('Dados de exemplo carregados', { kind: 'success', action: { label: 'Desfazer', fn: function () { S.restore(snap); } } }); }
              });
            } }, icon('sparkles', 15), 'Carregar dados de exemplo'),
            h('button', { class: 'btn danger', type: 'button', onclick: function () {
              ui.confirm({ title: 'Apagar todos os dados', message: 'Apagar TODOS os negócios, pessoas, leads e atividades?', detail: 'A configuração de pipelines, listas e produtos volta ao padrão. Exporte um backup antes — esta ação só pode ser desfeita logo em seguida.', confirmText: 'Apagar tudo', danger: true }).then(function (ok) {
                if (ok) { var snap = S.snapshot(); S.reset(false); ui.toast('Dados apagados', { action: { label: 'Desfazer', fn: function () { S.restore(snap); } } }); }
              });
            } }, icon('trash', 15), 'Apagar todos os dados')))));
  }

  AX.views.settings = function (root, params) {
    var section = params.arg || 'pipelines';
    if (!SECTIONS.some(function (x) { return x.id === section; })) section = 'pipelines';
    var body = section === 'pipelines' ? pipelines() : section === 'lists' ? lists() : section === 'team' ? team() : data();
    root.appendChild(h('div', { class: 'page-narrow' },
      h('div', { class: 'page-head' }, h('div', null, h('h1', { class: 'page-title' }, 'Configurações'), h('div', { class: 'page-sub' }, 'Adapte o CRM ao seu processo comercial.'))),
      h('div', { class: 'settings-grid' },
        h('nav', { class: 'settings-nav', 'aria-label': 'Seções' }, SECTIONS.map(function (x) {
          return h('a', { href: '#/settings/' + x.id, class: 'settings-link' + (x.id === section ? ' on' : ''), 'aria-current': x.id === section ? 'page' : null }, icon(x.icon, 16), x.label);
        })),
        h('div', { style: { minWidth: 0 } }, body))));
  };
})(window.AX = window.AX || {});
