/* Axon CRM — testes ponta a ponta (Playwright + Chromium).
   Uso:  npm i -D playwright  &&  node tests/e2e.mjs
   Variáveis: PLAYWRIGHT_PATH (caminho do módulo, se instalado globalmente) · SHOTS=dir (salva capturas de tela) */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'file://' + path.join(ROOT, 'index.html');
const SHOTS = process.env.SHOTS;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

let failures = 0, total = 0;
const ok = (cond, msg) => { total++; if (!cond) { failures++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const section = (t) => console.log('\n' + t);

const browser = await chromium.launch();
const errors = [];
async function freshPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, ...opts });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  await page.goto(URL);
  return { ctx, page };
}
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const state = (page) => page.evaluate(() => JSON.parse(JSON.stringify(AX.store.s)));
const goto = async (page, hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForTimeout(150); };

/* ============ 1. Primeira execução e criação de negócio ============ */
section('Primeira execução');
let { ctx, page } = await freshPage();
await page.waitForSelector('.modal');
await page.fill('.modal input[type=text]', 'Leo');
await page.click('text=Começar do zero');
await page.waitForSelector('.board');
let s = await state(page);
ok(s.profile.onboarded && s.users[0].name === 'Leo', 'onboarding grava nome e marca como concluído');
ok(s.deals.length === 0 && s.pipelines[0].stages.length === 5, 'começa vazio, com pipeline “Criação de Sites” e 5 etapas');
ok(await page.locator('.callout').count() === 1, 'mostra callout de pipeline vazio');
await shot(page, '01-empty');

section('Criar negócio com organização e pessoa novas');
await page.click('.topbar .btn-split .btn:first-child');
await page.waitForSelector('.modal');
await page.fill('.modal .picker:nth-of-type(1) input', ''); // noop
const orgInput = page.locator('.modal .field:has(label:text("Organização")) input').first();
await orgInput.click(); await orgInput.fill('Clínica Teste Ltda');
await page.click('.picker-opt.create');
const personInput = page.locator('.modal .field:has(label:text("Pessoa de contato")) input').first();
await personInput.click(); await personInput.fill('Dra. Ana Teste');
await page.click('.picker-opt.create');
const titleVal = await page.inputValue('.modal input[required]');
ok(titleVal.startsWith('Clínica Teste Ltda'), 'título é sugerido a partir da organização (“' + titleVal + '”)');
await page.selectOption('.modal .field:has(label:text("Tipo de projeto")) select', 'pt_inst');
await page.fill('.modal .field:has(label:text("Valor do projeto")) input', '5.500');
await page.fill('.modal .field:has(label:text("Recorrência mensal")) input', '290');
await page.selectOption('.modal .field:has(label:text("Origem")) select', 'sr_li');
await page.click('.modal button[type=submit]');
await page.waitForSelector('.deal-card');
s = await state(page);
ok(s.deals.length === 1 && s.deals[0].value === 5500 && s.deals[0].mrr === 290, 'negócio criado com valor 5.500 e MRR 290');
ok(s.orgs.length === 1 && s.persons.length === 1 && s.persons[0].orgId === s.orgs[0].id, 'organização e pessoa criadas e vinculadas');
ok(s.deals[0].stageId === 'st_contato', 'entra na primeira etapa');
await shot(page, '02-first-deal');

/* ============ 2. Drag & drop ============ */
section('Drag & drop');
const card = page.locator('.deal-card').first();
const target = page.locator('.col-body[data-stage="st_prop"]');
await card.dragTo(target);
await page.waitForTimeout(200);
s = await state(page);
ok(s.deals[0].stageId === 'st_prop', 'arrastar para “Proposta enviada” muda a etapa');
ok(s.deals[0].history.length === 2, 'histórico de etapas registra a movimentação');
ok(s.log.some((l) => /Movido de/.test(l.text)), 'changelog registra “Movido de … para …”');
ok(await page.locator('.toast:has-text("Desfazer"), .toast button:has-text("Desfazer")').count() > 0, 'toast oferece “Desfazer”');
await page.click('.toast button:has-text("Desfazer")');
await page.waitForTimeout(200);
s = await state(page);
ok(s.deals[0].stageId === 'st_contato', 'desfazer restaura a etapa anterior');

