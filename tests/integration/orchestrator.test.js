'use strict';
// Fase 10: Orchestrator ponta a ponta contra o Vault (emulador), o Tool Gateway real e o
// GitHub falso em memória. O modelo é um roteiro (router de teste): cada agente responde
// com as chamadas de ferramenta previstas, e o Orchestrator decide o resto. Nada sai da máquina.
// Rodar com: npm run test:rules
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { createVault, createExecutionContext } = require('../../nexia-ai/vault');
const { createGateway } = require('../../nexia-ai/tool-gateway');
const { createOrchestrator } = require('../../nexia-ai/orchestrator');
const { AGENTS } = require('../../nexia-ai/orchestrator/agents');
const { createFakeGithub } = require('../fake-github');

const RUN = crypto.randomBytes(4).toString('hex');
const T = `orc-${RUN}`;
let db, vault, user, ids = {}, fake;

/** Router de teste: fila de respostas por agente (detectado pelo prompt de sistema). */
function scriptedRouter(script) {
  const queues = Object.fromEntries(Object.entries(script).map(([k, v]) => [k, [...v]]));
  const seen = [];
  return {
    seen,
    capabilities: d => ({ available: d.provider === 'anthropic', tool_call: true }), // só os 2 candidatos Anthropic de cada classe
    costEstimate: (d, u) => ({ known: true, usd: ((u.input_tokens || 0) + (u.output_tokens || 0)) / 1e6 }),
    async toolCall(desc, req) {
      const agent = Object.keys(AGENTS).find(k => req.system.includes(AGENTS[k].prompt));
      seen.push({ agent, model: desc.model, tools: req.tools.map(t => t.name) });
      const next = (queues[agent] || []).shift();
      if (!next) return { text: `${agent}: nada a fazer`, tool_calls: [], usage: { input_tokens: 10, output_tokens: 5 } };
      const r = typeof next === 'function' ? next(req) : next;
      if (r instanceof Error) throw r;
      return { usage: { input_tokens: 100, output_tokens: 50 }, tool_calls: [], ...r };
    },
  };
}
const call = (name, input) => ({ id: `tc_${crypto.randomBytes(3).toString('hex')}`, name: name.replace(/\./g, '__'), input });
const branchOf = req => /Branch de trabalho: (\S+)/.exec(req.messages[0].content)[1];
const commitStep = path => req => ({ text: 'Vou commitar.', tool_calls: [call('github.commit_files', { branch: branchOf(req), message: 'Corrige o botão', files: [{ path, content: '<button type="submit">Enviar</button>\n' }] })] });
const report = verdict => ({ tool_calls: [{ id: 'r1', name: 'report_findings', input: { verdict, findings: verdict === 'approve' ? [] : [{ severity: 'high', file: 'src/app.html', message: 'quebra o envio' }] } }] });
const GREEN = [{ name: 'Testes', status: 'completed', conclusion: 'success' }, { name: 'Build', status: 'completed', conclusion: 'success' },
  { name: 'Secret scan (gitleaks)', status: 'completed', conclusion: 'success' }];

const gateway = () => createGateway({ db, vault, env: fake.env, fetchImpl: fake.fetchImpl });
const orch = (router, extra = {}) => createOrchestrator({ vault, gateway: gateway(), router, ...extra });
const setAutonomy = async (level, project = ids.project) => vault.Project.update(user, project, { autonomy_level: level }, { expectedVersion: (await vault.Project.get(user, project)).version });
const newCtx = () => createExecutionContext({ tenantId: T, actor: { type: 'user', id: 'gilcambe' } });
async function startAndRun(o, message, extra = {}) {
  const ctx = newCtx();
  const s = await o.start(ctx, { message, projectId: ids.project, ...extra });
  assert.ok(s.execution, JSON.stringify(s));
  return { ctx, exe: await o.run(ctx, s.execution.id) };
}

test.before(async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'rode via `npm run test:rules` (emuladores)');
  ({ db } = require('../../netlify/functions/firebase-init'));
  vault = createVault({ db });
  fake = createFakeGithub();
  await db.doc(`tenants/${T}`).set({ slug: T, name: T, plan: 'free' });
  user = newCtx();
  const mk = async (e, d) => (await vault[e].create(user, d)).record.id;
  ids.client = await mk('Client', { name: 'Alfa', slug: 'alfa', status: 'active' });
  ids.client2 = await mk('Client', { name: 'Beta', slug: 'beta', status: 'active' });
  ids.project = await mk('Project', { client_id: ids.client, name: 'Site Alfa', slug: 'site-alfa', type: 'website', status: 'active' });
  ids.project2 = await mk('Project', { client_id: ids.client2, name: 'Loja Beta', slug: 'loja-beta', type: 'web_app', status: 'active' });
  await mk('Repository', { project_id: ids.project, provider: 'github', owner: 'gilcambe', repo: 'nexia', default_branch: 'develop', url: 'https://github.com/gilcambe/nexia' });
  await mk('Environment', { project_id: ids.project, name: 'staging', provider: 'firebase', urls: ['https://staging.alfa.com.br'], branch: 'develop' });
  await mk('Environment', { project_id: ids.project, name: 'production', provider: 'firebase', urls: ['https://alfa.com.br'], branch: 'develop' });
});

