/* Axon CRM — formulários em modal (negócio, atividade, pessoa, organização, lead, perda, importação…) */
(function (AX) {
  'use strict';
  var u = AX.u, h = u.h, icon = AX.icon, ui = AX.ui, S = AX.store, q = S.q;
  var F = {};

  function ownerOpts() { return S.s.users.map(function (x) { return { value: x.id, label: x.name }; }); }
  function listOpts(name, blank) {
    return [{ value: '', label: blank || '—' }].concat(S.s.lists[name].map(function (x) { return { value: x.id, label: x.name }; }));
  }
  function go(hash) { AX.nav(hash); }
  function row(children) { return h('div', { class: 'form-grid' }, children); }

  function orgPicker(value, onChange) {
    return ui.picker({
      placeholder: 'Buscar ou criar organização…', value: value, onChange: onChange,
      items: function () { return S.s.orgs.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'pt-BR'); }).map(function (o) { return { id: o.id, label: o.name, sub: o.city || o.segment }; }); },
      onCreate: function (name) { return S.addOrg({ name: name }).id; }
    });
  }
  function personPicker(value, getOrgId, onChange) {
    return ui.picker({
      placeholder: 'Buscar ou criar pessoa…', value: value, onChange: onChange,
      items: function () {
        var org = getOrgId && getOrgId();
        return S.s.persons.slice().sort(function (a, b) {
          var am = org && a.orgId === org ? 0 : 1, bm = org && b.orgId === org ? 0 : 1;
          return am - bm || a.name.localeCompare(b.name, 'pt-BR');
        }).map(function (p) { return { id: p.id, label: p.name, sub: q.orgName(p.orgId) || p.role }; });
      },
      onCreate: function (name) { return S.addPerson({ name: name, orgId: getOrgId && getOrgId() }).id; }
    });
  }

  /* ---------- negócio ---------- */
  F.deal = function (o) {
    o = o || {};
    var d = o.deal, def = o.defaults || {}, s = S.s;
    var pl0 = q.pipeline(d ? d.pipelineId : def.pipelineId) || s.pipelines[0];
    var lockedValue = d && d.products && d.products.length;
    var autoTitle = '';

    var title = ui.textInput({ placeholder: 'Ex.: Clínica Sorriso — Site institucional', required: true, value: d ? d.title : '' });
    var orgP = orgPicker(d ? d.orgId : def.orgId, function (id) {
      if (id && personP.value) { var p = q.person(personP.value); if (p && p.orgId && p.orgId !== id) personP.setValue(null); }
      suggestTitle();
    });
    var personP = personPicker(d ? d.personId : def.personId, function () { return orgP.value; }, function (id) {
      var p = id && q.person(id);
      if (p && p.orgId && !orgP.value) { orgP.setValue(p.orgId); suggestTitle(); }
    });
    var value = ui.moneyInput(d ? d.value : def.value, lockedValue ? { disabled: true } : null);
    var mrr = ui.moneyInput(d ? d.mrr : 0, lockedValue ? { disabled: true } : null);
    var pipeSel = ui.select(s.pipelines.map(function (p) { return { value: p.id, label: p.name }; }), pl0.id);
    var stageSel = ui.select([], '');
    function fillStages(plId, keep) {
      var pl = q.pipeline(plId);
      u.clear(stageSel);
      pl.stages.forEach(function (st) { stageSel.appendChild(h('option', { value: st.id }, st.name + ' (' + st.prob + '%)')); });
      stageSel.value = keep && pl.stages.some(function (x) { return x.id === keep; }) ? keep : pl.stages[0].id;
    }
    fillStages(pl0.id, d ? d.stageId : def.stageId);
    pipeSel.addEventListener('change', function () { fillStages(pipeSel.value); });
    var close = h('input', { class: 'input', type: 'date', value: d ? d.expectedClose : '' });
    var owner = ui.select(ownerOpts(), d ? d.ownerId : s.currentUser);
    var label = ui.select(listOpts('labels', 'Sem etiqueta'), d ? d.labelId : def.labelId || '');
    var source = ui.select(listOpts('sources', 'Selecione…'), d ? d.sourceId : def.sourceId || '');
    var ptype = ui.select(listOpts('projectTypes', 'Selecione…'), d ? d.projectTypeId : '');
    var site = ui.textInput({ placeholder: 'https://…', value: d ? d.siteUrl : '' });

    function suggestTitle() {
      var org = q.org(orgP.value), pt = q.projectType(ptype.value);
      var next = org ? org.name + (pt ? ' — ' + pt.name : '') : '';
      if (!title.value.trim() || title.value === autoTitle) { title.value = next; autoTitle = next; }
    }
    ptype.addEventListener('change', suggestTitle);
    orgP.addEventListener('focusout', function () { setTimeout(suggestTitle, 160); });

    var content = h('div', null,
      row([
        ui.field('Título do negócio', title, { req: true, full: true }),
        ui.field('Organização', orgP), ui.field('Pessoa de contato', personP),
        ui.field('Valor do projeto', value, { hint: lockedValue ? 'Calculado pelos produtos do negócio.' : null }),
        ui.field('Recorrência mensal (MRR)', mrr, { hint: lockedValue ? 'Calculado pelos produtos do negócio.' : 'Manutenção, hospedagem, SEO…' }),
        ui.field('Pipeline', pipeSel), ui.field('Etapa', stageSel),
        ui.field('Fechamento previsto', close), ui.field('Responsável', owner),
        ui.field('Tipo de projeto', ptype), ui.field('Origem', source),
        ui.field('Etiqueta', label), ui.field('Site atual do cliente', site)
      ]));
    return ui.modal({
      title: d ? 'Editar negócio' : 'Novo negócio', size: 'lg', content: content, submitText: d ? 'Salvar' : 'Criar negócio',
      onSubmit: function () {
        var patch = {
          title: title.value, orgId: orgP.value, personId: personP.value, expectedClose: close.value, ownerId: owner.value,
          labelId: label.value || null, sourceId: source.value || null, projectTypeId: ptype.value || null, siteUrl: site.value.trim()
        };
        if (!lockedValue) { patch.value = value.get(); patch.mrr = mrr.get(); }
        var res;
        if (d) {
          S.updateDeal(d.id, patch);
          if (stageSel.value !== d.stageId) S.moveDeal(d.id, stageSel.value);
          res = q.deal(d.id);
        } else {
          patch.pipelineId = pipeSel.value; patch.stageId = stageSel.value;
          res = S.addDeal(patch);
          ui.toast('Negócio criado', { kind: 'success', action: { label: 'Abrir', fn: function () { go('#/deal/' + res.id); } } });
        }
        if (o.onSaved) o.onSaved(res);
      }
    });
  };

  /* ---------- atividade ---------- */
  F.activity = function (o) {
    o = o || {};
    var a = o.activity, def = o.defaults || {}, s = S.s;
    var type = a ? a.type : def.type || 'call';
    var chips = h('div', { class: 'type-chips', role: 'radiogroup', 'aria-label': 'Tipo de atividade' });
    var subject = ui.textInput({ placeholder: 'Ex.: Ligar para o decisor', value: a ? a.subject : '' });
    function drawChips() {
      u.clear(chips);
      AX.ACTIVITY_TYPES.forEach(function (t) {
        chips.appendChild(h('button', {
          type: 'button', role: 'radio', 'aria-checked': String(t.id === type), class: 'type-chip' + (t.id === type ? ' on' : ''),
          onclick: function () { type = t.id; drawChips(); subject.placeholder = t.name; }
        }, icon(t.icon, 15), t.name));
      });
    }
    drawChips();
    subject.placeholder = q.actType(type).name;
    var date = h('input', { class: 'input', type: 'date', required: true, value: a ? a.dueDate : def.dueDate || u.today() });
    var time = h('input', { class: 'input', type: 'time', value: a ? a.dueTime : def.dueTime || '' });
    var dur = ui.select([{ value: '0', label: 'Sem duração' }, { value: '15', label: '15 min' }, { value: '30', label: '30 min' }, { value: '45', label: '45 min' }, { value: '60', label: '1 h' }, { value: '90', label: '1 h 30' }, { value: '120', label: '2 h' }],
      String(a ? a.duration || 0 : (type === 'meeting' ? 45 : 0)));
    var quick = h('div', { class: 'toolbar', style: { marginTop: '6px', gap: '6px' } }, [['Hoje', 0], ['Amanhã', 1], ['Em 3 dias', 3], ['Próx. semana', 7]].map(function (p) {
      return h('button', { type: 'button', class: 'btn sm', onclick: function () { date.value = u.addDays(u.today(), p[1]); } }, p[0]);
    }));
    var dealP = ui.picker({
      placeholder: 'Vincular a um negócio…', value: a ? a.dealId : def.dealId,
      items: function () {
        return S.s.deals.filter(function (d) { return d.status === 'open' || d.id === (a && a.dealId) || d.id === def.dealId; })
          .map(function (d) { return { id: d.id, label: d.title, sub: q.orgName(d.orgId) }; });
      },
      onChange: function (id) { var d = id && q.deal(id); if (d) { if (!personP.value && d.personId) personP.setValue(d.personId); } }
    });
    var personP = personPicker(a ? a.personId : def.personId, function () { var d = q.deal(dealP.value); return d && d.orgId; });
    var owner = ui.select(ownerOpts(), a ? a.ownerId : s.currentUser);
    var note = h('textarea', { class: 'textarea', placeholder: 'Detalhes, pauta ou resultado…', style: { minHeight: '70px' } });
    note.value = a ? a.note || '' : '';
    var doneBox = h('input', { type: 'checkbox', checked: a ? a.done : false });

    var content = h('div', null,
      h('div', { class: 'field', style: { marginBottom: '14px' } }, h('div', { class: 'lbl' }, 'Tipo'), chips),
      row([
        ui.field('Assunto', subject, { full: true }),
        h('div', { class: 'field' }, ui.field('Data', date, { req: true }), quick), ui.field('Horário', time),
        ui.field('Duração', dur), ui.field('Responsável', owner),
        ui.field('Negócio', dealP), ui.field('Pessoa', personP),
        ui.field('Observações', note, { full: true }),
        h('label', { class: 'check full' }, doneBox, 'Marcar como concluída')
      ]));
    var api;
    api = ui.modal({
      title: a ? 'Editar atividade' : 'Nova atividade', size: 'lg', content: content, submitText: a ? 'Salvar' : 'Agendar',
      footerLeft: a ? h('button', { type: 'button', class: 'btn danger', onclick: function () {
        var snap = S.snapshot(); S.deleteActivity(a.id); ui.toast('Atividade excluída', { action: { label: 'Desfazer', fn: function () { S.restore(snap); } } });
        api.close();
      } }, icon('trash', 15), 'Excluir') : null,
      onSubmit: function () {
        var d = q.deal(dealP.value), p = q.person(personP.value);
        var f = {
          type: type, subject: subject.value, dueDate: date.value, dueTime: time.value, duration: Number(dur.value), ownerId: owner.value,
          dealId: dealP.value || null, personId: personP.value || null, orgId: (p && p.orgId) || (d && d.orgId) || (a && a.orgId) || def.orgId || null, note: note.value, leadId: def.leadId || (a && a.leadId) || null
        };
        if (a) {
          f.subject = f.subject.trim() || q.actType(type).name;
          var wasDone = a.done;
          f.done = doneBox.checked; f.doneAt = f.done ? (wasDone ? a.doneAt : u.nowIso()) : null;
          S.updateActivity(a.id, f);
        } else { f.done = doneBox.checked; S.addActivity(f); ui.toast(f.done ? 'Atividade registrada' : 'Atividade agendada', { kind: 'success' }); }
        if (o.onSaved) o.onSaved();
      }
    });
    return api;
  };

  /* ---------- pessoa / organização ---------- */
  F.person = function (o) {
    o = o || {};
    var p = o.person, def = o.defaults || {};
    var name = ui.textInput({ required: true, placeholder: 'Nome completo', value: p ? p.name : '' });
    var role = ui.textInput({ placeholder: 'Ex.: Sócio, Diretora de marketing', value: p ? p.role : '' });
    var email = ui.textInput({ type: 'email', placeholder: 'nome@empresa.com.br', value: p ? p.email : '' });
    var phone = ui.textInput({ type: 'tel', placeholder: '(11) 99999-9999', value: p ? p.phone : '' });
    var linkedin = ui.textInput({ placeholder: 'linkedin.com/in/…', value: p ? p.linkedin : '' });
    var orgP = orgPicker(p ? p.orgId : def.orgId);
    var owner = ui.select(ownerOpts(), p ? p.ownerId : S.s.currentUser);
    return ui.modal({
      title: p ? 'Editar pessoa' : 'Nova pessoa', content: row([
        ui.field('Nome', name, { req: true, full: true }), ui.field('Organização', orgP), ui.field('Cargo', role),
        ui.field('E-mail', email), ui.field('Telefone / WhatsApp', phone), ui.field('LinkedIn', linkedin), ui.field('Responsável', owner)
      ]),
      onSubmit: function () {
        var f = { name: name.value.trim(), role: role.value.trim(), email: email.value.trim(), phone: phone.value.trim(), linkedin: linkedin.value.trim(), orgId: orgP.value, ownerId: owner.value };
        var res = p ? S.updatePerson(p.id, f) : S.addPerson(f);
        if (o.onSaved) o.onSaved(res);
      }
    });
  };
  F.org = function (o) {
    o = o || {};
    var g = o.org;
    var name = ui.textInput({ required: true, placeholder: 'Razão social ou nome fantasia', value: g ? g.name : '' });
    var site = ui.textInput({ placeholder: 'empresa.com.br', value: g ? g.website : '' });
    var segment = ui.textInput({ placeholder: 'Ex.: Odontologia, Varejo', value: g ? g.segment : '' });
    var city = ui.textInput({ placeholder: 'Cidade, UF', value: g ? g.city : '' });
    var phone = ui.textInput({ type: 'tel', value: g ? g.phone : '' });
    var cnpj = ui.textInput({ placeholder: '00.000.000/0000-00', value: g ? g.cnpj : '' });
    var owner = ui.select(ownerOpts(), g ? g.ownerId : S.s.currentUser);
    return ui.modal({
      title: g ? 'Editar organização' : 'Nova organização', content: row([
        ui.field('Nome', name, { req: true, full: true }), ui.field('Site', site), ui.field('Segmento', segment),
        ui.field('Cidade', city), ui.field('Telefone', phone), ui.field('CNPJ', cnpj), ui.field('Responsável', owner)
      ]),
      onSubmit: function () {
        var f = { name: name.value.trim(), website: site.value.trim(), segment: segment.value.trim(), city: city.value.trim(), phone: phone.value.trim(), cnpj: cnpj.value.trim(), ownerId: owner.value };
        var res = g ? S.updateOrg(g.id, f) : S.addOrg(f);
        if (o.onSaved) o.onSaved(res);
      }
    });
  };

  /* ---------- lead ---------- */
  F.lead = function (o) {
    o = o || {};
    var l = o.lead;
    var org = ui.textInput({ placeholder: 'Nome da empresa', value: l ? l.orgName : '' });
    var person = ui.textInput({ placeholder: 'Nome do contato', value: l ? l.personName : '' });
    var role = ui.textInput({ placeholder: 'Cargo', value: l ? l.role : '' });
    var email = ui.textInput({ type: 'email', value: l ? l.email : '' });
    var phone = ui.textInput({ type: 'tel', value: l ? l.phone : '' });
    var site = ui.textInput({ placeholder: 'empresa.com.br', value: l ? l.website : '' });
    var source = ui.select(listOpts('sources', 'Selecione…'), l ? l.sourceId : 'sr_li');
    var label = ui.select(listOpts('labels', 'Sem etiqueta'), l ? l.labelId : '');
    var value = ui.moneyInput(l ? l.value : 0);
    var note = h('textarea', { class: 'textarea', placeholder: 'Contexto, gancho de abordagem, link da lista…' }); note.value = l ? l.note : '';
    return ui.modal({
      title: l ? 'Editar lead' : 'Novo lead', size: 'lg', content: row([
        ui.field('Empresa', org), ui.field('Contato', person), ui.field('Cargo', role), ui.field('E-mail', email),
        ui.field('Telefone / WhatsApp', phone), ui.field('Site', site), ui.field('Origem', source), ui.field('Etiqueta', label),
        ui.field('Valor estimado', value), ui.field('Observações', note, { full: true })
      ]),
      onSubmit: function () {
        if (!org.value.trim() && !person.value.trim()) { ui.toast('Informe ao menos a empresa ou o contato.', { kind: 'error' }); return false; }
        var f = { orgName: org.value.trim(), personName: person.value.trim(), role: role.value.trim(), email: email.value.trim(), phone: phone.value.trim(), website: site.value.trim(), sourceId: source.value || null, labelId: label.value || null, value: value.get(), note: note.value };
        f.title = f.orgName || f.personName;
        if (l) S.updateLead(l.id, f); else { S.addLead(f); ui.toast('Lead adicionado à caixa de entrada', { kind: 'success' }); }
        if (o.onSaved) o.onSaved();
      }
    });
  };
  F.convertLead = function (lead, onDone) {
    var pl = S.s.pipelines[0];
    var pipeSel = ui.select(S.s.pipelines.map(function (p) { return { value: p.id, label: p.name }; }), pl.id);
    var stageSel = ui.select([], '');
    function fill() { var p = q.pipeline(pipeSel.value); u.clear(stageSel); p.stages.forEach(function (st) { stageSel.appendChild(h('option', { value: st.id }, st.name)); }); }
    fill(); pipeSel.addEventListener('change', fill);
    return ui.modal({
      title: 'Converter lead em negócio', size: 'sm',
      content: h('div', { class: 'form-grid' },
        h('p', { class: 'full text-2' }, 'Serão criados (ou reaproveitados) a organização “', lead.orgName || '—', '” e o contato “', lead.personName || '—', '”, junto com o negócio.'),
        ui.field('Pipeline', pipeSel), ui.field('Etapa inicial', stageSel)),
      submitText: 'Converter',
      onSubmit: function () {
        var deal = S.convertLead(lead.id, { pipelineId: pipeSel.value, stageId: stageSel.value });
        ui.toast('Lead convertido em negócio', { kind: 'success', action: { label: 'Abrir', fn: function () { go('#/deal/' + deal.id); } } });
        if (onDone) onDone(deal);
      }
    });
  };

  /* ---------- ganho / perdido ---------- */
  F.lost = function (deal, onDone) {
    var reason = ui.select(listOpts('lostReasons', 'Selecione o motivo…'), '', { required: true });
    var note = h('textarea', { class: 'textarea', placeholder: 'O que aconteceu? (opcional) — ajuda a melhorar a abordagem.' });
    return ui.modal({
      title: 'Marcar como perdido', size: 'sm',
      content: h('div', { class: 'form-grid' }, h('p', { class: 'full text-2' }, deal.title), ui.field('Motivo da perda', reason, { req: true, full: true }), ui.field('Observações', note, { full: true })),
      submitText: 'Marcar como perdido', danger: true,
      onSubmit: function () { S.loseDeal(deal.id, reason.value, note.value.trim()); ui.toast('Negócio marcado como perdido', { action: { label: 'Reabrir', fn: function () { S.reopenDeal(deal.id); } } }); if (onDone) onDone(); }
    });
  };
  F.win = function (deal, onDone) {
    S.winDeal(deal.id);
    ui.toast('Negócio ganho! 🎉 ' + u.money(deal.value) + (deal.mrr ? ' + ' + u.money(deal.mrr) + '/mês' : ''), { kind: 'success', duration: 5000, action: { label: 'Desfazer', fn: function () { S.reopenDeal(deal.id); } } });
    if (onDone) onDone();
  };

  /* ---------- produto ---------- */
  F.product = function (o) {
    o = o || {};
    var p = o.product;
    var name = ui.textInput({ required: true, placeholder: 'Ex.: Site institucional', value: p ? p.name : '' });
    var price = ui.moneyInput(p ? p.price : 0);
    var billing = ui.select([{ value: 'once', label: 'Pagamento único (projeto)' }, { value: 'monthly', label: 'Recorrente mensal (MRR)' }], p ? p.billing : 'once');
    var desc = h('textarea', { class: 'textarea', placeholder: 'O que está incluso…' }); desc.value = p ? p.description : '';
    var active = h('input', { type: 'checkbox', checked: p ? p.active : true });
    var api;
    api = ui.modal({
      title: p ? 'Editar produto' : 'Novo produto', content: row([
        ui.field('Nome', name, { req: true, full: true }), ui.field('Preço', price), ui.field('Cobrança', billing),
        ui.field('Descrição', desc, { full: true }), h('label', { class: 'check full' }, active, 'Ativo (disponível para novos negócios)')
      ]),
      footerLeft: p ? h('button', { type: 'button', class: 'btn danger', onclick: function () {
        ui.confirm({ title: 'Excluir produto', message: 'Excluir “' + p.name + '” do catálogo? Negócios que já o usam mantêm o item.', confirmText: 'Excluir', danger: true }).then(function (ok) {
          if (ok) { S.deleteProduct(p.id); api.close(); }
        });
      } }, icon('trash', 15), 'Excluir') : null,
      onSubmit: function () {
        var f = { name: name.value.trim(), price: price.get(), billing: billing.value, description: desc.value.trim(), active: active.checked };
        if (p) S.updateProduct(p.id, f); else S.addProduct(f);
      }
    });
    return api;
  };

  /* ---------- importação de leads por CSV (compatível com exportações do Apollo) ---------- */
  var ALIASES = {
    title: ['titulo', 'titulo do lead', 'lead', 'lead title', 'deal title', 'negocio'],
    orgName: ['empresa', 'organizacao', 'company', 'company name', 'organization', 'account', 'account name', 'nome da empresa', 'razao social'],
    personName: ['contato', 'nome', 'pessoa', 'name', 'full name', 'contact', 'contact name', 'nome completo'],
    firstName: ['first name', 'primeiro nome'],
    lastName: ['last name', 'sobrenome', 'ultimo nome'],
    role: ['cargo', 'job title', 'position', 'role', 'funcao'],
    email: ['email', 'e-mail', 'email address', 'work email', 'e-mail corporativo', 'email 1'],
    phone: ['telefone', 'phone', 'celular', 'whatsapp', 'mobile phone', 'work direct phone', 'corporate phone', 'phone number', 'mobile', 'direct phone'],
    website: ['site', 'website', 'url', 'company website', 'website url', 'site da empresa'],
    linkedin: ['linkedin', 'person linkedin url', 'linkedin url', 'linkedin pessoa'],
    source: ['origem', 'source', 'fonte', 'lead source'],
    value: ['valor', 'value', 'valor estimado'],
    note: ['observacoes', 'observacao', 'notas', 'nota', 'note', 'notes', 'obs']
  };
  var FIELD_LABEL = { title: 'Título', orgName: 'Empresa', personName: 'Contato', firstName: 'Nome', lastName: 'Sobrenome', role: 'Cargo', email: 'E-mail', phone: 'Telefone', website: 'Site', linkedin: 'LinkedIn', source: 'Origem', value: 'Valor', note: 'Observações' };
  function autoMap(headers) {
    var normed = headers.map(u.norm), hasFirst = normed.indexOf('first name') >= 0 || normed.indexOf('primeiro nome') >= 0;
    var used = {}, map = [];
    normed.forEach(function (hd, i) {
      var key = null;
      if (hd === 'title' && hasFirst) key = 'role';
      else if (hd === 'title') key = 'title';
      else Object.keys(ALIASES).some(function (k) { if (ALIASES[k].indexOf(hd) >= 0) { key = k; return true; } return false; });
      if (key && !used[key]) { used[key] = true; map[i] = key; } else map[i] = null;
    });
    return map;
  }
  function buildLeads(parsed, map, defaultSource) {
    var out = [];
    parsed.rows.slice(0, 5000).forEach(function (r) {
      var rec = {};
      map.forEach(function (k, i) { if (k && r[i] != null) rec[k] = String(r[i]).trim(); });
      var person = rec.personName || [rec.firstName, rec.lastName].filter(Boolean).join(' ');
      if (!rec.orgName && !person && !rec.title) return;
      var src = defaultSource;
      if (rec.source) {
        var n = u.norm(rec.source);
        var m = S.s.lists.sources.filter(function (x) { return u.norm(x.name) === n || u.norm(x.name).indexOf(n) >= 0; })[0];
        if (m) src = m.id;
      }
      out.push({ title: rec.title || rec.orgName || person, orgName: rec.orgName || '', personName: person || '', role: rec.role || '', email: rec.email || '', phone: rec.phone || '', website: rec.website || '', linkedin: rec.linkedin || '', sourceId: src, value: u.parseMoney(rec.value), note: rec.note || '' });
    });
    return out;
  }
  F.importLeads = function () {
    var parsed = null, built = [];
    var file = h('input', { type: 'file', accept: '.csv,.txt,text/csv', class: 'input', style: { paddingTop: '6px' } });
    var srcSel = ui.select(listOpts('sources', 'Selecione…'), 'sr_mail');
    var result = h('div', { style: { marginTop: '14px' } });
    var submit;
    function render() {
      u.clear(result);
      if (!parsed) return;
      var map = autoMap(parsed.headers);
      built = buildLeads(parsed, map, srcSel.value || null);
      var recognized = map.map(function (k, i) { return k ? h('span', { class: 'chip', style: { margin: '0 6px 6px 0' } }, parsed.headers[i] + ' → ' + FIELD_LABEL[k]) : null; });
      result.appendChild(h('div', null,
        h('div', { class: 'lbl', style: { fontWeight: 600, color: 'var(--text-2)', marginBottom: '6px', fontSize: '12.5px' } }, 'Colunas reconhecidas'),
        h('div', null, recognized.filter(Boolean).length ? recognized : h('span', { class: 'muted' }, 'Nenhuma coluna reconhecida. Use cabeçalhos como Empresa, Contato, E-mail, Telefone, Site, Origem.'))));
      if (built.length) {
        result.appendChild(h('div', { class: 'table-wrap', style: { marginTop: '8px' } }, h('table', { class: 'table' },
          h('thead', null, h('tr', null, ['Empresa', 'Contato', 'E-mail', 'Telefone'].map(function (c) { return h('th', null, c); }))),
          h('tbody', null, built.slice(0, 5).map(function (l) { return h('tr', null, [l.orgName || l.title, l.personName, l.email, l.phone].map(function (c) { return h('td', null, c || '—'); })); })))));
        result.appendChild(h('p', { class: 'muted', style: { marginTop: '8px' } }, built.length + ' lead(s) prontos para importar' + (parsed.rows.length > 5000 ? ' (limitado às 5.000 primeiras linhas)' : '') + '.'));
      }
      if (submit) submit.disabled = !built.length;
    }
    file.addEventListener('change', function () {
      var f = file.files[0]; if (!f) return;
      var fr = new FileReader();
      fr.onload = function () { parsed = u.parseCSV(String(fr.result)); render(); };
      fr.readAsText(f, 'utf-8');
    });
    srcSel.addEventListener('change', render);
    var api = ui.modal({
      title: 'Importar leads (CSV)', size: 'lg',
      content: h('div', null,
        h('p', { class: 'text-2', style: { marginBottom: '14px' } }, 'Aceita planilhas exportadas do Apollo, LinkedIn Sales Navigator, Google Sheets ou Excel (CSV com , ou ;). As colunas são reconhecidas pelo nome do cabeçalho.'),
        row([ui.field('Arquivo CSV', file, { full: true }), ui.field('Origem padrão', srcSel, { hint: 'Usada quando a planilha não traz a coluna Origem.' })]), result),
      submitText: 'Importar leads',
      onSubmit: function () {
        if (!built.length) { ui.toast('Selecione um CSV válido primeiro.', { kind: 'error' }); return false; }
        var n = S.importLeads(built);
        ui.toast(n + ' leads importados', { kind: 'success' });
      }
    });
    submit = api.el.querySelector('button[type=submit]'); submit.disabled = true;
  };

  AX.forms = F;
})(window.AX = window.AX || {});
