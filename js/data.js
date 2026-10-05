/* Axon CRM — configuração padrão (Axon Tech) e gerador de dados de exemplo */
(function (AX) {
  'use strict';
  var u = AX.u;

  AX.ACTIVITY_TYPES = [
    { id: 'call', name: 'Ligação', icon: 'phone' },
    { id: 'whatsapp', name: 'WhatsApp', icon: 'message' },
    { id: 'email', name: 'E-mail', icon: 'mail' },
    { id: 'linkedin', name: 'LinkedIn', icon: 'linkedin' },
    { id: 'meeting', name: 'Reunião', icon: 'video' },
    { id: 'proposal', name: 'Proposta', icon: 'file-text' },
    { id: 'task', name: 'Tarefa', icon: 'check-square' }
  ];
  AX.SOURCE_GROUPS = { outbound: 'Outbound', inbound: 'Inbound', referral: 'Indicação & parcerias', other: 'Outros' };

  function defaults() {
    var t = u.nowIso();
    var stage = function (id, name, prob, rot) { return { id: id, name: name, prob: prob, rot: rot }; };
    var prod = function (id, name, price, billing, description) {
      return { id: id, name: name, price: price, billing: billing, description: description || '', active: true };
    };
    return {
      v: 1, createdAt: t, lastBackupAt: null,
      profile: { company: 'Axon Tech', onboarded: false },
      users: [{ id: 'u_me', name: 'Eu', color: '#256abf' }],
      currentUser: 'u_me',
      pipelines: [{
        id: 'pl_sites', name: 'Criação de Sites',
        stages: [
          stage('st_contato', 'Contato iniciado', 10, 7),
          stage('st_reuniao', 'Reunião agendada', 25, 5),
          stage('st_diag', 'Diagnóstico & briefing', 40, 7),
          stage('st_prop', 'Proposta enviada', 60, 7),
          stage('st_neg', 'Negociação', 80, 10)
        ]
      }],
      deals: [], persons: [], orgs: [], leads: [], activities: [], notes: [], log: [],
      // Preços são valores de partida — ajuste em Produtos.
      products: [
        prod('pr_lp', 'Landing page', 2500, 'once', 'Página única de alta conversão, até 5 seções.'),
        prod('pr_inst', 'Site institucional', 5500, 'once', 'Até 6 páginas, responsivo, SEO básico.'),
        prod('pr_prem', 'Site institucional premium', 9800, 'once', 'Até 12 páginas, blog e design sob medida.'),
        prod('pr_ecom', 'E-commerce', 14900, 'once', 'Loja virtual completa com pagamento e frete.'),
        prod('pr_redesign', 'Redesign de site', 6500, 'once', 'Novo layout e migração de conteúdo.'),
        prod('pr_page', 'Página adicional', 450, 'once', 'Por página extra.'),
        prod('pr_seo_setup', 'SEO on-page inicial', 1800, 'once', 'Estrutura, metadados e performance.'),
        prod('pr_integ', 'Integrações (WhatsApp, pixel, CRM)', 900, 'once', ''),
        prod('pr_manut', 'Manutenção & hospedagem', 290, 'monthly', 'Hospedagem, backup, atualizações e segurança.'),
        prod('pr_suporte', 'Suporte & alterações de conteúdo', 690, 'monthly', 'Pacote mensal de horas de alteração.'),
        prod('pr_seo', 'SEO mensal', 1490, 'monthly', 'Conteúdo, otimização e relatório.')
      ],
      lists: {
        sources: [
          { id: 'sr_li', name: 'Outbound – LinkedIn', group: 'outbound' },
          { id: 'sr_mail', name: 'Outbound – E-mail frio', group: 'outbound' },
          { id: 'sr_call', name: 'Outbound – Ligação', group: 'outbound' },
          { id: 'sr_wa', name: 'Outbound – WhatsApp', group: 'outbound' },
          { id: 'sr_ref', name: 'Indicação de cliente', group: 'referral' },
          { id: 'sr_partner', name: 'Parceiros', group: 'referral' },
          { id: 'sr_site', name: 'Inbound – Site / orgânico', group: 'inbound' },
          { id: 'sr_ads', name: 'Inbound – Anúncios', group: 'inbound' },
          { id: 'sr_event', name: 'Eventos', group: 'other' }
        ],
        lostReasons: [
          { id: 'lr_budget', name: 'Sem orçamento' },
          { id: 'lr_price', name: 'Preço acima do esperado' },
          { id: 'lr_competitor', name: 'Escolheu concorrente' },
          { id: 'lr_ghost', name: 'Sem resposta (ghosting)' },
          { id: 'lr_postponed', name: 'Projeto adiado' },
          { id: 'lr_inhouse', name: 'Decidiu fazer internamente' },
          { id: 'lr_icp', name: 'Fora do perfil (ICP)' },
          { id: 'lr_other', name: 'Outro' }
        ],
        labels: [
          { id: 'lb_hot', name: 'Quente', color: '#e34948' },
          { id: 'lb_warm', name: 'Morno', color: '#eda100' },
          { id: 'lb_cold', name: 'Frio', color: '#2a78d6' }
        ],
        projectTypes: [
          { id: 'pt_lp', name: 'Landing page' },
          { id: 'pt_inst', name: 'Site institucional' },
          { id: 'pt_prem', name: 'Site institucional premium' },
          { id: 'pt_ecom', name: 'E-commerce' },
          { id: 'pt_redesign', name: 'Redesign de site' },
          { id: 'pt_portal', name: 'Portal / sistema web' },
          { id: 'pt_manut', name: 'Manutenção & suporte' },
          { id: 'pt_seo', name: 'SEO & performance' },
          { id: 'pt_other', name: 'Outro' }
        ]
      }
    };
  }

  /* ---------- dados de exemplo (datas relativas a hoje, determinísticos) ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // [org, segmento, cidade, contato, cargo, tipo, valor, mrr, estado, origem, etiqueta]
  // estado: número = etapa aberta {s, idade, naEtapa} | 'W' ganho {cicloDias, ganhoHá} | 'L' perdido
  var PROSPECTS = [
    ['Clínica Odonto Sorriso Pleno', 'Odontologia', 'São Paulo, SP', 'Dra. Marina Leal', 'Sócia-proprietária', 'pt_inst', 6800, 290, { s: 0, age: 4, inStage: 4 }, 'sr_li', 'lb_warm'],
    ['Advocacia Mendes & Rocha', 'Jurídico', 'Campinas, SP', 'Paulo Mendes', 'Sócio', 'pt_redesign', 7500, 0, { s: 0, age: 2, inStage: 2 }, 'sr_mail', 'lb_cold'],
    ['Pet Shop Bicho Feliz', 'Pet', 'Santo André, SP', 'Camila Duarte', 'Gerente', 'pt_lp', 2800, 290, { s: 0, age: 6, inStage: 6 }, 'sr_wa', 'lb_cold'],
    ['Construtora Horizonte', 'Construção civil', 'Curitiba, PR', 'Roberto Siqueira', 'Diretor', 'pt_prem', 11200, 690, { s: 0, age: 12, inStage: 11 }, 'sr_call', 'lb_warm'],
    ['Studio Bella Pele', 'Estética', 'Belo Horizonte, MG', 'Fernanda Prado', 'Proprietária', 'pt_lp', 3200, 290, { s: 0, age: 1, inStage: 1 }, 'sr_li', 'lb_cold'],
    ['Contabilidade Prisma', 'Contabilidade', 'Porto Alegre, RS', 'Lucas Andrade', 'Sócio', 'pt_inst', 5400, 290, { s: 0, age: 3, inStage: 3 }, 'sr_ref', 'lb_warm'],
    ['Academia Corpo em Movimento', 'Fitness', 'Osasco, SP', 'Thiago Ribeiro', 'Proprietário', 'pt_inst', 6200, 490, { s: 1, age: 9, inStage: 3 }, 'sr_li', 'lb_hot'],
    ['Escola de Idiomas Fluent', 'Educação', 'Florianópolis, SC', 'Aline Moraes', 'Diretora pedagógica', 'pt_ecom', 14500, 690, { s: 1, age: 13, inStage: 4 }, 'sr_mail', 'lb_warm'],
    ['Restaurante Sabor da Serra', 'Gastronomia', 'Gramado, RS', 'Henrique Bastos', 'Proprietário', 'pt_lp', 4200, 290, { s: 1, age: 6, inStage: 2 }, 'sr_wa', 'lb_cold'],
    ['Imobiliária Casa Nova', 'Imobiliário', 'Goiânia, GO', 'Patrícia Lima', 'Diretora comercial', 'pt_portal', 18900, 990, { s: 1, age: 15, inStage: 8 }, 'sr_call', 'lb_hot'],
    ['Auto Center Silva', 'Automotivo', 'Guarulhos, SP', 'Marcos Silva', 'Sócio', 'pt_inst', 5800, 290, { s: 2, age: 19, inStage: 5 }, 'sr_ref', 'lb_warm'],
    ['Clínica Vet Vida Animal', 'Veterinária', 'Recife, PE', 'André Camargo', 'Médico veterinário sócio', 'pt_redesign', 7200, 490, { s: 2, age: 17, inStage: 4 }, 'sr_li', 'lb_warm'],
    ['Arquitetura Linha Viva', 'Arquitetura', 'São Paulo, SP', 'Beatriz Nogueira', 'Arquiteta sócia', 'pt_prem', 9600, 290, { s: 2, age: 21, inStage: 6 }, 'sr_event', 'lb_hot'],
    ['Transportadora RotaSul', 'Logística', 'Joinville, SC', 'Gustavo Pereira', 'Gerente comercial', 'pt_inst', 12300, 690, { s: 2, age: 24, inStage: 12 }, 'sr_mail', 'lb_cold'],
    ['Pousada Vale Verde', 'Turismo', 'Monte Verde, MG', 'Simone Ferraz', 'Gerente', 'pt_prem', 13800, 790, { s: 3, age: 27, inStage: 4 }, 'sr_ref', 'lb_hot'],
    ['Nutriforte Alimentos', 'Indústria', 'Ribeirão Preto, SP', 'Eduardo Campos', 'Diretor', 'pt_ecom', 24500, 990, { s: 3, age: 31, inStage: 6 }, 'sr_li', 'lb_warm'],
    ['Psicologia Integrar', 'Saúde', 'São Paulo, SP', 'Helena Costa', 'Psicóloga', 'pt_lp', 3400, 290, { s: 3, age: 20, inStage: 2 }, 'sr_wa', 'lb_warm'],
    ['Madeira Nobre Móveis', 'Indústria', 'Bento Gonçalves, RS', 'Rafael Tonet', 'Sócio', 'pt_prem', 10400, 490, { s: 3, age: 36, inStage: 11 }, 'sr_call', 'lb_cold'],
    ['Colégio Nova Geração', 'Educação', 'Brasília, DF', 'Cláudia Veloso', 'Coordenadora', 'pt_portal', 21500, 1290, { s: 4, age: 39, inStage: 5 }, 'sr_event', 'lb_hot'],
    ['Farmácias FarmaVida', 'Varejo', 'Fortaleza, CE', 'Daniel Albuquerque', 'Gerente de marketing', 'pt_ecom', 28900, 1490, { s: 4, age: 42, inStage: 3 }, 'sr_li', 'lb_hot'],
    ['Studio Pilates Equilíbrio', 'Fitness', 'Niterói, RJ', 'Juliana Torres', 'Proprietária', 'pt_lp', 3600, 290, { s: 4, age: 29, inStage: 12 }, 'sr_mail', 'lb_warm'],
    // ganhos
    ['Cafeteria Grão Nobre', 'Gastronomia', 'Curitiba, PR', 'Bruno Menezes', 'Proprietário', 'pt_inst', 4800, 290, { w: 6, cycle: 24 }, 'sr_wa', 'lb_warm'],
    ['Odontologia Dr. Ricardo Alves', 'Odontologia', 'Belém, PA', 'Ricardo Alves', 'Cirurgião-dentista', 'pt_inst', 6500, 490, { w: 17, cycle: 31 }, 'sr_li', 'lb_hot'],
    ['Contábil Aliança', 'Contabilidade', 'Londrina, PR', 'Sandra Figueiredo', 'Sócia', 'pt_lp', 3300, 290, { w: 38, cycle: 19 }, 'sr_mail', 'lb_warm'],
    ['Loja Moda Atual', 'Varejo', 'São Paulo, SP', 'Larissa Cunha', 'Proprietária', 'pt_ecom', 15800, 990, { w: 61, cycle: 45 }, 'sr_li', 'lb_hot'],
    ['Clínica Estética Renove', 'Estética', 'Salvador, BA', 'Mônica Barreto', 'Sócia', 'pt_prem', 9200, 490, { w: 84, cycle: 36 }, 'sr_ref', 'lb_warm'],
    ['Engenharia Prado & Filhos', 'Construção civil', 'Uberlândia, MG', 'Antônio Prado', 'Diretor', 'pt_redesign', 7900, 0, { w: 109, cycle: 28 }, 'sr_call', 'lb_warm'],
    ['Academia Power Fit', 'Fitness', 'Campinas, SP', 'Vinícius Gomes', 'Proprietário', 'pt_lp', 2900, 290, { w: 133, cycle: 15 }, 'sr_mail', 'lb_cold'],
    // perdidos
    ['Buffet Festa Mágica', 'Eventos', 'Santos, SP', 'Karina Lopes', 'Proprietária', 'pt_lp', 3100, 0, { l: 9, cycle: 20, r: 'lr_budget', s: 2 }, 'sr_wa', 'lb_cold'],
    ['Clínica Ortopédica Mov', 'Saúde', 'Ribeirão Preto, SP', 'Fábio Teixeira', 'Sócio', 'pt_inst', 7400, 490, { l: 22, cycle: 33, r: 'lr_competitor', s: 4 }, 'sr_li', 'lb_warm'],
    ['Casa & Conforto Decor', 'Varejo', 'Curitiba, PR', 'Tatiana Rocha', 'Gerente', 'pt_ecom', 17900, 990, { l: 35, cycle: 40, r: 'lr_price', s: 3 }, 'sr_mail', 'lb_warm'],
    ['Rota Livre Viagens', 'Turismo', 'São Paulo, SP', 'Cláudio Neves', 'Sócio', 'pt_redesign', 6100, 0, { l: 50, cycle: 25, r: 'lr_ghost', s: 3 }, 'sr_call', 'lb_cold'],
    ['Auto Peças Brasil', 'Automotivo', 'Goiânia, GO', 'Wagner Dias', 'Gerente', 'pt_inst', 5200, 290, { l: 70, cycle: 30, r: 'lr_postponed', s: 2 }, 'sr_li', 'lb_cold'],
    ['Escola Pequenos Passos', 'Educação', 'Maringá, PR', 'Renata Souza', 'Diretora', 'pt_inst', 6900, 290, { l: 92, cycle: 38, r: 'lr_inhouse', s: 4 }, 'sr_ref', 'lb_warm'],
    ['Salão Charme & Cia', 'Estética', 'Santo André, SP', 'Priscila Matos', 'Proprietária', 'pt_lp', 2600, 0, { l: 118, cycle: 14, r: 'lr_budget', s: 1 }, 'sr_wa', 'lb_cold'],
    ['Consultoria Fiscal Ágil', 'Contabilidade', 'Belo Horizonte, MG', 'Otávio Reis', 'Sócio', 'pt_inst', 5600, 290, { l: 140, cycle: 27, r: 'lr_competitor', s: 3 }, 'sr_mail', 'lb_cold']
  ];

  var NOTES = [
    'Decisor é o sócio; prefere contato por WhatsApp. Site atual lento e sem versão mobile.',
    'Quer algo "moderno e que passe confiança". Referências enviadas: 3 sites de concorrentes.',
    'Orçamento aprovado internamente até o fim do mês. Precisa de prazo de até 30 dias.',
    'Já teve experiência ruim com agência anterior (atrasos). Reforçar cronograma e comunicação.',
    'Pediu para incluir blog e integração com WhatsApp. Avaliar upsell de SEO mensal.',
    'Site atual foi feito em plataforma de arrastar e soltar; não rankeia no Google.'
  ];
  var ACT_BY_STAGE = [['call', 'email', 'linkedin', 'whatsapp'], ['meeting', 'call'], ['meeting', 'task'], ['proposal', 'call', 'email'], ['call', 'meeting']];
  var ACT_SUBJ = {
    call: ['Ligação de apresentação', 'Retornar ligação', 'Follow-up por telefone'],
    whatsapp: ['Enviar mensagem de abertura', 'Follow-up no WhatsApp'],
    email: ['E-mail de apresentação (cadência)', 'Enviar portfólio por e-mail', 'Follow-up por e-mail'],
    linkedin: ['Conectar no LinkedIn', 'Mensagem pós-conexão'],
    meeting: ['Reunião de diagnóstico', 'Apresentação da proposta', 'Call de alinhamento'],
    proposal: ['Enviar proposta comercial', 'Revisar proposta'],
    task: ['Auditar site atual', 'Preparar briefing', 'Montar escopo do projeto']
  };

  function demo(state) {
    var rnd = mulberry32(2026);
    var pick = function (a) { return a[Math.floor(rnd() * a.length)]; };
    var DAY = 864e5, now = Date.now();
    var at = function (daysAgo) {
      var d = new Date(now - daysAgo * DAY);
      d.setHours(9 + Math.floor(rnd() * 8), Math.floor(rnd() * 60), 0, 0);
      return d.toISOString();
    };
    var slug = function (s) { return u.norm(s).replace(/[^a-z0-9]+/g, ''); };
    var phone = function () { return '(' + pick(['11', '19', '41', '51', '31', '21']) + ') 9' + (8000 + Math.floor(rnd() * 1999)) + '-' + (1000 + Math.floor(rnd() * 8999)); };
    var stages = state.pipelines[0].stages;
    var me = state.currentUser;
    var log = function (dealId, atIso, text) { state.log.push({ id: u.uid('l'), entity: 'deal', entityId: dealId, at: atIso, text: text, userId: me }); };

    PROSPECTS.forEach(function (p, i) {
      var st = p[8];
      var org = { id: u.uid('o'), name: p[0], website: slug(p[0]) + '.example', segment: p[1], city: p[2], phone: phone(), cnpj: '', ownerId: me, createdAt: at(30) };
      var person = {
        id: u.uid('p'), name: p[3], role: p[4], orgId: org.id, ownerId: me,
        email: slug(p[3].split(' ')[0]) + '@' + org.website, phone: phone(), linkedin: '', createdAt: org.createdAt
      };
      state.orgs.push(org); state.persons.push(person);

      var open = typeof st.s === 'number' && st.w == null && st.l == null;
      var age = open ? st.age : (st.w != null ? st.w + st.cycle : st.l + st.cycle);
      var createdAt = at(age);
      var deal = {
        id: u.uid('d'), title: p[0] + ' — ' + (state.lists.projectTypes.filter(function (t) { return t.id === p[5]; })[0] || { name: 'Site' }).name,
        value: p[6], mrr: p[7], pipelineId: state.pipelines[0].id, stageId: stages[0].id, order: i, status: 'open',
        personId: person.id, orgId: org.id, ownerId: me, labelId: p[10], sourceId: p[9], projectTypeId: p[5],
        siteUrl: 'https://' + org.website, expectedClose: '', products: [],
        createdAt: createdAt, updatedAt: createdAt, stageEnteredAt: createdAt, history: [{ stageId: stages[0].id, at: createdAt }],
        wonAt: null, lostAt: null, lostReasonId: null, lostNote: ''
      };
      log(deal.id, createdAt, 'Negócio criado');

      var walkTo = function (target, totalDays, lastStay) {
        // distribui as entradas em etapas ao longo da idade do negócio
        for (var k = 1; k <= target; k++) {
          var daysAgo = k === target && lastStay != null ? lastStay : age - (totalDays * k) / (target + 1);
          var when = at(Math.max(daysAgo, 0));
          deal.history.push({ stageId: stages[k].id, at: when });
          log(deal.id, when, 'Movido de “' + stages[k - 1].name + '” para “' + stages[k].name + '”');
          deal.stageId = stages[k].id; deal.stageEnteredAt = when;
        }
      };

      if (open) {
        walkTo(st.s, age, st.inStage);
        deal.stageId = stages[st.s].id;
        if (st.s === 0) deal.stageEnteredAt = createdAt;
        deal.updatedAt = deal.stageEnteredAt;
        deal.expectedClose = u.addDays(u.today(), Math.round(50 - st.s * 9 + rnd() * 12 - (st.inStage > 10 ? 40 : 0)));
        deal.order = i;
      } else if (st.w != null) {
        walkTo(4, age, null);
        deal.status = 'won'; deal.wonAt = at(st.w); deal.updatedAt = deal.wonAt;
        deal.stageId = stages[4].id; deal.expectedClose = u.toYmd(deal.wonAt);
        log(deal.id, deal.wonAt, 'Negócio ganho');
      } else {
        walkTo(Math.min(st.s, 4), age, null);
        deal.status = 'lost'; deal.lostAt = at(st.l); deal.updatedAt = deal.lostAt;
        deal.lostReasonId = st.r; deal.expectedClose = u.toYmd(deal.lostAt);
        log(deal.id, deal.lostAt, 'Negócio perdido: ' + (state.lists.lostReasons.filter(function (r) { return r.id === st.r; })[0] || {}).name);
      }

      // histórico não pode ser posterior ao fechamento
      var closeAt = deal.wonAt || deal.lostAt;
      if (closeAt) deal.history = deal.history.map(function (hh) { return hh.at > closeAt ? { stageId: hh.stageId, at: closeAt } : hh; });

      state.deals.push(deal);

      // atividades concluídas ao longo do funil
      var reached = open ? st.s : (st.w != null ? 4 : Math.min(st.s, 4));
      for (var s = 0; s <= reached; s++) {
        var cnt = open && s === st.s ? 1 : 1 + (rnd() > 0.55 ? 1 : 0);
        for (var c = 0; c < cnt; c++) {
          var type = pick(ACT_BY_STAGE[s]);
          var stageEnter = deal.history.filter(function (hh) { return hh.stageId === stages[s].id; })[0];
          var base = stageEnter ? new Date(stageEnter.at).getTime() : new Date(createdAt).getTime();
          var due = u.ymd(new Date(base + c * DAY * 2));
          if (due >= u.today()) due = u.addDays(u.today(), -1 - c);
          state.activities.push({
            id: u.uid('a'), type: type, subject: pick(ACT_SUBJ[type]), dueDate: due, dueTime: '', duration: 0, done: true,
            doneAt: new Date(base + c * DAY * 2 + 3600e3).toISOString(), dealId: deal.id, personId: person.id, orgId: org.id, leadId: null,
            ownerId: me, note: '', createdAt: createdAt
          });
        }
      }
      // atividades planejadas dos negócios abertos (padrão varia para mostrar os 3 estados do indicador)
      if (open) {
        var pat = i % 7, type2 = pick(ACT_BY_STAGE[st.s]);
        var offs = [-2, 0, 1, 3, 5, null, 2][pat];
        if (offs !== null) {
          state.activities.push({
            id: u.uid('a'), type: type2, subject: pick(ACT_SUBJ[type2]), dueDate: u.addDays(u.today(), offs),
            dueTime: pat === 6 || pat === 1 ? (pat === 1 ? '16:30' : '10:00') : '', duration: type2 === 'meeting' ? 45 : 15, done: false, doneAt: null,
            dealId: deal.id, personId: person.id, orgId: org.id, leadId: null, ownerId: me, note: '', createdAt: createdAt
          });
        }
        if (i % 3 === 0) {
          state.notes.push({ id: u.uid('n'), content: NOTES[i % NOTES.length], dealId: deal.id, personId: null, orgId: null, pinned: i % 6 === 0, createdAt: at(Math.max(1, age - 2)), updatedAt: null });
        }
      }

      // produtos nos negócios em proposta+ e ganhos
      if ((open && st.s >= 3) || st.w != null) {
        var catalog = state.products;
        var main = catalog.filter(function (x) { return x.id === ({ pt_lp: 'pr_lp', pt_inst: 'pr_inst', pt_prem: 'pr_prem', pt_ecom: 'pr_ecom', pt_redesign: 'pr_redesign', pt_portal: 'pr_prem' })[p[5]]; })[0] || catalog[1];
        var line = function (pr, qty, price) { return { id: u.uid('dp'), productId: pr.id, name: pr.name, price: price != null ? price : pr.price, qty: qty, discount: 0, billing: pr.billing }; };
        var lines = [line(main, 1, p[6])];
        if (p[7]) lines.push(line(catalog.filter(function (x) { return x.id === 'pr_manut'; })[0], 1, p[7]));
        deal.products = lines;
      }
    });

    // leads na caixa de entrada — prospects ainda não qualificados
    var LEADS = [
      ['Floricultura Jardim Secreto', 'Marta Ribeiro', 'Proprietária', 'sr_li', 3000],
      ['Lavanderia Express Lav', 'Jorge Alves', 'Sócio', 'sr_mail', 0],
      ['Escritório Barros Advogados', 'Isabela Barros', 'Sócia', 'sr_li', 7000],
      ['Dentista Sorriso & Cia', 'Rodrigo Lima', 'Dentista', 'sr_call', 0],
      ['Oficina Mecânica Torque', 'Sérgio Matos', 'Dono', 'sr_wa', 0],
      ['Pizzaria Forno a Lenha', 'Alessandra Cruz', 'Gerente', 'sr_wa', 3500],
      ['Clínica de Fisioterapia Movimento', 'Daniela Pires', 'Fisioterapeuta', 'sr_site', 4500],
      ['Curso Preparatório Aprova+', 'Caio Fernandes', 'Diretor', 'sr_ads', 9000]
    ];
    LEADS.forEach(function (l, i) {
      state.leads.push({
        id: u.uid('ld'), title: l[0], orgName: l[0], personName: l[1], role: l[2], email: slug(l[1].split(' ')[0]) + '@' + slug(l[0]) + '.example',
        phone: phone(), website: slug(l[0]) + '.example', sourceId: l[3], labelId: i % 3 === 0 ? 'lb_warm' : null, value: l[4], note: i % 2 ? 'Lista Apollo — segmento serviços locais.' : '',
        ownerId: me, createdAt: at(i % 5), archived: false, convertedDealId: null
      });
    });
  }

  AX.data = { defaults: defaults, demo: demo };
})(window.AX = window.AX || {});
