'use strict';
// Melhoria 26 do Cortex (17/11/2026): a escada tinha ordem fixa. A kilo/auto:1 aprovou 10 das 13 entregas recentes,
// mas era a 7ª; antes dela a zai expirava em 2 min e a openrouter devolvia "resposta inválida" (~4 min perdidos por
// tarefa: #3884, #3883). Agora quem mais acertou nas entregas aprovadas recentes (memoria/exemplos) vai primeiro.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { executar, lerContrato, porAcerto } = require('../../nexia-ai/contrato/executor');
const { createPlacar } = require('../../nexia-ai/model-router/cota');

const M = (p, m) => ({ provider: p, model: m });
const ESCADA = [M('zai', 'glm'), M('openrouter', 'auto:1'), M('kilo', 'auto:1'), M('groq', 'qwen')];
const ex = (modelo, data, numero) => ({ modelo, data, numero });

test('porAcerto: mais acertos recentes primeiro; desempate mantém a ordem; quem nunca acertou não some', () => {
  const o = porAcerto(ESCADA, [ex('kilo/auto:1', '2026-11-17', 1), ex('kilo/auto:1', '2026-11-17', 2), ex('openrouter/auto:1', '2026-11-17', 3)]);
  assert.deepStrictEqual(o.map((m) => m.provider), ['kilo', 'openrouter', 'zai', 'groq']);
  assert.deepStrictEqual(porAcerto(ESCADA, []).map((m) => m.provider), ['zai', 'openrouter', 'kilo', 'groq'], 'sem histórico: ordem original');
  assert.deepStrictEqual(porAcerto(ESCADA, [{ data: 'x' }, null, ex(null)]).map((m) => m.provider), ['zai', 'openrouter', 'kilo', 'groq'], 'exemplo sem modelo não conta');
});

test('porAcerto: só as últimas 30 entregas contam (o velho não domina para sempre)', () => {
  const velhos = Array.from({ length: 40 }, (_, i) => ex('zai/glm', '2026-10-01', i));
  const novos = Array.from({ length: 30 }, (_, i) => ex('kilo/auto:1', '2026-11-17', 100 + i));
  assert.strictEqual(porAcerto(ESCADA, [...velhos, ...novos])[0].provider, 'kilo');
});

test('executar: com memória, a que mais acertou é chamada primeiro; marcada sem cota continua no fim', async () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'acerto-'));
  fs.mkdirSync(path.join(raiz, 'tests')); fs.mkdirSync(path.join(raiz, 'src'));
  fs.writeFileSync(path.join(raiz, 'src/a.js'), 'module.exports = 0;\n');
  fs.writeFileSync(path.join(raiz, 'tests/a.test.js'), '// teste\n');
  const mem = fs.mkdtempSync(path.join(os.tmpdir(), 'mem-'));
  fs.mkdirSync(path.join(mem, 'exemplos'));
  for (const n of [1, 2, 3]) fs.writeFileSync(path.join(mem, 'exemplos', `${n}.json`), JSON.stringify({ numero: n, data: '2026-11-17', modelo: 'kilo/auto:1', pedido: 'x', diff: 'd' }));
  fs.writeFileSync(path.join(mem, 'exemplos', '4.json'), JSON.stringify({ numero: 4, data: '2026-11-17', modelo: 'groq/qwen', pedido: 'x', diff: 'd' }));
  const F = '```';
  const chamadas = [];
  const router = { chat: async (m) => { chamadas.push(`${m.provider}/${m.model}`); return { text: `ARQUIVO: src/a.js\n${F}js\nmodule.exports = 10;\n${F}`, stop_reason: 'stop' }; } };
  const placar = createPlacar();
  placar.marcar(M('groq', 'qwen'), 'rate', 10 * 60 * 1000);
  const logs = [];
  const r = await executar({ contrato: lerContrato('Faça\nArquivos: `src/a.js`\nTeste: `node --test tests/a.test.js`'), raiz, router, placar,
    memoria: { pasta: mem }, porModelo: 1, extrasMax: 0, revisor: false, esperar429Ms: 0, log: (s) => logs.push(s), modelos: ESCADA,
    rodarTeste: async () => (/= 10;/.test(fs.readFileSync(path.join(raiz, 'src/a.js'), 'utf8')) ? { ok: true, saida: 'ok' } : { ok: false, saida: '✖ x (1ms)\nℹ fail 1', completo: '✖ x (1ms)\nℹ fail 1' }) });
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(chamadas, ['kilo/auto:1'], 'a kilo (3 acertos) foi a primeira e resolveu');
  assert.ok(logs.some((l) => /acerto/.test(l) && /kilo\/auto:1/.test(l)), 'o log diz quem subiu');
});
