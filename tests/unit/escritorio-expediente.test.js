'use strict';
// Expediente das áreas (13/11/2026): cada área posta só com dado real; sem dado, não inventa.
const test = require('node:test');
const assert = require('node:assert');
const ex = require('../../nexia-ai/escritorio/expediente');
const { rodar } = require('../../scripts/escritorio-expediente');

const AGORA = '2026-11-13T18:00:00Z';
const h = (n) => new Date(Date.parse(AGORA) - n * 36e5).toISOString();

test('EX1. Suporte: todos no ar = feito; algum fora = alerta + pedido à T.I.', () => {
  assert.equal(ex.suporte([{ nome: 'A', ok: true }])[0].tipo, 'feito');
  const r = ex.suporte([{ nome: 'A', ok: true }, { nome: 'B', ok: false, motivo: '503' }]);
  assert.deepEqual(r.map((x) => x.tipo), ['alerta', 'pedido']);
  assert.equal(r[1].para, 'ti');
  assert.deepEqual(ex.suporte([]), [], 'sem dado não posta');
});

test('EX2. T.I.: só olha 24 h; CI verde = feito; falhas viram alerta com os nomes', () => {
  const runs = [
    { name: 'CI', head_branch: 'develop', status: 'completed', conclusion: 'success', created_at: h(1) },
    { name: 'Sentinela', status: 'completed', conclusion: 'failure', created_at: h(2) },
    { name: 'Velho', status: 'completed', conclusion: 'failure', created_at: h(30) },
  ];
  const r = ex.ti(runs, AGORA);
  assert.equal(r[0].tipo, 'feito');
  assert.match(r[1].texto, /Sentinela/);
  assert.doesNotMatch(r[1].texto, /Velho/);
  assert.deepEqual(ex.ti([], AGORA), []);
});

test('EX3. Produção, RH e Marketing', () => {
  assert.equal(ex.producao({ fechadas24h: 3, naFila: 2, travadas: 1, prsJuntados24h: 4 })[0].tipo, 'alerta');
  const prs = [{ closed_at: h(1), merged_at: h(1) }, { closed_at: h(2), merged_at: null }, { closed_at: h(40), merged_at: null }];
  assert.match(ex.rh(prs, AGORA)[0].texto, /1 de 2 PRs/);
  const m = ex.marketing('1. Antes e depois de um site de barbearia\n2) Dica: responda clientes rápido no WhatsApp\n- Bastidores da KERNEX');
  assert.equal(m[0].tipo, 'precisa-ok', 'post só sai com OK do dono');
  assert.deepEqual(ex.marketing(''), [], 'IA não respondeu: não inventa');
});

test('EX4. rodada a seco não grava nada e não quebra sem token', async () => {
  const antes = { ...process.env }; delete process.env.GH_TOKEN; delete process.env.GITHUB_TOKEN; delete process.env.GROQ_API_KEY;
  const postados = [];
  const fetchOrig = global.fetch; global.fetch = async () => ({ ok: true, status: 200 });
  try {
    const r = await rodar({ mural: { ligado: () => true, postar: async (x) => postados.push(x) }, agora: AGORA, log: () => {}, seco: true });
    assert.ok(r.ok); assert.equal(postados.length, 0);
  } finally { global.fetch = fetchOrig; Object.assign(process.env, antes); }
});
