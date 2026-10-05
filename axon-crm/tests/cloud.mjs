/* Axon CRM — testes do modo nuvem (artefato do Claude), com um host falso que imita window.claude (db + downloads).
   Uso:  node tests/cloud.mjs   (rode `npm run build` antes; usa PLAYWRIGHT_PATH como em e2e.mjs) */
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_PATH || 'playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGETS = {
  'index.html': 'file://' + path.join(ROOT, 'index.html'),
  'dist/axon-crm.artifact.html': 'file://' + path.join(ROOT, 'dist', 'axon-crm.artifact.html'),
};

let failures = 0, total = 0;
const ok = (cond, msg) => { total++; if (!cond) { failures++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

// Imita o contrato do db: caminhos válidos, dados congelados na leitura, limite de 256 KiB por documento.
const FAKE_HOST = `(() => {
  const KEY = '__fake_db';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const save = (m) => localStorage.setItem(KEY, JSON.stringify(m));
  window.__stats = { sets: 0, deletes: 0, paths: [] };
  const SEG = /^[A-Za-z0-9_\\-.~:@+]{1,200}$/;
  function check(p, even) {
    const parts = p.split('/');
    if (parts.length > 16 || p.length > 1000) throw new TypeError('caminho longo demais');
    parts.forEach((s) => { if (!SEG.test(s) || s === '.' || s === '..') throw new TypeError('segmento inválido: ' + s); });
    if ((parts.length % 2 === 0) !== even) throw new TypeError('paridade errada: ' + p);
  }
  const freeze = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(freeze); Object.freeze(o); } return o; };
  const fail = (code, message) => Object.assign(new Error(message), { code, message });
  const snap = (id, data) => ({ id, exists: data !== undefined, data: () => data, metadata: { fromCache: false, hasPendingWrites: false } });
  const db = {
    doc(p) { check(p, true); const id = p.split('/').pop(); return {
      id, path: p,
      async get() { const m = load(); return snap(id, m[p] === undefined ? undefined : freeze(JSON.parse(JSON.stringify(m[p])))); },
      async set(data) {
        if (window.__failWrites) throw fail(window.__failWrites, 'falha forçada');
        const s = JSON.stringify(data);
        if (s.length > 256 * 1024) throw fail('invalid_argument', 'documento grande demais');
        window.__stats.sets++; window.__stats.paths.push(p);
        const m = load(); m[p] = JSON.parse(s); save(m);
      },
      async delete() { window.__stats.deletes++; const m = load(); delete m[p]; save(m); },
    }; },
    collection(p) { check(p, false); const depth = p.split('/').length + 1; return {
      path: p,
      async get() {
        const m = load();
        const docs = Object.keys(m).filter((k) => k.startsWith(p + '/') && k.split('/').length === depth).map((k) => snap(k.split('/').pop(), freeze(JSON.parse(JSON.stringify(m[k])))));
        return { docs, size: docs.length, empty: !docs.length };
      },
    }; },
  };
  window.claude = { use: async (name) => name === 'db' ? (window.__noDb ? null : db) : name === 'downloads' ? { save: async ({ filename, data }) => { (window.__saves = window.__saves || []).push({ filename, data }); return { status: 'saved' }; } } : null };
})();`;

const browser = await chromium.launch();
const errors = [];
async function newPage(url, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  if (!opts.noHost) await page.addInitScript(FAKE_HOST);
  if (opts.noDb) await page.addInitScript('window.__noDb = true;');
  await page.goto(url);
  return { ctx, page };
}
const saved = (page) => page.evaluate(() => AX.cloud.whenSaved());
const fakeDb = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('__fake_db') || '{}'));

