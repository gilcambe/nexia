// Entretenimento no cardio (apps/body-coach/src/lib/entretenimento.ts): links só de apps conhecidos, grátis.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');

async function carregar() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-tela-'));
  const src = fs.readFileSync(path.join(__dirname, '../../apps/body-coach/src/lib/entretenimento.ts'), 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  fs.writeFileSync(path.join(dir, 'e.mjs'), out);
  return import(pathToFileURL(path.join(dir, 'e.mjs')).href);
}

test('abre a série salva na busca do app, ou o início do app sem série', async () => {
  const { abrirTela, APPS_TELA } = await carregar();
  assert.equal(abrirTela('netflix', 'The Boys'), 'https://www.netflix.com/search?q=The%20Boys');
  assert.equal(abrirTela('prime', ''), 'https://www.primevideo.com/');
  assert.equal(abrirTela('desconhecido'), 'https://www.netflix.com/browse');
  for (const a of APPS_TELA) assert.match(a.busca('x&y'), /^https:\/\/[a-z.]+\/.*x%26y/);
});

test('tempo de cardio do texto do plano e quanto de série cabe', async () => {
  const { minutosDoTexto, episodiosNoCardio } = await carregar();
  assert.equal(minutosDoTexto('Opcional após força, 10–15 min'), 15);
  assert.equal(minutosDoTexto(undefined), 0);
  assert.match(episodiosNoCardio(45), /drama/);
  assert.match(episodiosNoCardio(120), /filme/);
});
