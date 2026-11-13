'use strict';
// #3564 (13/11/2026): o planejador só aceita caminhos que existem ou que ficam nas pastas do produto da issue.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { produtoDoTexto, caminhoValido, caminhosRecusados } = require('../../nexia-ai/orchestrator/produtos');
const { caminhosRecusados: daFila, planejarComIA } = require('../../scripts/cortex-fila');
const { LICOES } = require('../../nexia-ai/orchestrator/licoes');

const RAIZ = path.join(__dirname, '..', '..');
const existe = (c) => fs.existsSync(path.join(RAIZ, c));
const PEDIDO_FINANCE = 'Kernex Finance: cotação ao vivo grátis (FIIs, ações, ETFs) + CDI/Selic/IPCA, com selo "atualizado às".';
const parte = (arquivos) => [{ titulo: 'x', tarefa: 'y'.repeat(40), arquivos, depende: [], pronto: 'pronto quando ok' }];

test('PC1. Finance + src/lib/quoteSources.js (pasta de outro produto) = recusado', () => {
  assert.equal(produtoDoTexto(PEDIDO_FINANCE).id, 'finance');
  assert.deepEqual(caminhosRecusados(parte(['src/lib/quoteSources.js']), PEDIDO_FINANCE, existe), ['src/lib/quoteSources.js']);
  assert.deepEqual(caminhosRecusados(parte(['workers/prumo/cotacoes.js']), PEDIDO_FINANCE, existe), ['workers/prumo/cotacoes.js']);
});

test('PC2. Finance + netlify/functions/prumo-lib/cotacoes.js ou arquivo novo em prumo/ = aceito', () => {
  assert.deepEqual(caminhosRecusados(parte(['netlify/functions/prumo-lib/cotacoes.js', 'prumo/novo.js']), PEDIDO_FINANCE, existe), []);
});

test('PC3. sem produto: arquivo novo só em pasta que já existe; arquivo que existe sempre vale', () => {
  assert.equal(caminhoValido('scripts/novo.js', null, existe), true);
  assert.equal(caminhoValido('pasta-que-nao-existe/x.js', null, existe), false);
  assert.equal(caminhoValido('package.json', produtoDoTexto(PEDIDO_FINANCE), existe), true);
  assert.equal(caminhoValido('../fora.js', null, existe), false);
});

test('PC4. a fila recusa o plano ruim e tenta o próximo modelo; a lição está gravada', async () => {
  assert.deepEqual(daFila(parte(['src/lib/quoteSources.js', 'src/screens/Cotacoes.js']), PEDIDO_FINANCE, existe), ['src/lib/quoteSources.js', 'src/screens/Cotacoes.js']);
  const ruim = JSON.stringify([{ titulo: 'a', tarefa: 'Criar a fonte de cotações ao vivo para o Finance agora.', arquivos: ['src/lib/quoteSources.js'], pronto: 'arquivo criado e testado' }, { titulo: 'b', tarefa: 'Criar a tela de cotações ao vivo para o Finance agora.', arquivos: ['src/screens/Cotacoes.js'], pronto: 'tela criada e testada' }]);
  const bom = JSON.stringify([{ titulo: 'a', tarefa: 'Criar a fonte de cotações ao vivo para o Finance agora.', arquivos: ['netlify/functions/prumo-lib/cotacoes.js'], pronto: 'arquivo criado e testado' }, { titulo: 'b', tarefa: 'Mostrar as cotações ao vivo na tela do Finance agora.', arquivos: ['prumo/cotacoes.js'], pronto: 'tela criada e testada' }]);
  let n = 0;
  const router = { capabilities: () => ({ available: true }), chat: async () => ({ text: n++ === 0 ? ruim : bom }) };
  const cwd = process.cwd(); process.chdir(RAIZ);
  try {
    const r = await planejarComIA(PEDIDO_FINANCE, router, [{ provider: 'groq', model: 'a' }, { provider: 'openrouter', model: 'b' }]);
    assert.ok(r && r.partes, 'segundo modelo deu plano válido');
    assert.deepEqual(r.partes.flatMap((p) => p.arquivos), ['netlify/functions/prumo-lib/cotacoes.js', 'prumo/cotacoes.js']);
  } finally { process.chdir(cwd); }
  assert.ok(LICOES.some((l) => /pasta que o produto não usa/.test(l)));
});