test('O1. pedido de mudança: análise → branch → commit → revisão → segurança → PR; só conclui quando o CI fica verde', async () => {
  await setAutonomy(3);
  const router = scriptedRouter({
    architect: [{ text: 'Mudar src/app.html: o botão precisa de type="submit".' }],
    frontend: [commitStep('src/app.html'), { text: 'Commit feito em src/app.html.' }],
    reviewer: [report('approve')], security: [report('approve')],
  });
  const o = orch(router);
  const { ctx, exe } = await startAndRun(o, 'Corrija o botão de enviar do formulário de contato do Site Alfa');
  assert.strictEqual(exe.intent, 'change');
  assert.deepStrictEqual(exe.plan.map(s => [s.agent, s.status]), [['architect', 'done'], ['coder', 'done'], ['frontend', 'done'], ['reviewer', 'done'], ['security', 'done'], ['devops', 'done'], ['qa', 'done']]);
  assert.match(exe.work_branch, /^nexia\/corrija-o-botao/);
  assert.strictEqual(fake.fileAt(exe.work_branch, 'src/app.html'), '<button type="submit">Enviar</button>\n', 'o commit existe de verdade no GitHub');
  assert.deepStrictEqual([exe.pull_request, fake.pulls.at(-1).draft, fake.pulls.at(-1).base], [fake.pulls.length, true, 'develop']);
  assert.deepStrictEqual([exe.review_verdict, exe.security_verdict], ['approve', 'approve']);
  assert.strictEqual(exe.status, 'running', 'sem checks do CI não há sucesso');
  assert.ok(!exe.finished_at);
  const g = Object.fromEntries(exe.gates.map(x => [x.gate, x.status]));
  assert.deepStrictEqual([g[3], g[5], g[8], g[9], g[11]], ['pending', 'pending', 'passed', 'not_applicable', 'not_applicable']);
  assert.match(exe.result_summary, /aguardando .*unit tests/);
  assert.ok(router.seen.every(s => !s.tools.includes('github__create_pr') || s.agent === 'devops'), 'só o DevOps vê create_pr');
  assert.ok(!router.seen.find(s => s.agent === 'architect').tools.includes('github__commit_files'), 'Architect não escreve');
  assert.strictEqual(router.seen.find(s => s.agent === 'architect').model, 'claude-opus-5-5');

  fake.checks.set(exe.work_branch, [{ ...GREEN[0], status: 'in_progress', conclusion: null }, GREEN[1], GREEN[2]]);
  assert.strictEqual((await o.refresh(ctx, exe.id)).status, 'running');
  fake.checks.set(exe.work_branch, GREEN);
  const done = await o.refresh(ctx, exe.id);
  assert.deepStrictEqual([done.status, done.error_code], ['succeeded', undefined]);
  assert.ok(done.finished_at >= done.started_at);
  assert.ok(done.gates.every(x => ['passed', 'not_applicable'].includes(x.status)), JSON.stringify(done.gates));
  assert.match(done.result_summary, /todos os gates verdes .*PR #/);
  // Evidência: cada passo aponta as ToolCalls do Vault que o sustentam.
  const calls = await vault.ToolCall.list(user, { where: { project_id: ids.project }, limit: 100 });
  const byId = new Map(calls.map(c => [c.id, c]));
  const tools = done.plan.flatMap(s => s.tool_call_ids).map(id => byId.get(id).tool);
  for (const t of ['github.create_branch', 'github.commit_files', 'github.compare', 'github.create_pr', 'github.get_checks']) assert.ok(tools.includes(t), t);
  assert.ok(done.usage.input_tokens >= 500 && done.usage.tool_calls >= 1 && done.usage.cost_known);
  assert.ok(done.models.includes('anthropic/claude-sonnet-5-5'));
});

test('O2. pedido ambíguo (spec §29 caso B): pergunta qual projeto e não cria execução', async () => {
  const o = orch(scriptedRouter({}));
  const before = (await vault.Execution.list(user, { limit: 200 })).length;
  const r = await o.start(newCtx(), { message: 'corrija o formulário de contato' });
  assert.strictEqual(r.status, 'needs_input');
  assert.ok(r.question && r.question.length > 5);
  assert.strictEqual(r.execution, undefined);
  assert.strictEqual((await vault.Execution.list(user, { limit: 200 })).length, before);
  const named = await o.start(newCtx(), { message: 'corrija o formulário de contato da Loja Beta' });
  assert.strictEqual(named.execution.project_id, ids.project2, 'nome do projeto na mensagem resolve');
});

test('O3. autonomia 2: o PR espera aprovação humana; resume segue só depois de aprovado', async () => {
  await setAutonomy(2);
  const o = orch(scriptedRouter({
    architect: [{ text: 'Mudar README.md.' }],
    coder: [commitStep('README.md'), { text: 'ok' }],
    reviewer: [report('approve')], security: [report('approve')],
  }));
  const pulls = fake.pulls.length;
  const { ctx, exe } = await startAndRun(o, 'Ajuste o texto do README do Site Alfa');
  assert.strictEqual(exe.status, 'waiting_approval');
  assert.match(exe.result_summary, /aprovacoes/);
  assert.strictEqual(fake.pulls.length, pulls, 'PR não foi aberto sem pessoa');
  const step = exe.plan.find(s => s.status === 'waiting_approval');
  assert.strictEqual(step.agent, 'devops');
  assert.strictEqual((await o.resume(ctx, exe.id)).status, 'waiting_approval', 'ainda pendente: nada muda');
  const pending = step.tool_call_ids.at(-1);
  const r = await gateway().approve(user, pending, { expectedVersion: (await vault.ToolCall.get(user, pending)).version });
  assert.strictEqual(r.status, 'succeeded');
  const after = await o.resume(ctx, exe.id);
  assert.strictEqual(fake.pulls.length, pulls + 1);
  assert.strictEqual(after.pull_request, fake.pulls.at(-1).number);
  assert.strictEqual(after.status, 'running', 'segue para os checks');
  assert.ok(after.plan.every(s => s.status === 'done'));
});

test('O4. sem falso sucesso: agente sem commit, revisão reprovada e aprovação rejeitada terminam em failed', async () => {
  await setAutonomy(3);
  const pulls = fake.pulls.length;
  const noCommit = await startAndRun(orch(scriptedRouter({ architect: [{ text: 'x' }], coder: [{ text: 'Pronto, corrigi!' }] })), 'Corrija o cálculo do frete do Site Alfa');
  assert.deepStrictEqual([noCommit.exe.status, noCommit.exe.error_code], ['failed', 'NO_CHANGES']);
  assert.ok(noCommit.exe.finished_at);
  assert.match(noCommit.exe.result_summary, /nada foi alterado/);

  // Revisão reprovada nas 3 vezes (a original e as 2 rodadas de correção, cada uma com commit novo).
  const rejected = await startAndRun(orch(scriptedRouter({ architect: [{ text: 'x' }],
    frontend: [commitStep('src/app.html'), { text: 'ok' }, commitStep('src/app2.html'), { text: 'ok' }, commitStep('src/app3.html'), { text: 'ok' }],
    reviewer: [report('changes_requested'), report('changes_requested'), report('changes_requested')] })),
    'Altere o envio do formulário do Site Alfa');
  assert.deepStrictEqual([rejected.exe.status, rejected.exe.error_code, rejected.exe.review_verdict, rejected.exe.fix_rounds], ['failed', 'REVIEW_CHANGES_REQUESTED', 'changes_requested', 2]);
  assert.strictEqual(rejected.exe.plan[5].status, 'pending', 'PR não foi aberto');
  assert.strictEqual(fake.pulls.length, pulls);
  assert.strictEqual(rejected.exe.gates.find(g => g.gate === 8).status, 'failed');

  const err = new Error('upstream'); err.code = 'UPSTREAM';
  const down = await startAndRun(orch(scriptedRouter({ architect: [err, err, err, err] })), 'Corrija o rodapé do Site Alfa');
  assert.deepStrictEqual([down.exe.status, down.exe.error_code], ['failed', 'MODEL_UPSTREAM'], 'modelo fora: repete, troca de modelo e falha');

  await setAutonomy(2);
  const o = orch(scriptedRouter({ architect: [{ text: 'x' }], frontend: [commitStep('src/app.html'), { text: 'ok' }], reviewer: [report('approve')], security: [report('approve')] }));
  const w = await startAndRun(o, 'Mude a cor do botão do Site Alfa');
  const pending = w.exe.plan.find(s => s.status === 'waiting_approval').tool_call_ids.at(-1);
  await gateway().reject(user, pending, { expectedVersion: (await vault.ToolCall.get(user, pending)).version });
  const after = await o.resume(w.ctx, w.exe.id);
  assert.deepStrictEqual([after.status, after.plan[5].status], ['failed', 'failed']);
  assert.match(after.result_summary, /não foi executada/);
});

test('O4b. ADR-Q-01: revisão pede mudança, o agente corrige na mesma branch e a revisão aprova; rodada sem commit novo falha', async () => {
  await setAutonomy(3);
  const router = scriptedRouter({
    architect: [{ text: 'Mudar src/app.html.' }],
    frontend: [commitStep('src/app.html'), { text: 'feito' }, req => ({ tool_calls: [call('github.edit_files', { branch: branchOf(req), message: 'Corrige o envio',
      edits: [{ path: 'src/app.html', find: 'Enviar', replace: 'Enviar mensagem' }] })] }), { text: 'corrigido' }],
    reviewer: [report('changes_requested'), report('approve')], security: [report('approve')],
  });
  const { exe } = await startAndRun(orch(router), 'Corrija o botão de enviar do Site Alfa');
  assert.deepStrictEqual([exe.review_verdict, exe.security_verdict, exe.fix_rounds], ['approve', 'approve', 1]);
  assert.ok(exe.pull_request, 'PR aberto depois da correção');
  assert.strictEqual(fake.fileAt(exe.work_branch, 'src/app.html'), '<button type="submit">Enviar mensagem</button>\n', 'edição por trecho aplicada');
  const fixGoal = router.seen.filter(s => s.agent === 'frontend').length;
  assert.ok(fixGoal >= 3, 'o agente rodou de novo para corrigir');
  assert.match(exe.fix_feedback, /quebra o envio/);

  const lazy = await startAndRun(orch(scriptedRouter({ architect: [{ text: 'x' }], frontend: [commitStep('src/app.html'), { text: 'ok' }, { text: 'Já estava certo.' }],
    reviewer: [report('changes_requested')] })), 'Ajuste o botão de enviar do Site Alfa');
  assert.deepStrictEqual([lazy.exe.status, lazy.exe.error_code], ['failed', 'NO_CHANGES']);
  assert.match(lazy.exe.result_summary, /rodada de correção terminou sem commit novo/);
});

test('O4c. resumo da IA com cara de secret (SHA de commit, "token: ...") é redigido em vez de derrubar a execução', async () => {
  await setAutonomy(3);
  const sha = '0123456789abcdef0123456789abcdef01234567';
  const { exe } = await startAndRun(orch(scriptedRouter({
    architect: [{ text: `Base no commit ${sha}; o formulário manda ${['tok', 'en'].join('')}: ${'abc'.repeat(4)}.` }],
    frontend: [commitStep('src/app.html'), { text: 'feito' }],
    reviewer: [report('approve')], security: [report('approve')],
  })), 'Corrija o botão de enviar do Site Alfa');
  assert.notStrictEqual(exe.error_code, 'SECRET_DETECTED');
  assert.ok(exe.pull_request, 'seguiu até o PR');
  assert.ok(!JSON.stringify(exe.plan).includes(sha), 'o trecho suspeito não foi gravado');
  assert.match(exe.plan[0].summary, /\[redigido\]/);
});

test('O4d. agente que responde com o código em texto recebe um lembrete e salva na segunda vez', async () => {
  await setAutonomy(3);
  const router = scriptedRouter({
    architect: [{ text: 'Mudar src/app.html.' }],
    frontend: [{ text: 'Aqui está o código: <button type="submit">Enviar</button>' }, req => {
      assert.match(req.messages.at(-1).content, /terminou sem salvar nada/);
      return commitStep('src/app.html')(req);
    }, { text: 'Salvo.' }],
    reviewer: [report('approve')], security: [report('approve')],
  });
  const { exe } = await startAndRun(orch(router), 'Corrija o botão de enviar do Site Alfa');
  assert.ok(exe.pull_request, JSON.stringify([exe.status, exe.error_code]));
});

test('O4e. ADR-Q-02: HTML quebrado volta ao agente pela checagem automática, sem gastar o Reviewer; corrigido, segue para o PR', async () => {
  await setAutonomy(3);
  const broken = '<!DOCTYPE html><html lang="pt-BR"><head><title>T</title><meta name="viewport" content="width=device-width"></head><body><form><div><input aria-label="x">\n"\n</form><img src="hero.jpg"></body></html>';
  const fixed = '<!DOCTYPE html><html lang="pt-BR"><head><title>T</title><meta name="viewport" content="width=device-width"></head><body><form><div><input aria-label="x"></div></form></body></html>';
  const put = content => req => ({ tool_calls: [call('github.commit_files', { branch: branchOf(req), message: 'Página', files: [{ path: 'demo/index.html', content }] })] });
  const router = scriptedRouter({
    architect: [{ text: 'Criar demo/index.html.' }],
    frontend: [put(broken), { text: 'feito' }, req => {
      assert.match(req.messages[0].content, /checagem automática/);
      assert.match(req.messages[0].content, /hero\.jpg" não existe/);
      return put(fixed)(req);
    }, { text: 'corrigido' }],
    reviewer: [report('approve')], security: [report('approve')],
  });
  const { exe } = await startAndRun(orch(router), 'Crie a página de contato do Site Alfa');
  assert.ok(exe.pull_request, JSON.stringify([exe.status, exe.error_code, exe.result_summary]));
  assert.strictEqual(exe.fix_rounds, 1);
  assert.strictEqual(router.seen.filter(s => s.agent === 'reviewer').length, 1, 'o Reviewer só rodou com o HTML já correto');
});

test('O4f. ADR-Q-03: site novo passa pelo Designer; página sem padrão visual ou com foto fora do ar volta para o agente', async () => {
  await setAutonomy(3);
  const head = '<!DOCTYPE html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width"><title>Pão</title><link href="https://fonts.googleapis.com/css2?family=Fraunces&display=swap" rel="stylesheet"><link rel="stylesheet" href="styles.css"></head>';
  const imgs = n => Array.from({ length: n }, (_, k) => `<img src="https://img.test/${k}.jpg" alt="foto ${k}" width="4" height="3">`).join('');
  const good = `${head}<body><header>P</header><main>${imgs(4)}</main><footer>Fotos: Ana (CC BY)</footer><script src="script.js"></script></body></html>`;
  const css = ':root { --primary: #8a4b2a; }\nimg { transition: transform .3s; }\n@media (max-width: 700px) { main { display: block; } }';
  const files = (html, n = 0) => req => ({ tool_calls: [call('github.commit_files', { branch: branchOf(req), message: `Site ${n}`, files: [
    { path: 'demos/pao/index.html', content: html }, { path: 'demos/pao/styles.css', content: css }, { path: 'demos/pao/script.js', content: 'new IntersectionObserver(() => {});' }] })] });
  const weak = `${head.replace(/<link href="https:\/\/fonts[^>]+>/, '')}<body><header>P</header><main>${imgs(1)}</main><footer>x</footer><script src="script.js"></script></body></html>`;
  const router = scriptedRouter({
    designer: [{ text: 'Fontes Fraunces + DM Sans; paleta #8a4b2a; hero | https://img.test/0.jpg | pão | Ana (CC BY)' }],
    frontend: [files(weak, 1), { text: 'feito' }, req => {
      assert.match(req.messages[0].content, /Brief do Designer/);
      assert.match(req.messages[0].content, /fonte da web/);
      assert.match(req.messages[0].content, /pelo menos 4 fotos/);
      return files(good.replace('https://img.test/3.jpg', 'https://img.test/morta.jpg'), 2)(req);
    }, { text: 'corrigido' }, req => {
      assert.match(req.messages[0].content, /morta\.jpg não abre/);
      return files(good, 3)(req);
    }, { text: 'ok' }],
    reviewer: [report('approve')], security: [report('approve')],
  });
  const fetchImpl = async url => ({ status: /morta/.test(url) ? 404 : 206, body: null });
  const { exe } = await startAndRun(orch(router, { fetchImpl }), 'Crie um site para a padaria Pão da Serra');
  assert.strictEqual(exe.plan[0].agent, 'designer');
  assert.ok(exe.pull_request, JSON.stringify([exe.status, exe.error_code, exe.result_summary]));
  assert.strictEqual(exe.fix_rounds, 2);
  assert.strictEqual(router.seen.filter(s => s.agent === 'reviewer').length, 1, 'o Reviewer só viu a versão completa');
  assert.ok(router.seen.find(s => s.agent === 'designer').tools.includes('media__search_images'), 'o Designer pode buscar fotos');
});

test('O4g. 413 (pedido maior que a cota por minuto): o mesmo modelo é chamado de novo com menos tokens', async () => {
  await setAutonomy(3);
  const big = Object.assign(new Error('groq 413'), { code: 'UPSTREAM', details: { status: 413, upstream: 'Request too large' } });
  const sizes = [];
  const router = scriptedRouter({
    architect: [req => { sizes.push(req.maxTokens); return big; }, req => { sizes.push(req.maxTokens); return { text: 'O que a pergunta pede.' }; }],
  });
  const { exe } = await startAndRun(orch(router), 'Qual é a stack do Site Alfa?');
  assert.deepStrictEqual(sizes, [8192, 4096]);
  assert.strictEqual(exe.status, 'succeeded', JSON.stringify([exe.error_code, exe.result_summary]));
  assert.strictEqual(new Set(router.seen.filter(s => s.agent === 'architect').map(s => s.model)).size, 1, 'não trocou de modelo');
});

test('O5. orçamento estourado para a execução com BUDGET_EXCEEDED', async () => {
  await setAutonomy(3);
  const { exe } = await startAndRun(orch(scriptedRouter({ architect: [{ text: 'x' }], coder: [commitStep('src/app.html')] })),
    'Corrija o cabeçalho do Site Alfa', { budget: { max_steps: 1 } });
  assert.deepStrictEqual([exe.status, exe.error_code], ['failed', 'BUDGET_EXCEEDED']);
  assert.strictEqual(exe.budget.max_steps, 1);
  assert.strictEqual(exe.plan[2].status, 'running', 'parou no passo em que estourou');
});

test('O6. staging com CI verde e nível 4; produção só depois de aprovação humana e do mesmo commit em staging', async () => {
  const o = orch(scriptedRouter({}));
  await setAutonomy(4);
  fake.checks.set('develop', [{ ...GREEN[0], conclusion: 'failure' }, GREEN[1], GREEN[2]]);
  const red = await startAndRun(o, 'Publique o Site Alfa em staging');
  assert.deepStrictEqual([red.exe.intent, red.exe.status, red.exe.error_code], ['deploy_staging', 'failed', 'GATES_FAILED']);
  assert.strictEqual(fake.dispatches.length, 0, 'CI vermelho: staging não disparado');

  fake.checks.set('develop', GREEN);
  const { ctx, exe } = await startAndRun(o, 'Publique o Site Alfa em staging');
  assert.strictEqual(exe.status, 'running', JSON.stringify(exe.plan));
  assert.ok(exe.deployment_id);
  assert.deepStrictEqual(fake.dispatches.map(d => [d.workflow, d.inputs.target]), [['nexia-pipeline.yml', 'staging']]);
  assert.strictEqual(exe.gates.find(g => g.gate === 9).status, 'pending');
  Object.assign(fake.runs.at(-1), { status: 'completed', conclusion: 'success', updated_at: new Date().toISOString() });
  const done = await o.refresh(ctx, exe.id);
  assert.strictEqual(done.status, 'succeeded', JSON.stringify(done.gates));
  assert.strictEqual((await vault.Deployment.get(user, exe.deployment_id)).status, 'succeeded');

  await setAutonomy(4);
  const prod = await startAndRun(o, 'Publique o Site Alfa em produção');
  assert.deepStrictEqual([prod.exe.intent, prod.exe.status], ['deploy_production', 'waiting_approval']);
  assert.strictEqual(prod.exe.gates.find(g => g.gate === 11).status, 'pending');
  assert.strictEqual(fake.dispatches.length, 1, 'nada disparado para produção sem pessoa');
  const pending = prod.exe.plan[1].tool_call_ids.at(-1);
  const tc = await vault.ToolCall.get(user, pending);
  assert.deepStrictEqual([tc.tool, tc.risk, tc.environment, tc.decision], ['deploy.production', 'CRITICAL', 'production', 'confirm']);
  const ok = await gateway().approve(user, pending, { expectedVersion: tc.version });
  assert.strictEqual(ok.status, 'succeeded', JSON.stringify(ok.error));
  const after = await o.resume(prod.ctx, prod.exe.id);
  assert.strictEqual(after.status, 'running', `${after.error_code}: ${after.result_summary}`);
  assert.deepStrictEqual(fake.dispatches.at(-1).inputs, { target: 'production' });
  const dep = await vault.Deployment.get(user, after.deployment_id);
  assert.deepStrictEqual([dep.release.startsWith('production-'), dep.approved_by.id, dep.commit_sha], [true, 'gilcambe', fake.branches.get('develop')]);
  assert.deepStrictEqual(after.gates.filter(g => g.gate >= 9).map(g => g.status), ['passed', 'pending', 'pending']);
  Object.assign(fake.runs.at(-1), { status: 'completed', conclusion: 'success', updated_at: new Date().toISOString() });
  const live = await o.refresh(prod.ctx, prod.exe.id);
  assert.strictEqual(live.status, 'succeeded', JSON.stringify(live.gates));
  assert.match(live.gates.find(g => g.gate === 11).evidence, /aprovado por gilcambe/);
});

test('O7. pergunta: só leitura, conclui com a resposta do agente', async () => {
  await setAutonomy(0);
  const o = orch(scriptedRouter({ architect: [{ tool_calls: [call('github.list_branches', {})] }, { text: 'Há 2 branches principais: develop e main.' }] }));
  const { exe } = await startAndRun(o, 'Quais branches o Site Alfa tem?');
  assert.deepStrictEqual([exe.intent, exe.status], ['status', 'succeeded']);
  assert.match(exe.result_summary, /develop e main/);
  assert.strictEqual(exe.plan[0].tool_call_ids.length, 1);
});

test('O8. API /api/nexia/executions: 202 e execução em segundo plano; pergunta sem execução; admin de outro tenant barrado', async () => {
  const { createHandler } = require('../../nexia-ai/api');
  await setAutonomy(0);
  const jobs = [];
  const mkHandler = (role, tenantSlug = T) => createHandler({ db, verify: async () => ({ ok: true, uid: 'gilcambe', role, tenantSlug }),
    gateway: { env: fake.env, fetchImpl: fake.fetchImpl },
    router: scriptedRouter({ architect: [{ text: 'O Site Alfa tem develop e main.' }] }), background: fn => jobs.push(fn) });
  const api = async (h, method, path, body) => {
    const u = new URL(`http://x${path}`);
    const r = await h({ httpMethod: method, path: u.pathname, headers: { 'content-type': 'application/json' }, queryStringParameters: Object.fromEntries(u.searchParams), body: body ? JSON.stringify(body) : null });
    return { status: r.statusCode, body: JSON.parse(r.body) };
  };
  const h = mkHandler('admin');
  const created = await api(h, 'POST', '/api/nexia/executions', { message: 'Quais branches o Site Alfa tem?', project_id: ids.project });
  assert.strictEqual(created.status, 202, JSON.stringify(created.body));
  assert.strictEqual(created.body.execution.status, 'planned');
  assert.strictEqual(jobs.length, 1);
  await jobs[0]();
  const got = await api(h, 'GET', `/api/nexia/executions/${created.body.execution.id}`);
  assert.deepStrictEqual([got.status, got.body.record.status], [200, 'succeeded']);
  assert.match(got.body.record.result_summary, /develop e main/);
  const list = await api(h, 'GET', `/api/nexia/executions?project_id=${ids.project}`);
  assert.ok(list.body.items.some(x => x.id === created.body.execution.id));
  const refreshed = await api(h, 'POST', `/api/nexia/executions/${created.body.execution.id}/refresh`);
  assert.strictEqual(refreshed.body.record.status, 'succeeded', 'final não muda');
  const ask = await api(h, 'POST', '/api/nexia/executions', { message: 'corrija o formulário de contato' });
  assert.deepStrictEqual([ask.status, ask.body.status, jobs.length], [200, 'needs_input', 1]);
  assert.strictEqual((await api(h, 'POST', '/api/nexia/executions', { message: '' })).status, 400);
  assert.strictEqual((await api(mkHandler('admin', 'outro-tenant'), 'GET', `/api/nexia/executions?tenant=${T}`)).status, 403);
  assert.strictEqual((await api(mkHandler('user'), 'GET', '/api/nexia/executions')).status, 403);
});

test('O8b. ADR-FREE-02: com a fila ligada, a API só registra e enfileira (só ids); o runner do Actions termina a execução', async () => {
  const { createHandler } = require('../../nexia-ai/api');
  const { runJob } = require('../../nexia-ai/jobs/runner');
  await setAutonomy(0);
  const queued = [];
  const { validateJob } = require('../../nexia-ai/jobs');
  const jobs = { enabled: true, dispatch: async j => { queued.push(validateJob(j)); return { queued: true, kind: j.kind }; } };
  const h = createHandler({ db, jobs, verify: async () => ({ ok: true, uid: 'gilcambe', role: 'admin', tenantSlug: T }),
    gateway: { env: fake.env, fetchImpl: fake.fetchImpl }, background: () => { throw new Error('não deveria rodar no processo da API'); } });
  const api = async (method, path, body) => {
    const r = await h({ httpMethod: method, path, headers: { 'content-type': 'application/json' }, queryStringParameters: {}, body: body ? JSON.stringify(body) : null });
    return { status: r.statusCode, body: JSON.parse(r.body) };
  };
  const created = await api('POST', '/api/nexia/executions', { message: 'Quais branches o Site Alfa tem?', project_id: ids.project });
  assert.strictEqual(created.status, 202, JSON.stringify(created.body));
  assert.deepStrictEqual(created.body.job, { queued: true, kind: 'execution.run' });
  assert.strictEqual(queued.length, 1);
  assert.deepStrictEqual(Object.keys(queued[0]).sort(), ['actor', 'ctx_id', 'id', 'kind', 'tenant']);
  assert.ok(!JSON.stringify(queued[0]).includes('Site Alfa'), 'a tarefa leva só ids (log público do Actions)');
  const out = await runJob(queued[0], { db, orchestrator: orch(scriptedRouter({ architect: [{ text: 'O Site Alfa tem develop e main.' }] })) });
  assert.deepStrictEqual(out, { kind: 'execution.run', id: created.body.execution.id, status: 'succeeded' });
  const got = await api('GET', `/api/nexia/executions/${created.body.execution.id}`);
  assert.deepStrictEqual([got.body.record.status, got.body.record.execution_id], ['succeeded', queued[0].ctx_id]);
  const sw = await api('POST', '/api/nexia/executions/sweep');
  assert.deepStrictEqual([sw.status, queued[1]], [202, { kind: 'sweep', tenant: T, actor: { type: 'user', id: 'gilcambe' } }]);
  const ob = await api('POST', `/api/nexia/projects/${ids.project}/onboard`, { repository: { owner: 'gilcambe', repo: 'nexia' } });
  assert.deepStrictEqual([ob.status, queued[2].kind, queued[2].repository], [202, 'project.onboard', { owner: 'gilcambe', repo: 'nexia' }]);
  assert.strictEqual((await api('POST', `/api/nexia/projects/${ids.project}/onboard`, { repository: { owner: 'a/b' } })).status, 400);
});

test('O9. sweep retoma execução parada; /api/nexia/metrics agrega custo e auditoria do projeto', async () => {
  await setAutonomy(0);
  const ctx = newCtx();
  const o1 = orch(scriptedRouter({ architect: [{ text: 'Resposta retomada.' }] }));
  const s = await o1.start(ctx, { message: 'Quais branches o Site Alfa tem?', projectId: ids.project });
  assert.strictEqual(s.execution.status, 'planned', 'processo "caiu" antes do run');
  const fresh = await o1.sweep(newCtx());
  assert.ok(!fresh.some(x => x.id === s.execution.id), 'recente: não mexe');
  const later = createOrchestrator({ vault, gateway: gateway(), router: scriptedRouter({ architect: [{ text: 'Resposta retomada.' }] }), now: () => new Date(Date.now() + 3600e3) });
  const swept = await later.sweep(newCtx());
  const mine = swept.find(x => x.id === s.execution.id);
  assert.deepStrictEqual([mine.action, mine.from, mine.to], ['run', 'planned', 'succeeded']);

  const { createHandler } = require('../../nexia-ai/api');
  const h = createHandler({ db, verify: async () => ({ ok: true, uid: 'gilcambe', role: 'admin', tenantSlug: T }), gateway: { env: fake.env, fetchImpl: fake.fetchImpl }, router: scriptedRouter({}) });
  const get = async p => { const u = new URL(`http://x${p}`); const r = await h({ httpMethod: 'GET', path: u.pathname, headers: {}, queryStringParameters: Object.fromEntries(u.searchParams), body: null }); return { status: r.statusCode, body: JSON.parse(r.body) }; };
  const m = await get(`/api/nexia/metrics?project_id=${ids.project}`);
  assert.strictEqual(m.status, 200, JSON.stringify(m.body));
  assert.ok(m.body.executions.total >= 8 && m.body.executions.by_status.succeeded >= 2);
  assert.ok(m.body.tools['github.create_branch'].total >= 1 && m.body.deployments.by_environment.production.last.approved_by === 'gilcambe');
  assert.ok(!JSON.stringify(m.body).includes('<button'), 'conteúdo de arquivo nunca aparece');
  assert.strictEqual((await get('/api/nexia/metrics?since=ontem')).status, 400);
  assert.strictEqual((await get(`/api/nexia/metrics?project_id=prj_${'0'.repeat(32)}`)).status, 404);
});

test('O10. retomada agendada: só com o segredo do Cron; continua em nome de quem pediu; não toca em aprovações', async () => {
  await setAutonomy(0);
  const ctx = newCtx();
  const s = await orch(scriptedRouter({})).start(ctx, { message: 'Quais branches o Site Alfa tem?', projectId: ids.project });
  assert.strictEqual(s.execution.status, 'planned');
  const { createHandler } = require('../../nexia-ai/api');
  const secret = 'c'.repeat(40);
  const mk = env => createHandler({ db, env, verify: async () => { throw new Error('cron não usa token de pessoa'); },
    gateway: { env: fake.env, fetchImpl: fake.fetchImpl }, router: scriptedRouter({ architect: [{ text: 'Retomada pelo cron.' }] }),
    now: () => new Date(Date.now() + 3600e3) });
  const post = (h, headers = {}, method = 'POST') => h({ httpMethod: method, path: '/api/nexia/internal/sweep', headers, queryStringParameters: {}, body: '{}' })
    .then(r => ({ status: r.statusCode, body: JSON.parse(r.body) }));
  assert.strictEqual((await post(mk({}), { 'x-nexia-cron': secret })).status, 404, 'sem segredo configurado a rota não existe');
  assert.strictEqual((await post(mk({ NEXIA_CRON_SECRET: 'curto' }), { 'x-nexia-cron': 'curto' })).status, 404, 'segredo fraco não liga a rota');
  const h = mk({ NEXIA_CRON_SECRET: secret });
  assert.strictEqual((await post(h)).status, 401);
  assert.strictEqual((await post(h, { 'x-nexia-cron': 'd'.repeat(40) })).status, 401);
  assert.strictEqual((await post(h, { 'x-nexia-cron': secret }, 'GET')).status, 405);
  const r = await post(h, { 'x-nexia-cron': secret });
  assert.strictEqual(r.status, 200, JSON.stringify(r.body));
  const mine = r.body.items.find(x => x.id === s.execution.id);
  assert.deepStrictEqual([mine.tenant, mine.action, mine.from, mine.to], [T, 'run', 'planned', 'succeeded']);
  assert.ok(r.body.items.every(x => x.from !== 'waiting_approval'), 'aprovação pendente fica para a pessoa');
  const calls = await vault.ToolCall.list(newCtx(), { where: { project_id: ids.project }, limit: 200 });
  assert.ok(calls.every(c => c.requested_by.type !== 'system'), 'ferramentas nunca em nome do sistema');
});
