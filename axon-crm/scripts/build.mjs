/* Gera dois arquivos únicos (CSS e JS embutidos) em dist/:
     axon-crm.html           — para abrir direto no navegador / hospedar em qualquer site estático
     axon-crm.artifact.html  — variante para publicar como artefato do Claude (sem <html>/<head>; usa o armazenamento
                               na nuvem e os downloads do Claude, ver js/cloud.js)
   Uso: node scripts/build.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const src = read('index.html');
// evita que um "</script>" dentro do código feche a tag antes da hora
const safeJs = (code) => code.trim().replace(/<\/script/gi, '<\\/script');

const cssFiles = [...src.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]);
const jsFiles = [...src.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);

/* ---- 1. arquivo único padrão ---- */
let html = src;
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => `<style>\n${read(href).trim()}\n</style>`);
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, s) => `<script>\n${safeJs(read(s))}\n</script>`);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'axon-crm.html'), html);

/* ---- 2. variante para artefato do Claude ---- */
const title = (src.match(/<title>([^<]+)<\/title>/) || [, 'Axon CRM'])[1];
const themeScript = (src.match(/<script>([\s\S]*?)<\/script>/) || [, ''])[1];
const artifact = [
  `<title>${title}</title>`,
  `<style>\n${cssFiles.map(read).map((c) => c.trim()).join('\n\n')}\n</style>`,
  `<script>${themeScript}</script>`,
  '<div id="app"></div>',
  ...jsFiles.map((f) => `<script>\n${safeJs(read(f))}\n</script>`),
].join('\n');
fs.writeFileSync(path.join(root, 'dist', 'axon-crm.artifact.html'), artifact);

const kb = (f) => (fs.statSync(path.join(root, 'dist', f)).size / 1024).toFixed(0);
console.log(`dist/axon-crm.html — ${cssFiles.length} CSS + ${jsFiles.length} JS embutidos, ${kb('axon-crm.html')} KB`);
console.log(`dist/axon-crm.artifact.html — variante para artefato, ${kb('axon-crm.artifact.html')} KB`);
