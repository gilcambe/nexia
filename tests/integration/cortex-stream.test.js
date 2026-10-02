'use strict';
// Fase 5: /api/cortex pelo server.js com o Model Router, no emulador.
// O Claude é o servidor falso (tests/fake-llm.js) atrás do SDK oficial. Prova:
//   S1. streaming real ponta a ponta: o 1º token chega ao cliente HTTP enquanto o provedor
//       ainda segura o resto da resposta;
//   S2. os resumos da memória ("MEMÓRIA COMPRIMIDA") chegam ao Claude no system prompt;
//   S3. a conversa é salva depois do stream; S4. sem nenhuma chave, cai no aviso de antes.
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const crypto = require('crypto');
const { createFakeLLM } = require('../fake-llm');

const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const RUN = crypto.randomBytes(4).toString('hex');
const T = `stream-${RUN}`;
const KEYS = ['ANTHROPIC_API_KEY', 'GROQ_API_KEY', 'DEEPSEEK_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'OPENROUTER_API_KEY', 'CEREBRAS_API_KEY'];
let fake, srv, db, user;

test.before(async () => {
  assert.ok(AUTH && process.env.FIRESTORE_EMULATOR_HOST, 'rode via `npm run test:rules` (emuladores)');
  for (const k of KEYS) delete process.env[k];
  fake = await createFakeLLM().start();
  process.env.ANTHROPIC_API_KEY = 'chave-de-teste-anthropic';
  process.env.ANTHROPIC_BASE_URL = fake.url;
  ({ db } = require('../../netlify/functions/firebase-init'));
  const { startServer } = require('../helpers');
  srv = await startServer();
  const r = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `stream-${RUN}@t.com`, password: 'senha-forte-123', returnSecureToken: true }),
  });
  user = await r.json();
  await db.doc(`tenants/${T}`).set({ slug: T, name: T, plan: 'free' });
  await db.doc(`users/${user.localId}`).set({ uid: user.localId, role: 'admin', tenantSlug: T });
  await db.doc(`tenants/${T}/cortex_memory/${user.localId}_conv-${RUN}`).set({
    history: [{ role: 'user', content: 'Qual a forma de pagamento?' }, { role: 'assistant', content: 'Pix.' }],
    summaries: [{ content: 'O cliente CES prefere receber por Pix e quer relatórios às sextas.', createdAt: '2026-10-01T10:00:00.000Z', msgCount: 32 }],
    stats: {}, entities: {}, tenantId: T, userId: user.localId,
  });
});
test.after(async () => {
  if (srv) await srv.close();
  if (fake) await fake.close();
});

/** POST que devolve os trechos na ordem em que chegam, com o instante de cada um. */
function postStream(path, body, onChunk) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({ host: '127.0.0.1', port: srv.port, method: 'POST', path,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.idToken}`, 'Content-Length': Buffer.byteLength(data) } }, res => {
      const chunks = [];
      res.on('data', c => { chunks.push(c.toString('utf8')); if (onChunk) onChunk(c.toString('utf8'), chunks.length); });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, chunks, text: chunks.join('') }));
    });
    req.on('error', reject);
    req.end(data);
  });
}
const events = text => text.split('\n\n').filter(l => l.startsWith('data: ') && l !== 'data: [DONE]').map(l => JSON.parse(l.slice(6)));

test('S1+S2+S3. /api/cortex com Claude: 1º token antes do fim, resumo da memória no system, conversa salva', async () => {
  let release;
  fake.state.gate = new Promise(r => { release = r; });
  fake.state.text = ['Olá', ', a forma é Pix', '.'];
  let sawFirstTokenWhileGated = false;
  const resP = postStream('/api/cortex', { message: 'Como o CES prefere receber?', tenantId: T, model: 'claude', stream: true, conversationId: `conv-${RUN}` }, chunk => {
    if (!sawFirstTokenWhileGated && chunk.includes('"token":"Olá"')) { sawFirstTokenWhileGated = true; release(); }
  });
  await fake.state.firstChunkSent;
  // Se o servidor acumulasse a resposta, o cliente nunca veria o 1º token e o gate nunca abriria.
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; release(); }, 5000);
  const res = await resP;
  clearTimeout(timer);
  assert.strictEqual(timedOut, false, 'o gate só abre quando o cliente recebe o 1º token');
  assert.strictEqual(res.status, 200);
  assert.match(res.headers['content-type'], /text\/event-stream/);
  assert.strictEqual(sawFirstTokenWhileGated, true, 'o 1º token deveria chegar antes de o provedor terminar');
  assert.ok(res.chunks.length >= 2, `esperava vários trechos, veio ${res.chunks.length}`);
  const ev = events(res.text);
  assert.strictEqual(ev.filter(e => !e.done).map(e => e.token).join(''), 'Olá, a forma é Pix.');
  const done = ev.find(e => e.done);
  assert.strictEqual(done.model, '✦ Claude Sonnet 4.6');
  assert.ok(res.text.endsWith('data: [DONE]\n\n'));

  const call = fake.state.requests.find(r => r.path.startsWith('/v1/messages'));
  assert.ok(call, 'o Claude (SDK) foi chamado');
  assert.match(call.body.system, /MEMÓRIA COMPRIMIDA/);
  assert.match(call.body.system, /prefere receber por Pix/);
  assert.ok(call.body.max_tokens <= 64000, String(call.body.max_tokens));
  assert.deepStrictEqual(call.body.messages.map(m => m.role), ['user', 'assistant', 'user']);

  let saved;
  for (let i = 0; i < 50; i++) {
    saved = (await db.doc(`tenants/${T}/cortex_memory/${user.localId}_conv-${RUN}`).get()).data();
    if (saved.history.length === 4) break;
    await new Promise(r => setTimeout(r, 100));
  }
  assert.deepStrictEqual(saved.history.slice(-2), [{ role: 'user', content: 'Como o CES prefere receber?' }, { role: 'assistant', content: 'Olá, a forma é Pix.' }]);
  assert.strictEqual(saved.summaries.length, 1);
});

test('S5. /api/cortex sem stream: Claude via router devolve a resposta completa em JSON', async () => {
  fake.state.text = ['Resposta ', 'completa.'];
  const res = await postStream('/api/cortex', { message: 'oi', tenantId: T, model: 'claude', stream: false, conversationId: `json-${RUN}` });
  assert.strictEqual(res.status, 200);
  const body = JSON.parse(res.text);
  assert.strictEqual(body.reply, 'Resposta completa.');
  assert.strictEqual(body._meta.modelUsed, '✦ Claude Sonnet 4.6');
  assert.strictEqual(body._meta.project, undefined, 'tenant sem projetos no Vault: fluxo sem projeto');
});

test('S4. sem nenhuma chave de IA: resposta de aviso em SSE, como antes da Fase 5', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const res = await postStream('/api/cortex', { message: 'oi', tenantId: T, model: 'claude', stream: true, conversationId: `vazio-${RUN}` });
    assert.strictEqual(res.status, 200);
    const ev = events(res.text);
    assert.match(ev[0].token, /Todas as IAs estão indisponíveis/);
    assert.deepStrictEqual(ev[1], { done: true, model: 'fallback' });
  } finally {
    process.env.ANTHROPIC_API_KEY = 'chave-de-teste-anthropic';
  }
});