for (const [name, url] of Object.entries(TARGETS)) {
  console.log('\n=== ' + name + ' ===');

  console.log('Primeira abertura (nuvem vazia)');
  let { ctx, page } = await newPage(url);
  await page.waitForSelector('.modal');
  ok(await page.evaluate(() => AX.store.mode) === 'cloud', 'usa o backend de nuvem quando window.claude.db existe');
  await page.click('text=Explorar com dados de exemplo');
  await page.waitForSelector('.deal-card');
  await saved(page);
  let db = await fakeDb(page);
  const st = await page.evaluate(() => JSON.parse(JSON.stringify(AX.store.s)));
  const keys = Object.keys(db);
  ok(keys.includes('meta/config'), 'grava meta/config');
  const countIn = (coll) => keys.filter((k) => k.startsWith(coll + '/')).reduce((n, k) => n + Object.keys(db[k].r).length, 0);
  ok(countIn('deals') === st.deals.length && countIn('activities') === st.activities.length && countIn('persons') === st.persons.length && countIn('log') === st.log.length,
    'todos os registros estão nos baldes (negócios ' + st.deals.length + ', atividades ' + st.activities.length + ', log ' + st.log.length + ')');
  ok(keys.length <= 1 + 7 * 32 && keys.every((k) => JSON.stringify(db[k]).length < 240 * 1024), 'poucos documentos (' + keys.length + ') e todos abaixo de 240 KiB');
  ok(await page.evaluate(() => localStorage.getItem('axoncrm.v1')) === null, 'não duplica os dados no localStorage');
  ok(await page.locator('.sync.saved').count() === 1, 'indicador mostra “Salvo na nuvem”');
  ok(!(await page.locator('.banner').count()), 'sem aviso de backup (os dados estão na nuvem)');

  console.log('Gravação incremental');
  await page.evaluate(() => { window.__stats = { sets: 0, deletes: 0, paths: [] }; });
  await page.evaluate(() => { const d = AX.store.s.deals.find((x) => x.status === 'open'); AX.store.moveDeal(d.id, 'st_prop'); });
  await saved(page);
  const stats = await page.evaluate(() => window.__stats);
  ok(stats.sets >= 1 && stats.sets <= 3, 'mover um negócio regrava só ' + stats.sets + ' documento(s): ' + stats.paths.join(', '));

  console.log('Recarregar');
  await page.reload();
  await page.waitForSelector('.deal-card');
  await page.waitForTimeout(800);
  ok((await page.evaluate(() => AX.store.s.deals.length)) === st.deals.length, 'dados voltam da nuvem após recarregar');
  ok((await page.evaluate(() => window.__stats.sets)) === 0, 'carregar não grava nada (sem diferenças falsas de ordem de chaves)');
  await page.evaluate(() => { const d = AX.store.s.deals.find((x) => x.status === 'open'); AX.store.updateDeal(d.id, { title: 'Editado após recarregar' }); });
  await saved(page);
  ok((await page.evaluate(() => window.__stats.sets)) >= 1, 'editar dados carregados (congelados no db) funciona e grava');

  console.log('Exclusão');
  const victim = await page.evaluate(() => AX.store.s.deals[0].id);
  await page.evaluate((id) => AX.store.deleteDeal(id), victim);
  await saved(page);
  db = await fakeDb(page);
  ok(!Object.values(db).some((d) => d.r && d.r[victim]), 'negócio excluído some dos baldes');

  console.log('Backup via capability downloads');
  await page.evaluate(() => { location.hash = '#/settings/data'; });
  await page.click('button:has-text("Exportar backup")');
  await page.waitForTimeout(300);
  const saves = await page.evaluate(() => window.__saves || []);
  ok(saves.length === 1 && /\.json$/.test(saves[0].filename) && JSON.parse(saves[0].data).deals.length === st.deals.length - 1, 'backup JSON entregue pelo downloads.save');
  await page.click('.card:has-text("planilhas") button:has-text("Negócios")');
  await page.waitForTimeout(300);
  const saves2 = await page.evaluate(() => window.__saves || []);
  ok(saves2.length === 2 && /\.csv$/.test(saves2[1].filename) && saves2[1].data.charCodeAt(0) === 0xfeff, 'CSV entregue pelo downloads.save');
  ok(await page.locator('text=Seus dados ficam salvos na nuvem').count() === 1, 'texto de backup explica o armazenamento na nuvem');

  console.log('Atualização vinda de outro aparelho');
  await page.evaluate(() => { location.hash = '#/pipeline'; });
  await page.waitForSelector('.deal-card');
  await page.evaluate(() => { window.__stats = { sets: 0, deletes: 0, paths: [] }; });
  const target = await page.evaluate(() => { const d = AX.store.s.deals.find((x) => x.status === 'open'); return d.id; });
  await page.evaluate((id) => {
    const m = JSON.parse(localStorage.getItem('__fake_db'));
    for (const k of Object.keys(m)) if (m[k].r && m[k].r[id] && k.startsWith('deals/')) m[k].r[id].title = 'Título vindo de outro aparelho';
    localStorage.setItem('__fake_db', JSON.stringify(m));
  }, target);
  await page.evaluate(() => AX.cloud.refresh(true));
  await page.waitForTimeout(400);
  ok(await page.evaluate((id) => AX.store.q.deal(id).title, target) === 'Título vindo de outro aparelho', 'refresh traz a alteração remota para a tela');
  ok(await page.evaluate(() => window.__stats.sets) === 0, 'aplicar dados remotos não gera gravação de volta');

  console.log('Falha ao gravar');
  await page.evaluate(() => { window.__failWrites = 'quota_exceeded'; });
  await page.evaluate(() => AX.store.updateDeal(AX.store.s.deals[0].id, { title: 'Vai falhar' }));
  await page.waitForSelector('.sync.error', { timeout: 15000 });
  ok(/Não salvo/.test(await page.locator('.sync.error').innerText()), 'indicador mostra “Não salvo” quando a gravação falha');
  await page.evaluate(() => { window.__failWrites = null; });
  await page.click('.sync.error');
  await saved(page);
  ok(await page.locator('.sync.saved').count() === 1, 'clicar no indicador tenta de novo e volta a “Salvo”');
  db = await fakeDb(page);
  ok(Object.values(db).some((d) => d.r && Object.values(d.r).some((r) => r.title === 'Vai falhar')), 'a alteração pendente foi gravada na nova tentativa');

  console.log('Tema do host');
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await page.waitForTimeout(150);
  const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.evaluate(() => { delete document.documentElement.dataset.theme; });
  await page.waitForTimeout(150);
  const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(darkBg !== lightBg && darkBg === 'rgb(11, 14, 20)', 'segue o data-theme definido pelo host (escuro ' + darkBg + ' / claro ' + lightBg + ')');
  await ctx.close();

  console.log('Sem db (deslogado) cai para o navegador');
  ({ ctx, page } = await newPage(url, { noDb: true }));
  await page.waitForSelector('.modal');
  ok(await page.evaluate(() => AX.store.mode) === 'browser', 'sem db usa localStorage');
  await page.click('text=Começar do zero');
  await page.waitForSelector('.board');
  await page.evaluate(() => AX.store.addDeal({ title: 'Local' }));
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => !!localStorage.getItem('axoncrm.v1')), 'dados salvos no navegador');
  ok(await page.locator('.sync:not(.hidden)').count() === 0, 'indicador de nuvem oculto');
  await ctx.close();

  console.log('Fora do Claude (sem window.claude)');
  ({ ctx, page } = await newPage(url, { noHost: true }));
  await page.waitForSelector('.modal');
  ok(await page.evaluate(() => AX.store.mode) === 'browser' && !(await page.evaluate(() => !!window.claude)), 'abre normalmente como arquivo comum');
  await ctx.close();
}

console.log('\nErros de console');
ok(errors.length === 0, 'nenhum erro de console/JS' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
await browser.close();
console.log(`\n${total - failures}/${total} verificações passaram.`);
process.exit(failures ? 1 : 0);
