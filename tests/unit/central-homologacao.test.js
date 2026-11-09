'use strict';
// #3269: tela Homologação da Central — backend lê só dado verdadeiro do GitHub.
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('../../netlify/functions/central/homologacao.js');
const { compactar } = require('../../scripts/homologacao/publicar-check.js');

const RESULTADO = { quando: '2026-11-09T06:00:00Z', commit: 'abc1234', aprovado: false, produtos: {
  'kernex-finance': { status: 'verde', total: 26, verdes: 26, casos: [{ id: 'KF-ARQ', status: 'verde' }] },
  central: { status: 'vermelho', total: 2, verdes: 1, casos: [{ id: 'U-central-x', status: 'vermelho', titulo: 'x', log: 'erro'.repeat(500) }, { id: 'U-central-y', status: 'verde' }] },
} };

function ghFalso({ privado = 'sucesso', semResultado = false } = {}) {
  const chamadas = [];
  const gh = async (caminho, init) => {
    chamadas.push([caminho, init && init.method]);
    if (caminho.includes('/avaya-gsd/')) {
      if (privado === 'sem-acesso') throw new Error('Not Found');
      if (init) return {};
      return { workflow_runs: [{ status: 'completed', conclusion: privado === 'sucesso' ? 'success' : 'failure', updated_at: '2026-11-09T05:00:00Z', html_url: 'https://x/run' }] };
    }
    if (caminho.includes('/dispatches')) return {};
    if (caminho.includes('/actions/workflows/ci.yml/runs')) return { workflow_runs: [{ status: 'in_progress', head_sha: 'novo' }, { status: 'completed', head_sha: 'abc1234', html_url: 'https://x/ci' }] };
    if (caminho.includes('/commits/abc1234/check-runs')) return { check_runs: semResultado ? [] : [{ html_url: 'https://x/check', output: { text: JSON.stringify(compactar(RESULTADO)) } }] };
    throw new Error('caminho inesperado ' + caminho);
  };
  return { gh, chamadas };
}

test('HC1. mostra verde/vermelho por produto do último CI concluído da develop', async () => {
  const { gh } = ghFalso();
  const d = await h.carregar(gh);
  assert.equal(d.aprovado, false);
  assert.equal(d.produtos.central.status, 'vermelho');
  assert.equal(d.produtos['kernex-finance'].verdes, 26);
  assert.equal(d.produtos.central.falhas[0].id, 'U-central-x');
  assert.ok(d.produtos.central.falhas[0].log.length <= 600, 'log curto');
  assert.equal(d.commit, 'abc1234'); assert.equal(d.rodandoAgora, true);
  assert.equal(d.gsdLab.status, 'verde');
  assert.ok(d.origem && d.conferidoEm);
});

test('HC2. sem resultado = nunca rodou (nada inventado); sem acesso ao repo privado = "sem acesso"', async () => {
  const { gh } = ghFalso({ privado: 'sem-acesso', semResultado: true });
  const d = await h.carregar(gh);
  assert.equal(d.aprovado, null);
  assert.deepEqual(d.produtos, {});
  assert.equal(d.gsdLab.status, 'sem-acesso');
});

test('HC3. Rodar tudo dispara o CI da develop e o portão do GSD Lab', async () => {
  const { gh, chamadas } = ghFalso();
  const r = await h.rodar(gh);
  assert.equal(r.ok, true);
  assert.ok(chamadas.some(([c, m]) => c === '/repos/gilcambe/nexia/actions/workflows/ci.yml/dispatches' && m === 'POST'));
  assert.ok(chamadas.some(([c, m]) => c.includes('/avaya-gsd/actions/workflows/homologacao.yml/dispatches') && m === 'POST'));
  assert.match(r.mensagem, /GSD Lab/);
});

test('HC4. o CI grava o resultado e a tela tem o menu Homologação', () => {
  const fs = require('fs');
  const ci = fs.readFileSync(require.resolve('../../.github/workflows/ci.yml'), 'utf8');
  assert.match(ci, /name: Homologação/);
  assert.match(ci, /scripts\/homologacao\/publicar-check\.js/);
  assert.match(fs.readFileSync(require.resolve('../../.github/workflows/auto-merge.yml'), 'utf8'), /\.name == "Homologação"/);
  assert.match(fs.readFileSync(require.resolve('../../src/pages/central/kernex/regras.ts'), 'utf8'), /id: "homologacao", nome: "Homologação"/);
  assert.match(fs.readFileSync(require.resolve('../../netlify/functions/pedidos.js'), 'utf8'), /qs\.homologacao/);
});
