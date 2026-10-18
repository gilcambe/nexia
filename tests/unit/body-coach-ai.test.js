'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { handler } = require('../../netlify/functions/body-coach-ai.js');

test('BCAI1. OPTIONS responde 204 e GET é recusado', async () => {
  assert.equal((await handler({ httpMethod: 'OPTIONS', headers: {} })).statusCode, 204);
  assert.equal((await handler({ httpMethod: 'GET', headers: {} })).statusCode, 405);
});

test('BCAI2. sem login não fala com a equipe', async () => {
  const r = await handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ message: 'oi' }) });
  assert.equal(r.statusCode, 401);
});

test('BCAI3. foto vai como image_url só para provedor com visão (google)', async () => {
  const { createRouter } = require('../../nexia-ai/model-router');
  let enviado;
  const fetchImpl = async (url, init) => { enviado = JSON.parse(init.body); return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }], usage: {} }), text: async () => '' }; };
  const r = createRouter({ env: { GEMINI_API_KEY: 'x', GROQ_API_KEY: 'y' }, fetchImpl });
  const imgs = [{ mime: 'image/jpeg', data: 'QUJD' }];
  assert.equal(r.capabilities({ provider: 'google', model: 'gemini-2.5-flash' }).vision, true);
  assert.equal(r.capabilities({ provider: 'groq', model: 'openai/gpt-oss-120b' }).vision, false);
  await r.chat({ provider: 'google', model: 'gemini-2.5-flash' }, { messages: [{ role: 'user', content: 'analise' }], images: imgs });
  const u = enviado.messages.find(m => m.role === 'user');
  assert.equal(u.content[1].image_url.url, 'data:image/jpeg;base64,QUJD');
});

test('BCAI-cardio. painel da esteira vira números limitados e a semana soma as calorias', async () => {
  const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path'); const ts = require('typescript');
  const src = fs.readFileSync(path.join(__dirname, '../../apps/body-coach/src/lib/ferramentas/cardio.ts'), 'utf8');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-cardio-'));
  fs.writeFileSync(path.join(dir, 'cardio.mjs'), ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  const { lerPainel, resumoSemana, avaliarSemana } = await import(require('node:url').pathToFileURL(path.join(dir, 'cardio.mjs')).href);
  const p = lerPainel('Claro! {"aparelho":"esteira","tempo_seg":3602,"distancia_km":"5,98","kcal":420.3,"velocidade_kmh":6,"passos":7510}');
  assert.deepEqual([p.tempoSeg, p.km, p.kcal, p.passos], [3602, 5.98, 420.3, 7510]);
  assert.equal(lerPainel('sem json'), null);
  assert.equal(lerPainel('{"kcal":99999,"tempo_seg":10}').kcal, 3000);
  assert.equal(resumoSemana([{ id: 'a', em: Date.now(), aparelho: 'bike', tempoSeg: 600, km: 3, kcal: 100, kmh: 18, passos: 0 }]).kcal, 100);
  assert.match(avaliarSemana(0, 'emagrecer'), /Ainda sem cardio/);
});
