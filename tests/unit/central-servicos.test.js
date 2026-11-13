'use strict';
// C2-E (13/11, dono: "9 de 11 o quê? o que preciso fazer?"): cada serviço medido explica o porquê e como resolver.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');
const PASTA = path.join(__dirname, '../../src/pages/central/kernex');

async function carregar() {
  const out = ts.transpileModule(fs.readFileSync(path.join(PASTA, 'servicosRegras.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kxs-'));
  fs.writeFileSync(path.join(dir, 's.mjs'), out);
  return import(pathToFileURL(path.join(dir, 's.mjs')).href);
}

test('SV1. fora do ar diz o motivo e o passo a passo', async () => {
  const { explicarServico } = await carregar();
  const a = explicarServico({ id: 'x', ok: false, codigo: 404 }, { id: 'x', nome: 'Site X', url: 'https://x' });
  assert.equal(a.cor, 'vermelho'); assert.match(a.situacao, /não existe/); assert.ok(a.passos.length >= 1); assert.equal(a.nome, 'Site X');
  assert.match(explicarServico({ id: 'y', ok: false, codigo: 522 }).situacao, /erro no servidor/);
  const z = explicarServico({ id: 'z', ok: false });
  assert.match(z.situacao, /não respondeu/); assert.equal(z.precisaDono, true);
  assert.equal(explicarServico({ id: 'w', ok: true, codigo: 200, tempo: 120 }).cor, 'verde');
  assert.equal(explicarServico({ id: 'v', ok: null }).cor, 'cinza', 'sem medição nunca vira verde');
});

test('SV2. lista põe fora do ar primeiro e o resumo diz o quê, não só o número', async () => {
  const { listarServicos, resumoServicos } = await carregar();
  const m = [{ id: 'a', ok: true }, { id: 'b', ok: false, codigo: 500 }, { id: 'c', ok: null }];
  assert.deepEqual(listarServicos(m).map((x) => x.id), ['b', 'c', 'a']);
  assert.equal(resumoServicos(m), '1 de 2 sites e sistemas fora do ar');
  assert.equal(resumoServicos([{ id: 'a', ok: true }]), 'Todos os 1 sites e sistemas no ar');
  assert.equal(resumoServicos([]), 'Serviços: sem medição agora');
});

test('SV3. "Ligar avisos" liga de verdade na Central (não manda para o Cortex)', () => {
  const s = fs.readFileSync(path.join(PASTA, 'Config.tsx'), 'utf8');
  assert.ok(!/href="\/cortex">Ligar avisos/.test(s));
  assert.ok(/avisos_chave/.test(s) && /avisos_assinar/.test(s) && /requestPermission/.test(s));
});

test('SV4. identidade KERNEX: símbolo oficial e paleta da marca', () => {
  assert.ok(/\/central\/logos\/kernex\.svg/.test(fs.readFileSync(path.join(PASTA, 'Icone.tsx'), 'utf8')));
  const t = fs.readFileSync(path.join(PASTA, 'tema.ts'), 'utf8');
  const i = t.lastIndexOf('IDENTIDADE KERNEX');
  assert.ok(i > t.lastIndexOf('LUXO'), 'a camada da marca vem por último');
  assert.ok(/#060c1c/.test(t.slice(i)) && /#6fb8ff/.test(t.slice(i)) && /#2fd3c7/.test(t.slice(i)));
  assert.ok(/Inteligência que resolve\./.test(fs.readFileSync(path.join(PASTA, 'Casca.tsx'), 'utf8')));
});
