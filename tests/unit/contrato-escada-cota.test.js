'use strict';
// Melhoria 24 do Cortex (17/11/2026). Na #3850 (Finance, ler o print) as IAs grátis não fizeram e foi o Claude Pro:
//  - o Gemini (que resolveu as tarefas do ZeloMe) NEM FOI TENTADO: o placar compartilhado (D1) tinha marcado ele
//    sem cota por causa de outro robô e a escada o tirou SEM AVISO;
//  - mistral 402 "API budget exhausted" e llm7 "Daily token quota exceeded. Retry after 3600" fizeram o Cortex
//    esperar 45 s cada como se fosse limite por minuto;
//  - nvidia/openai/gpt-oss-120b responde 410 "reached its end of life" e continua na escada.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { executar, lerContrato } = require('../../nexia-ai/contrato/executor');
const { createPlacar } = require('../../nexia-ai/model-router/cota');

const F = '```';
const ARQ = (v) => `ARQUIVO: src/a.js\n${F}js\nmodule.exports = ${v};\n${F}`;
function cenario() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'escada-'));
  fs.mkdirSync(path.join(raiz, 'tests')); fs.mkdirSync(path.join(raiz, 'src'));
  fs.writeFileSync(path.join(raiz, 'src/a.js'), 'module.exports = 0;\n');
  fs.writeFileSync(path.join(raiz, 'tests/a.test.js'), '// teste\n');
  return raiz;
}
const c = () => lerContrato('Faça a função\nArquivos: `src/a.js`\nTeste: `node --test tests/a.test.js`');
const rodarTeste = (raiz) => async () => (/= 10;/.test(fs.readFileSync(path.join(raiz, 'src/a.js'), 'utf8')) ? { ok: true, saida: 'ok' } : { ok: false, saida: '✖ x (1ms)\nℹ fail 1', completo: '✖ x (1ms)\nℹ fail 1' });
function router(porModelo) {
  const chamadas = [];
  return { chamadas, chat: async (m) => {
    chamadas.push(m.model);
    const r = (porModelo[m.model] || []).shift();
    if (r instanceof Error) throw r;
    return { text: r || '', stop_reason: 'stop' };
  } };
}
const erro = (status, msg) => Object.assign(new Error(`${status} ${msg}`), { details: { status, upstream: msg } });
const base = { memoria: false, porModelo: 1, extrasMax: 0, revisor: false };

test('modelo marcado sem cota por OUTRO robô vai para o FIM da escada (não some) e o log diz por quê', async () => {
  const raiz = cenario();
  const placar = createPlacar();
  placar.marcar({ provider: 'google', model: 'gemini-3.5-flash' }, 'rate', 10 * 60 * 1000);
  const rt = router({ 'gemini-3.5-flash': [ARQ(10)], fraca: [ARQ(3)] });
  const logs = [];
  const r = await executar({ ...base, contrato: c(), raiz, router: rt, placar, esperar429Ms: 0, log: (s) => logs.push(s),
    modelos: [{ provider: 'google', model: 'gemini-3.5-flash' }, { provider: 'k', model: 'fraca' }], rodarTeste: rodarTeste(raiz) });
  assert.deepStrictEqual(rt.chamadas, ['fraca', 'gemini-3.5-flash'], 'a livre primeiro; a marcada no fim, mas TENTADA');
  assert.strictEqual(r.ok, true);
  assert.ok(logs.some((l) => /gemini-3\.5-flash/.test(l) && /placar|sem cota/i.test(l) && /fim/i.test(l)), 'o log avisa que foi para o fim da escada');
});

