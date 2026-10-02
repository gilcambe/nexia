'use strict';
// Fase 4: Project Resolver, Context Engine e integração com o cortex-chat, no emulador.
// Dados: os produtos/tenants que existem neste repositório (NEXIA OS, CES, Viajante Pro,
// com as páginas reais em ces/ e viajante-pro/). Rodar com: npm run test:rules
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { rawRequest, startServer } = require('../helpers');
const { createVault, createExecutionContext } = require('../../nexia-ai/vault');
const { resolveProject } = require('../../nexia-ai/project-resolver');
const { buildContext } = require('../../nexia-ai/context-engine');
const { resolveForChat } = require('../../nexia-ai/cortex');

const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const RUN = crypto.randomBytes(4).toString('hex');
const T = `res-${RUN}`;
let db, vault, ctx, srv;
const ids = {};
const tok = {};

async function signUp(email) {
  const r = await fetch(`http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'senha-forte-123', returnSecureToken: true }),
  });
  return r.json();
}

test.before(async () => {
  assert.ok(AUTH && process.env.FIRESTORE_EMULATOR_HOST, 'rode via `npm run test:rules` (emuladores)');
  ({ db } = require('../../netlify/functions/firebase-init'));
  vault = createVault({ db });
  await db.doc(`tenants/${T}`).set({ slug: T, name: T, plan: 'free' });
  ctx = createExecutionContext({ tenantId: T, actor: { type: 'user', id: 'gilcambe' } });
  const mk = async (e, data) => (await vault[e].create(ctx, data)).record.id;

  ids.nexia = await mk('Client', { name: 'NEXIA', slug: 'nexia', status: 'active' });
  ids.nexiaOs = await mk('Project', { client_id: ids.nexia, name: 'NEXIA OS', slug: 'nexia-os', type: 'saas', status: 'active',
    aliases: ['cortex'], stack: ['node', 'react', 'firebase'], workspace: { local_path: 'D:/Projetos/nexia' } });
  ids.repo = await mk('Repository', { project_id: ids.nexiaOs, provider: 'github', owner: 'gilcambe', repo: 'nexia', default_branch: 'develop',
    url: 'https://github.com/gilcambe/nexia' });

  ids.ces = await mk('Client', { name: 'CES', slug: 'ces', status: 'active', identifiers: [{ kind: 'brand', value: 'CES Executivo' }] });
  ids.cesApp = await mk('Project', { client_id: ids.ces, name: 'CES Check-in', slug: 'ces-checkin', type: 'web_app', status: 'active',
    description: 'Landing, admin, check-in e app executivo do CES (pasta ces/).', stack: ['html', 'firebase'] });

  ids.vp = await mk('Client', { name: 'Viajante Pro', slug: 'viajante-pro', status: 'active', aliases: ['VP'] });
  ids.vpGuia = await mk('Project', { client_id: ids.vp, name: 'App do Guia', slug: 'vp-guia', type: 'web_app', status: 'active',
    description: 'Página do guia (viajante-pro/vp-guide.html).' });
  ids.vpPass = await mk('Project', { client_id: ids.vp, name: 'App do Passageiro', slug: 'vp-passageiro', type: 'web_app', status: 'active',
    description: 'Página do passageiro (viajante-pro/vp-passenger.html).' });

  // Contexto do CES para o Context Engine
  ids.snap = await mk('ProjectSnapshot', { project_id: ids.cesApp, generated_at: '2026-10-02T12:00:00.000Z', stack: ['html', 'firebase'],
    frameworks: [], directory_structure: ['ces/'], deploy_target: 'render', firebase_project: 'nexia-c8710', architecture: 'Páginas HTML estáticas servidas pelo server.js a partir de ces/.' });
  ids.dec = await mk('Decision', { project_id: ids.cesApp, title: 'Check-in servido como página estática', kind: 'technical',
    decision: 'Manter ces/checkin.html fora do SPA React.', rationale: 'Página legada já usada pelo cliente.', decided_at: '2026-10-01T10:00:00.000Z',
    author: { type: 'user', id: 'gilcambe' }, status: 'accepted' });
  ids.task = await mk('Task', { project_id: ids.cesApp, title: 'Aumentar a área do botão de check-in', priority: 'medium', status: 'todo' });
  ids.memOk = await mk('Memory', { client_id: ids.ces, layer: 'preference', content: 'O CES prefere botões grandes e alto contraste.', status: 'approved', approved_by: { type: 'user', id: 'gilcambe' } });
  ids.memPending = await mk('Memory', { project_id: ids.cesApp, layer: 'fact', content: 'Fato ainda não aprovado sobre o CES.', status: 'pending' });
  ids.memExpired = await mk('Memory', { project_id: ids.cesApp, layer: 'state', content: 'Estado antigo expirado.', status: 'approved',
    approved_by: { type: 'user', id: 'gilcambe' }, expires_at: '2026-01-01T00:00:00.000Z' });

  srv = await startServer();
  for (const [k, profile] of Object.entries({ admin: { role: 'admin', tenantSlug: T }, user: { role: 'user', tenantSlug: T } })) {
    const j = await signUp(`${k}-${RUN}@t.com`);
    tok[k] = j;
    await db.doc(`users/${j.localId}`).set({ uid: j.localId, ...profile });
  }
});
test.after(async () => { if (srv) await srv.close(); });

const resolve = o => resolveProject({ vault, ctx, ...o });

test('R1 (aceitação A). cliente conhecido: só o nome do cliente resolve o projeto, sem perguntar', async () => {
  const pc = await resolve({ message: 'No CES, aumente a área do botão de check-in e publique.' });
  assert.strictEqual(pc.project_id, ids.cesApp);
  assert.strictEqual(pc.client_id, ids.ces);
  assert.ok(pc.confidence >= 0.7, String(pc.confidence));
  assert.strictEqual(pc.needs_confirmation, false);
  assert.ok(pc.rationale.some(r => r.layer === 3));
});

test('R2 (aceitação B). cliente ambíguo: dois projetos possíveis → pergunta antes; seleção na UI resolve', async () => {
  const pc = await resolve({ message: 'Corrija o botão de login do Viajante Pro.' });
  assert.strictEqual(pc.project_id, null);
  assert.strictEqual(pc.needs_confirmation, true);
  assert.deepStrictEqual(pc.candidates.map(c => c.project_id).sort(), [ids.vpGuia, ids.vpPass].sort());
  assert.match(pc.question, /App do Guia/);
  assert.match(pc.question, /App do Passageiro/);
  const chosen = await resolve({ message: 'Corrija o botão de login do Viajante Pro.', selectedProjectId: ids.vpPass });
  assert.strictEqual(chosen.project_id, ids.vpPass);
  assert.ok(chosen.rationale.some(r => r.layer === 1));
  // nome do projeto mencionado também desempata
  const named = await resolve({ message: 'No app do passageiro do VP, mude a cor.' });
  assert.strictEqual(named.project_id, ids.vpPass);
});

test('R3. camadas 2–4: nome, alias, repositório e workspace', async () => {
  assert.strictEqual((await resolve({ message: 'Qual o status do NEXIA OS?' })).project_id, ids.nexiaOs);
  const alias = await resolve({ message: 'o cortex está lento' });
  assert.strictEqual(alias.project_id, ids.nexiaOs);
  assert.ok(alias.rationale.some(r => r.field === 'project.aliases'));
  const byRepo = await resolve({ message: 'rode os testes', repository: { owner: 'GilCambe', repo: 'Nexia' } });
  assert.deepStrictEqual([byRepo.project_id, byRepo.rationale[0].layer], [ids.nexiaOs, 4]);
  const byWs = await resolve({ message: 'rode os testes', workspacePath: 'D:\\Projetos\\nexia\\src\\pages' });
  assert.strictEqual(byWs.project_id, ids.nexiaOs);
  // prefixo parecido não conta
  assert.strictEqual((await resolve({ message: 'rode os testes', workspacePath: 'D:/Projetos/nexia-old' })).project_id, null);
});

test('R4. camadas 5–7 e limiar: conversa + histórico somam; sem sinal não há candidato; busca lexical sozinha pergunta', async () => {
  const conv = await resolve({ message: 'e agora rode o build', conversationProjectId: ids.cesApp, recentProjectIds: [ids.cesApp] });
  assert.strictEqual(conv.project_id, ids.cesApp);
  const onlyConv = await resolve({ message: 'e agora rode o build', conversationProjectId: ids.cesApp });
  assert.deepStrictEqual([onlyConv.project_id, onlyConv.needs_confirmation], [null, true]);
  const none = await resolve({ message: 'qual a capital da França?' });
  assert.deepStrictEqual([none.project_id, none.candidates, none.needs_confirmation, none.question], [null, [], false, null]);
  const lexical = await resolve({ message: 'página do passageiro' });
  assert.strictEqual(lexical.project_id, null);
  assert.ok(lexical.rationale.every(r => r.layer === 7));
});

test('R5. Context Engine: camadas, refs verificáveis, só memórias aprovadas e vigentes, orçamento', async () => {
  const c = await buildContext({ vault, ctx, projectId: ids.cesApp, message: 'aumente o botão de check-in', now: new Date('2026-10-02T15:00:00Z') });
  assert.deepStrictEqual(Object.keys(c.sections), ['identity', 'fact', 'decision', 'state', 'preference']);
  assert.ok(c.text.includes(`[${ids.snap}]`) && c.text.includes(`[${ids.dec}]`) && c.text.includes(`[${ids.task}]`) && c.text.includes(`[${ids.memOk}]`));
  assert.ok(!c.text.includes(ids.memPending) && !c.text.includes(ids.memExpired), 'memória pendente/expirada não entra');
  assert.ok(c.tokens_estimated <= c.budget_tokens);
  const small = await buildContext({ vault, ctx, projectId: ids.cesApp, message: '', budgetTokens: 60 });
  assert.ok(small.sections.identity.length >= 1, 'identidade sempre entra');
  assert.ok(small.dropped.length > 0);
  assert.ok(!('preference' in small.sections));
});

test('R6. ponte do chat: usuário comum não usa o Vault; admin recebe contexto, pergunta ou nada', async () => {
  const base = { db, tenantId: T, conversationId: `conv-${RUN}` };
  assert.strictEqual((await resolveForChat({ ...base, uid: tok.user.localId, role: 'user', message: 'No CES, aumente o botão' })).mode, 'none');
  const a = await resolveForChat({ ...base, uid: tok.admin.localId, role: 'admin', message: 'No CES, aumente o botão de check-in' });
  assert.strictEqual(a.mode, 'context');
  assert.strictEqual(a.project.project_id, ids.cesApp);
  assert.match(a.text, /CES Check-in/);
  // mesma conversa, mensagem sem nome: projeto lembrado (camadas 5 e 6)
  const follow = await resolveForChat({ ...base, uid: tok.admin.localId, role: 'admin', message: 'agora rode o build' });
  assert.deepStrictEqual([follow.mode, follow.project.project_id], ['context', ids.cesApp]);
  const ask = await resolveForChat({ ...base, conversationId: `conv2-${RUN}`, uid: tok.admin.localId, role: 'admin', message: 'Corrija o login do Viajante Pro' });
  assert.strictEqual(ask.mode, 'ask');
  assert.strictEqual(ask.candidates.length, 2);
  const unrelated = await resolveForChat({ ...base, conversationId: `conv3-${RUN}`, uid: tok.admin.localId, role: 'admin', message: 'Explique o que é MRR' });
  assert.strictEqual(unrelated.mode, 'none');
  assert.strictEqual((await resolveForChat({ ...base, tenantId: 'outro-tenant', uid: tok.admin.localId, role: 'admin', message: 'No CES' })).mode, 'none');
});

const call = (who, method, p, body) => rawRequest(srv.port, p, {
  method, body: body === undefined ? undefined : JSON.stringify(body),
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok[who].idToken}` },
}).then(r => ({ status: r.status, body: JSON.parse(r.body || 'null') }));

test('R7. HTTP: /api/nexia/resolve e /projects/{id}/context; /api/cortex pergunta antes de agir no caso ambíguo', async () => {
  const r = await call('admin', 'POST', '/api/nexia/resolve', { message: 'No CES, aumente o botão' });
  assert.deepStrictEqual([r.status, r.body.project_id], [200, ids.cesApp]);
  assert.strictEqual((await call('user', 'POST', '/api/nexia/resolve', { message: 'No CES' })).status, 403);
  const c = await call('admin', 'GET', `/api/nexia/projects/${ids.cesApp}/context?budget=400&message=bot%C3%A3o`);
  assert.strictEqual(c.status, 200);
  assert.ok(c.body.tokens_estimated <= 400);
  assert.strictEqual((await call('admin', 'GET', `/api/nexia/projects/${ids.cesApp}/context?budget=5`)).status, 400);

  const chat = await call('admin', 'POST', '/api/cortex', { message: 'Corrija o login do Viajante Pro', tenantId: T, stream: false, conversationId: `http-${RUN}` });
  assert.strictEqual(chat.status, 200, JSON.stringify(chat.body));
  assert.strictEqual(chat.body.type, 'clarification');
  assert.strictEqual(chat.body.candidates.length, 2);
});
