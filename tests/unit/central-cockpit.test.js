'use strict';
// Cockpit (12/11, PC 2): "Aprovar e juntar" para PRs da equipe e quadro do PC 1/PC 2 na Central nova.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const PASTA = path.join(__dirname, '../../src/pages/central/kernex');

// Transpila o arquivo e devolve só as funções/constantes puras pedidas (sem React rodando).
function puro(arquivo, nomes) {
  const src = fs.readFileSync(path.join(PASTA, arquivo), 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText;
  const mod = { exports: {} };
  const fakeRequire = () => new Proxy({}, { get: () => () => null });
  new Function('module', 'exports', 'require', 'React', out)(mod, mod.exports, fakeRequire, { createElement: () => null });
  return Object.fromEntries(nomes.map((n) => [n, mod.exports[n]]));
}

test('CK1. Juntar aparece para PR da equipe e do Cortex (ramo nexia/), nunca rascunho nem quem já entra sozinho', () => {
  const { podeJuntar } = puro('Publicacoes.tsx', ['podeJuntar']);
  assert.equal(podeJuntar({ ramo: 'nexia/pc2-24', rascunho: false, automerge: false }), true);
  assert.equal(podeJuntar({ ramo: 'nexia/contrato-1-x', rascunho: false, automerge: false }), true);
  assert.equal(podeJuntar({ ramo: 'nexia/pc1-13', rascunho: true, automerge: false }), false);
  assert.equal(podeJuntar({ ramo: 'nexia/pc1-13', rascunho: false, automerge: true }), false);
  assert.equal(podeJuntar({ ramo: 'jules-123', rascunho: false, automerge: false }), false);
  assert.equal(podeJuntar({ ramo: 'cortex/contrato-3', rascunho: false, automerge: false }), false);
});

test('CK2. Juntar usa a ação do servidor que só põe automerge (entra com CI verde)', () => {
  const tela = fs.readFileSync(path.join(PASTA, 'Publicacoes.tsx'), 'utf8');
  assert.match(tela, /acao: "juntar"/);
  const srv = fs.readFileSync(path.join(__dirname, '../../netlify/functions/central/pedidos-acoes.js'), 'utf8');
  assert.match(srv, /startsWith\('nexia\/'\)/);
  assert.match(srv, /labels: \['automerge'\]/);
});

test('CK3. quadro: fazendo primeiro, depois fila em ordem de número; feitas não aparecem', () => {
  const { ordenarQuadro } = puro('Maquinas.tsx', ['ordenarQuadro']);
  const t = [
    { id: 5, titulo: 'e', status: 'fila', dono: '' }, { id: 2, titulo: 'b', status: 'feito', dono: 'pc1' },
    { id: 9, titulo: 'i', status: 'fazendo', dono: 'pc2' }, { id: 3, titulo: 'c', status: 'fila', dono: '' },
    { id: 7, titulo: 'g', status: 'fazendo', dono: 'pc1' },
  ];
  assert.deepEqual(ordenarQuadro(t).map((x) => x.id), [7, 9, 3, 5]);
  assert.deepEqual(ordenarQuadro(null), []);
});

test('CK4. quadro lê a parte "quadro" e avisa quando o servidor ainda não tem (sem inventar dado)', () => {
  const tela = fs.readFileSync(path.join(PASTA, 'Maquinas.tsx'), 'utf8');
  assert.match(tela, /ler<[^>]*>\("parte=quadro"\)/);
  assert.match(tela, /ainda não está ligado no servidor/);
  assert.match(tela, /<QuadroEquipe \/>/);
});