test('402 (verba esgotada) e cota DO DIA esgotada: pula na hora, sem esperar 45 s, e marca no placar', async () => {
  const raiz = cenario();
  const placar = createPlacar();
  const rt = router({
    'mistral-small-latest': [erro(402, '{"message":"API budget exhausted.","type":"billing_api_budget_exhausted"}')],
    'codestral-latest': [erro(429, '{"error":{"message":"Daily token quota exceeded. Retry after 3600 seconds.","type":"insufficient_quota"}}')],
    boa: [ARQ(10)],
  });
  const logs = [];
  const t0 = Date.now();
  const r = await executar({ ...base, contrato: c(), raiz, router: rt, placar, esperar429Ms: 3000, log: (s) => logs.push(s),
    modelos: [{ provider: 'mistral', model: 'mistral-small-latest' }, { provider: 'llm7', model: 'codestral-latest' }, { provider: 'b', model: 'boa' }], rodarTeste: rodarTeste(raiz) });
  assert.strictEqual(r.ok, true);
  assert.ok(Date.now() - t0 < 2500, 'não pode esperar: 402 e cota do dia não voltam em 45 s');
  assert.deepStrictEqual(rt.chamadas, ['mistral-small-latest', 'codestral-latest', 'boa'], 'cada uma tentada UMA vez');
  assert.ok(placar.bloqueado({ provider: 'mistral', model: 'mistral-small-latest' }), '402 marca no placar');
  assert.ok(placar.bloqueado({ provider: 'llm7', model: 'codestral-latest' }), 'cota do dia marca no placar');
  assert.ok(!logs.some((l) => /esperando/.test(l)), 'nenhum "esperando" no log');
});

test('modelo MORTO (410 Gone / end of life / 404 model not found) fica fora por 7 dias', async () => {
  let agora = Date.parse('2026-11-17T00:00:00Z');
  const placar = createPlacar({ agora: () => agora });
  const raiz = cenario();
  const rt = router({
    'openai/gpt-oss-120b': [erro(410, '{"title":"Gone","detail":"The model \'openai/gpt-oss-120b\' has reached its end of life on 2026-09-03"}')],
    'sumiu-404': [erro(404, '{"error":{"message":"model not found: sumiu-404"}}')],
    boa: [ARQ(10)],
  });
  const r = await executar({ ...base, contrato: c(), raiz, router: rt, placar, esperar429Ms: 0, log: () => {},
    modelos: [{ provider: 'nvidia', model: 'openai/gpt-oss-120b' }, { provider: 'x', model: 'sumiu-404' }, { provider: 'b', model: 'boa' }], rodarTeste: rodarTeste(raiz) });
  assert.strictEqual(r.ok, true);
  agora += 6 * 24 * 3600 * 1000;
  assert.ok(placar.bloqueado({ provider: 'nvidia', model: 'openai/gpt-oss-120b' }), '410 end of life: ainda fora depois de 6 dias');
  assert.ok(placar.bloqueado({ provider: 'x', model: 'sumiu-404' }), '404 model not found: ainda fora depois de 6 dias');
  agora += 2 * 24 * 3600 * 1000;
  assert.ok(!placar.bloqueado({ provider: 'nvidia', model: 'openai/gpt-oss-120b' }), 'depois de 7 dias volta a ser tentado (pode ter voltado)');
});

test('limite POR MINUTO continua esperando uma vez (o que já funcionava)', async () => {
  const raiz = cenario();
  const rt = router({ g: [erro(429, 'Rate limit reached for model in organization: tokens per minute'), ARQ(10)] });
  const logs = [];
  const r = await executar({ ...base, contrato: c(), raiz, router: rt, esperar429Ms: 10, log: (s) => logs.push(s), modelos: [{ provider: 'groq', model: 'g' }], rodarTeste: rodarTeste(raiz) });
  assert.strictEqual(r.ok, true);
  assert.ok(logs.some((l) => /esperando/.test(l)));
});

test('nvidia/openai/gpt-oss-120b (morto desde 03/09/2026) não está mais na lista de modelos', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../nexia-ai/orchestrator/models.js'), 'utf8');
  assert.doesNotMatch(src, /provider:\s*'nvidia',\s*model:\s*'openai\/gpt-oss-120b'/);
});
