/* Gera dist/axon-crm.html — o CRM inteiro em UM arquivo (CSS e JS embutidos).
   Útil para abrir offline, enviar por e-mail ou publicar em qualquer hospedagem estática.
   Uso: node scripts/build.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

let html = read('index.html');
let css = 0, js = 0;

html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => {
  css++;
  return `<style>\n${read(href).trim()}\n</style>`;
});
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
  js++;
  // evita que um "</script>" dentro do código feche a tag antes da hora
  return `<script>\n${read(src).trim().replace(/<\/script/gi, '<\\/script')}\n</script>`;
});

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'axon-crm.html');
fs.writeFileSync(out, html);
console.log(`dist/axon-crm.html — ${css} CSS + ${js} JS embutidos, ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);