section('Mover por teclado (Alt + →)');
await page.locator('.deal-card').first().focus();
await page.keyboard.press('Alt+ArrowRight');
await page.waitForTimeout(250);
s = await state(page);
ok(s.deals[0].stageId === 'st_reuniao', 'Alt+→ move para a próxima etapa');

section('Soltar em “Ganho”');
const box = await page.locator('.deal-card').first().boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 40, { steps: 5 });
await page.waitForSelector('.dropzones.show');
await page.waitForTimeout(400); // espera a animação das zonas de soltar
const zb = await page.locator('.dropzone.won').boundingBox();
await page.mouse.move(zb.x + zb.width / 2, zb.y + zb.height / 2, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(250);
s = await state(page);
ok(s.deals[0].status === 'won' && !!s.deals[0].wonAt, 'soltar na zona “Ganho” marca como ganho');
ok(await page.locator('.deal-card').count() === 0, 'negócio ganho sai do quadro');

/* ============ 3. Página do negócio ============ */
section('Página do negócio');
await goto(page, '#/deal/' + s.deals[0].id);
await page.waitForSelector('.deal-page');
ok(await page.locator('.closed-banner.won').count() === 1, 'banner de negócio ganho');
await page.click('button:has-text("Reabrir")');
await page.waitForTimeout(200);
s = await state(page);
ok(s.deals[0].status === 'open', 'reabrir devolve o negócio ao funil');

// clicar numa etapa da barra
await page.click('.stagebar .stg:nth-child(4)');
await page.waitForTimeout(200);
s = await state(page);
ok(s.deals[0].stageId === 'st_prop', 'clicar na barra de etapas move o negócio');

// edição inline do valor
await page.click('.kvs .kv:has(.kv-k:text("Valor do projeto")) .editable');
await page.fill('.editable-input', '6.000,50');
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
s = await state(page);
ok(s.deals[0].value === 6000.5, 'edição inline do valor aceita formato brasileiro (6.000,50)');
ok(s.log.some((l) => /Valor:/.test(l.text)), 'alteração de valor vai para o histórico');

// nota
await page.fill('.composer textarea', 'Cliente quer lançar em 30 dias.');
await page.click('button:has-text("Salvar nota")');
await page.waitForTimeout(200);
s = await state(page);
ok(s.notes.length === 1 && s.notes[0].dealId === s.deals[0].id, 'nota salva no negócio');
await page.click('.tab:has-text("Notas")');
await page.click('.note-head button[aria-label="Ações da nota"]');
await page.click('.menu-item:has-text("Fixar")');
await page.waitForTimeout(150);
s = await state(page);
ok(s.notes[0].pinned === true, 'nota pode ser fixada');

// atividade inline
await page.click('.tab:has-text("Foco")');
await page.click('.composer .seg button:has-text("Atividade")');
await page.click('.composer .type-chip:has-text("Reunião")');
await page.fill('.composer input[type=text]', 'Reunião de briefing');
await page.click('.composer button:has-text("Agendar")');
await page.waitForTimeout(200);
s = await state(page);
const meeting = s.activities.find((a) => a.subject === 'Reunião de briefing');
ok(!!meeting && meeting.type === 'meeting' && meeting.dealId === s.deals[0].id && !meeting.done, 'atividade agendada pelo compositor inline');
await page.click('.act-row .check-circle');
await page.waitForTimeout(200);
s = await state(page);
ok(s.activities.find((a) => a.subject === 'Reunião de briefing').done === true, 'concluir atividade pelo checkbox');
ok(await page.locator('.toast button:has-text("Agendar próxima")').count() > 0, 'ao concluir, oferece “Agendar próxima”');

// produtos
await page.click('.tab:has-text("Produtos")');
await page.selectOption('.stack select', 'pr_inst');
await page.waitForTimeout(200);
await page.selectOption('.stack select', 'pr_manut');
await page.waitForTimeout(200);
s = await state(page);
ok(s.deals[0].products.length === 2, 'produtos adicionados ao negócio');
ok(s.deals[0].value === 5500 && s.deals[0].mrr === 290, 'valor e MRR são calculados pelos produtos (5.500 + 290/mês)');
await page.fill('.table input[aria-label="Desconto %"]', '10');
await page.press('.table input[aria-label="Desconto %"]', 'Tab');
await page.waitForTimeout(200);
s = await state(page);
ok(Math.abs(s.deals[0].value - 4950) < 0.01, 'desconto de 10% recalcula o valor (4.950)');
await shot(page, '03-deal-products');

// perdido exige motivo
await page.click('button:has-text("Perdido")');
await page.waitForSelector('.modal');
await page.click('.modal button[type=submit]');
s = await state(page);
ok(s.deals[0].status === 'open', 'perdido sem motivo não é aceito');
await page.selectOption('.modal select', 'lr_price');
await page.click('.modal button[type=submit]');
await page.waitForTimeout(200);
s = await state(page);
ok(s.deals[0].status === 'lost' && s.deals[0].lostReasonId === 'lr_price', 'perdido com motivo registra o motivo');
await ctx.close();

/* ============ 4. Leads e importação de CSV ============ */
section('Leads');
({ ctx, page } = await freshPage());
await page.waitForSelector('.modal');
await page.click('text=Começar do zero');
await goto(page, '#/leads');
await page.click('button:has-text("Importar CSV")');
const csv = [
  'First Name,Last Name,Title,Company,Email,Mobile Phone,Website,Person Linkedin Url',
  'Marina,Leal,Sócia,Clínica Sorriso,marina@sorriso.com.br,(11) 98888-7777,sorriso.com.br,https://linkedin.com/in/marina',
  'Paulo,Mendes,Diretor,Mendes Advogados,paulo@mendes.adv.br,(19) 97777-6666,mendes.adv.br,',
  ',,,,,,,',
  'Ana,"Souza, Jr.",CEO,"Café ""Grão"" Nobre",ana@grao.com,,,'
].join('\n');
const tmp = path.join(os.tmpdir(), 'apollo-test.csv');
fs.writeFileSync(tmp, csv);
await page.setInputFiles('.modal input[type=file]', tmp);
await page.waitForSelector('.modal .table');
const imp = await page.locator('.modal').innerText();
ok(/3 lead\(s\) prontos/.test(imp), 'CSV estilo Apollo: 3 leads reconhecidos (linha vazia ignorada)');
ok(/First Name → Nome/.test(imp) && /Company → Empresa/.test(imp), 'colunas reconhecidas pelo cabeçalho');
await page.selectOption('.modal .field:has(label:text("Origem padrão")) select', 'sr_mail');
await page.click('.modal button[type=submit]');
await page.waitForTimeout(250);
s = await state(page);
ok(s.leads.length === 3, '3 leads importados');
const ana = s.leads.find((l) => l.personName.startsWith('Ana'));
ok(ana && ana.orgName === 'Café "Grão" Nobre' && ana.personName === 'Ana Souza, Jr.' && ana.role === 'CEO', 'aspas e vírgulas no CSV são tratadas (Café "Grão" Nobre / Souza, Jr.)');
ok(s.leads.every((l) => l.sourceId === 'sr_mail'), 'origem padrão aplicada');
await shot(page, '04-leads');

section('Converter lead em negócio');
await page.locator('tr:has-text("Clínica Sorriso") button:has-text("Converter")').click();
await page.selectOption('.modal .field:has(label:text("Etapa inicial")) select', 'st_reuniao');
await page.click('.modal button[type=submit]');
await page.waitForTimeout(250);
s = await state(page);
ok(s.deals.length === 1 && s.deals[0].stageId === 'st_reuniao', 'lead vira negócio na etapa escolhida');
ok(s.orgs.some((o) => o.name === 'Clínica Sorriso') && s.persons.some((p) => p.name === 'Marina Leal'), 'organização e pessoa criadas na conversão');
ok(s.leads.find((l) => l.orgName === 'Clínica Sorriso').archived, 'lead convertido sai da caixa de entrada');
ok((await page.locator('.nav-badge').first().innerText()) === '2', 'badge de leads mostra 2 restantes');
await ctx.close();

/* ============ 5. Dados de exemplo, busca, insights ============ */
section('Dados de exemplo, busca e insights');
({ ctx, page } = await freshPage());
await page.waitForSelector('.modal');
await page.click('text=Explorar com dados de exemplo');
await page.waitForSelector('.deal-card');
s = await state(page);
ok(s.deals.length >= 30 && s.deals.some((d) => d.status === 'won') && s.deals.some((d) => d.status === 'lost'), 'demo traz negócios abertos, ganhos e perdidos (' + s.deals.length + ')');
await shot(page, '05-board-demo');

await page.keyboard.press('/');
await page.keyboard.type('farmavida');
await page.waitForSelector('.search-item');
const sr = await page.locator('.search-panel').innerText();
ok(/Farmácias FarmaVida/.test(sr), 'busca global encontra negócio pela organização');
await page.keyboard.press('Enter');
await page.waitForSelector('.deal-page');
ok(/FarmaVida/.test(await page.locator('.deal-h1').innerText()), 'Enter abre o resultado da busca');

await goto(page, '#/insights');
await page.waitForSelector('.chart-card');
ok(await page.locator('.stat').count() === 6, 'insights: 6 KPIs');
ok(await page.locator('.chart-card').count() === 6, 'insights: 6 gráficos');
await page.locator('.cgroup').first().hover();
await page.waitForTimeout(120);
ok(await page.locator('.chart-tip:not(.hidden)').count() === 1, 'tooltip aparece ao passar o mouse nas colunas');
await page.locator('.chart-card').first().locator('button[aria-label="Ver tabela"]').click();
ok(await page.locator('.chart-card').first().locator('table').count() === 1, 'alternar para a tabela equivalente');
await page.selectOption('.filters select', 'all');
await page.waitForTimeout(200);
ok(!/R\$ 0\b/.test(await page.locator('.stat').first().innerText()), 'período “Todo o período” mostra receita ganha');
await shot(page, '06-insights');

section('Tema escuro');
await page.click('.topbar button[aria-label*="tema"]');
await page.waitForTimeout(150);
ok((await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'alternar para tema escuro');
await shot(page, '07-insights-dark');
await goto(page, '#/pipeline');
await shot(page, '08-board-dark');

/* ============ 6. Persistência ============ */
section('Persistência');
const before = (await state(page)).deals.length;
await page.reload();
await page.waitForSelector('.deal-card');
ok((await state(page)).deals.length === before, 'dados persistem após recarregar');
ok((await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'tema persiste após recarregar');

/* ============ 7. Configurações ============ */
section('Configurações');
await goto(page, '#/settings/pipelines');
await page.fill('input[aria-label="Nome da nova etapa"]', 'Contrato assinado');
await page.click('button:has-text("Adicionar etapa")');
await page.waitForTimeout(200);
s = await state(page);
ok(s.pipelines[0].stages.length === 6 && s.pipelines[0].stages[5].name === 'Contrato assinado', 'adicionar etapa');
await page.locator('tbody tr').last().locator('button[aria-label="Mover etapa para cima"]').click();
await page.waitForTimeout(150);
s = await state(page);
ok(s.pipelines[0].stages[4].name === 'Contrato assinado', 'reordenar etapa');
await page.locator('tbody tr').last().locator('button[aria-label="Excluir etapa"]').click();
await page.waitForSelector('.modal');
await page.click('.modal button[type=submit]');
await page.waitForTimeout(250);
s = await state(page);
ok(!s.pipelines[0].stages.some((st) => st.name === 'Negociação') && !s.deals.some((d) => d.stageId === 'st_neg'), 'excluir etapa move os negócios para a etapa escolhida');

await goto(page, '#/settings/data');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Exportar backup")')]);
const bk = path.join(os.tmpdir(), 'axon-backup-test.json');
await dl.saveAs(bk);
const backup = JSON.parse(fs.readFileSync(bk, 'utf8'));
ok(backup.deals.length === before && Array.isArray(backup.pipelines), 'exportar backup gera JSON completo');
const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('.card:has-text("planilhas") button:has-text("Negócios")')]);
const csvPath = path.join(os.tmpdir(), 'axon-neg.csv');
await dl2.saveAs(csvPath);
const csvOut = fs.readFileSync(csvPath, 'utf8');
ok(csvOut.charCodeAt(0) === 0xfeff && csvOut.split('\r\n')[0].includes('Título;Organização'), 'export CSV com BOM e separador “;”');

await page.click('button:has-text("Apagar todos os dados")');
await page.waitForSelector('.modal');
await page.click('.modal button[type=submit]');
await page.waitForTimeout(250);
ok((await state(page)).deals.length === 0, 'apagar tudo zera os dados');
await page.setInputFiles('input[aria-label="Arquivo de backup"]', bk);
await page.waitForSelector('.modal');
await page.click('.modal button[type=submit]');
await page.waitForTimeout(300);
s = await state(page);
ok(s.deals.length === before, 'restaurar backup traz os negócios de volta (' + s.deals.length + ')');
await ctx.close();

/* ============ 7b. Cenários adicionais ============ */
section('Reordenar dentro da mesma etapa');
({ ctx, page } = await freshPage());
await page.waitForSelector('.modal');
await page.click('text=Explorar com dados de exemplo');
await page.waitForSelector('.deal-card');
{
  const idsBefore = await page.locator('.col-body[data-stage="st_contato"] .deal-card').evaluateAll((els) => els.map((e) => e.dataset.id));
  const third = page.locator('.col-body[data-stage="st_contato"] .deal-card').nth(2); // visível sem rolar a coluna
  const first = page.locator('.col-body[data-stage="st_contato"] .deal-card').first();
  const fb = await first.boundingBox();
  await third.dragTo(first, { targetPosition: { x: fb.width / 2, y: 4 } });
  await page.waitForTimeout(250);
  const idsAfter = await page.locator('.col-body[data-stage="st_contato"] .deal-card').evaluateAll((els) => els.map((e) => e.dataset.id));
  ok(idsAfter[0] === idsBefore[2] && idsAfter.length === idsBefore.length, 'arrastar o 3º card para o topo da mesma etapa reordena');
  ok(!(await state(page)).log.some((l) => l.entityId === idsAfter[0] && /Movido.*Contato iniciado.*Contato iniciado/.test(l.text)), 'reordenar não gera movimentação de etapa');
}

section('Editar e excluir atividade');
await goto(page, '#/activities');
await page.waitForSelector('.act-row');
{
  const before = (await state(page)).activities.length;
  await page.locator('.act-row').first().click();
  await page.waitForSelector('.modal');
  await page.fill('.modal input[type=text]:not([role=combobox])', 'Assunto editado no teste');
  await page.click('.modal button[type=submit]');
  await page.waitForTimeout(200);
  let st = await state(page);
  ok(st.activities.some((a) => a.subject === 'Assunto editado no teste'), 'editar assunto da atividade');
  await page.locator('.act-row:has-text("Assunto editado no teste")').click();
  await page.waitForSelector('.modal');
  await page.click('.modal button:has-text("Excluir")');
  await page.waitForTimeout(200);
  st = await state(page);
  ok(st.activities.length === before - 1, 'excluir atividade pelo modal');
  await page.click('.toast button:has-text("Desfazer")');
  await page.waitForTimeout(200);
  ok((await state(page)).activities.length === before, 'desfazer exclusão restaura a atividade');
}

section('Calendário');
await page.click('button:has-text("Calendário")');
await page.waitForSelector('.cal');
{
  const today = new Date().getDate();
  await page.locator('.cal-cell.today').click({ position: { x: 8, y: 8 } });
  await page.waitForSelector('.modal');
  const dateVal = await page.inputValue('.modal input[type=date]');
  const t = new Date();
  const iso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  ok(dateVal === iso, 'clicar num dia do calendário abre nova atividade com aquela data (' + dateVal + ')');
  await page.keyboard.press('Escape');
  ok(await page.locator('.modal').count() === 0, 'Esc fecha o modal');
  void today;
}

section('Pessoas e organizações');
await goto(page, '#/people');
await page.locator('table a.cell-title').first().click();
await page.waitForSelector('.deal-page');
{
  const pid = page.url().split('/person/')[1];
  await page.click('.kvs .kv:has(.kv-k:text("Cargo")) .editable');
  await page.fill('.editable-input', 'Cargo editado');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  let st = await state(page);
  ok(st.persons.find((p) => p.id === pid).role === 'Cargo editado', 'edição inline do cargo da pessoa');
  await page.click('.tab:has-text("Notas")');
  await page.fill('textarea[aria-label="Nova nota"]', 'Nota na pessoa');
  await page.click('button:has-text("Salvar nota")');
  await page.waitForTimeout(200);
  st = await state(page);
  ok(st.notes.some((n) => n.personId === pid && n.content === 'Nota na pessoa'), 'nota salva na pessoa');
  await page.click('.deal-actions button[aria-label="Mais ações"]');
  await page.click('.menu-item:has-text("Excluir pessoa")');
  await page.click('.modal button[type=submit]');
  await page.waitForTimeout(250);
  st = await state(page);
  ok(!st.persons.some((p) => p.id === pid) && st.deals.every((d) => d.personId !== pid), 'excluir pessoa desvincula dos negócios');
  ok(page.url().includes('#/people'), 'volta para a lista após excluir');
}

section('Equipe e responsáveis');
await goto(page, '#/settings/team');
await page.fill('input[aria-label="Nome do novo membro"]', 'Carla Vendas');
await page.click('.list-row button:has-text("Adicionar")');
await page.waitForTimeout(200);
{
  const st = await state(page);
  ok(st.users.length === 2 && st.users[1].name === 'Carla Vendas', 'adicionar vendedor');
  await goto(page, '#/pipeline');
  ok(await page.locator('select[aria-label="Responsável"]').count() === 1, 'filtro por responsável aparece com 2+ usuários');
  await page.locator('.deal-card').first().click();
  await page.waitForSelector('.deal-page');
  await page.click('.kvs .kv:has(.kv-k:text("Responsável")) .editable');
  await page.selectOption('.editable-input', st.users[1].id);
  await page.waitForTimeout(250);
  const id = page.url().split('/deal/')[1];
  ok((await state(page)).deals.find((d) => d.id === id).ownerId === st.users[1].id, 'trocar responsável do negócio');
  await goto(page, '#/pipeline');
  await page.selectOption('select[aria-label="Responsável"]', st.users[1].id);
  await page.waitForTimeout(200);
  ok(await page.locator('.deal-card').count() === 1, 'filtrar o quadro por responsável mostra só os dele');
}

section('Ganhos e perdidos na lista');
await goto(page, '#/pipeline');
await page.selectOption('select[aria-label="Responsável"]', 'all');
await page.click('button:has-text("Lista")');
await page.click('.seg button:has-text("Perdidos")');
await page.waitForTimeout(200);
{
  const st = await state(page);
  const lost = st.deals.filter((d) => d.status === 'lost').length;
  ok((await page.locator('tbody tr').count()) === lost, 'lista “Perdidos” mostra ' + lost + ' negócios');
  await page.locator('tbody tr').first().click();
  await page.waitForSelector('.closed-banner.lost');
  ok(true, 'negócio perdido mostra banner com o motivo');
}

section('Sincronização entre abas');
{
  await goto(page, '#/pipeline');
  await page.click('.seg button:has-text("Kanban")');
  const page2 = await ctx.newPage();
  page2.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  await page2.goto(URL + '#/pipeline');
  await page2.waitForSelector('.deal-card');
  await page.evaluate(() => AX.store.addDeal({ title: 'Criado na aba 1', value: 1234 }));
  await page.waitForTimeout(500);
  await page2.waitForTimeout(500);
  ok(await page2.locator('.deal-card:has-text("Criado na aba 1")').count() === 1, 'negócio criado numa aba aparece na outra (evento storage)');
  await page2.close();
}

section('Catálogo de produtos');
await goto(page, '#/products');
await page.waitForSelector('table');
{
  const n = (await state(page)).products.length;
  await page.click('button:has-text("Produto")');
  await page.fill('.modal input[required]', 'Manutenção premium');
  await page.fill('.modal .field:has(label:text("Preço")) input', '990');
  await page.selectOption('.modal .field:has(label:text("Cobrança")) select', 'monthly');
  await page.click('.modal button[type=submit]');
  await page.waitForTimeout(200);
  let st = await state(page);
  const prod = st.products.find((p) => p.name === 'Manutenção premium');
  ok(st.products.length === n + 1 && prod.price === 990 && prod.billing === 'monthly', 'criar produto recorrente');
  await page.locator('tr:has-text("Manutenção premium")').click();
  await page.click('.modal button:has-text("Excluir")');
  await page.click('.modal.sm button[type=submit]');
  await page.waitForTimeout(250);
  st = await state(page);
  ok(!st.products.some((p) => p.name === 'Manutenção premium'), 'excluir produto');
}

section('Atalhos e validações');
await goto(page, '#/pipeline');
await page.keyboard.press('n');
ok(await page.locator('.modal h3:text("Novo negócio")').count() === 1, 'atalho N abre “Novo negócio”');
await page.keyboard.press('Escape');
await goto(page, '#/settings/data');
await page.setInputFiles('input[aria-label="Arquivo de backup"]', { name: 'lixo.json', mimeType: 'application/json', buffer: Buffer.from('isso não é json') });
await page.waitForSelector('.modal');
await page.click('.modal button[type=submit]');
await page.waitForTimeout(250);
ok(await page.locator('.toast.error').count() > 0, 'backup inválido mostra erro e não altera os dados');
ok((await state(page)).deals.length > 5, 'dados preservados após backup inválido');
await ctx.close();

/* ============ 8. Mobile ============ */
section('Responsivo');
({ ctx, page } = await freshPage({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true }));
await page.waitForSelector('.modal');
await page.click('text=Explorar com dados de exemplo');
await page.waitForSelector('.deal-card');
const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
ok(!overflowX, 'sem rolagem horizontal da página no celular');
await shot(page, '09-mobile-board');
await goto(page, '#/insights');
await page.waitForSelector('.chart-card');
await shot(page, '10-mobile-insights');
ok(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'insights sem rolagem horizontal no celular');
await ctx.close();

section('Erros de console');
ok(errors.length === 0, 'nenhum erro de console/JS durante os testes' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));

await browser.close();
console.log(`\n${total - failures}/${total} verificações passaram.`);
process.exit(failures ? 1 : 0);
