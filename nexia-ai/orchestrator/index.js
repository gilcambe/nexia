'use strict';
// NEXIA Orchestrator (spec §6 "Fluxo de cada solicitação", §7, §16, §22, §27).
//   INPUT → intenção → cliente/projeto → contexto do Vault → plano → permissões (Policy
//   Engine, via Tool Gateway) → agentes/ferramentas → testes (gates) → revisão →
//   commit/PR/deploy conforme política → registro no Vault (Execution) → resposta com evidências.
//
// O Orchestrator não codifica: as mudanças de código são dos agentes. Passos mecânicos
// (criar branch, abrir PR, disparar staging, ler checks) são feitos direto pelo Tool
// Gateway, porque não precisam de modelo e assim ficam determinísticos.
// Nada é declarado concluído sem os gates com evidência; a execução fica "running"
// enquanto o CI roda e é reavaliada por refresh().
const crypto = require('crypto');
const { resolveProject } = require('../project-resolver');
const { buildContext } = require('../context-engine');
const { runAgent, createMeter } = require('./runtime');
const { evaluateGates, verdict } = require('./gates');
const { normalize } = require('../text');

const DEFAULT_BUDGET = Object.freeze({ max_steps: 40, max_tool_calls: 80, max_tokens: 800000, max_ms: 20 * 60 * 1000 });
const FINAL = ['succeeded', 'failed', 'cancelled'];

// ── Intenção ─────────────────────────────────────────────────────────────────
// Classificador por regras (determinístico e auditável). Ordem importa.
const INTENT_RULES = [
  ['deploy_production', /\b(produc[aã]o|production|prod)\b/],
  ['deploy_staging', /\b(staging|homologa[cç][aã]o)\b/],
  ['pipeline', /\b(pipeline|ci ?\/ ?cd|github actions|workflow)\b/],
  ['status', /\b(status|pendente|pendencias|o que mudou|ultimo deploy|quais|liste|mostre|compare|resuma)\b/],
  ['change', /\b(corrij\w*|corrigir|implement\w*|alter\w*|adicion\w*|crie|criar|remov\w*|aument\w*|diminu\w*|mud\w*|ajust\w*|consert\w*|refator\w*|troqu\w*|troca\w*|fix)\b/],
];
function classifyIntent(message) {
  const m = normalize(message || '');
  for (const [intent, re] of INTENT_RULES) if (re.test(m)) return intent;
  return 'question';
}
const wantsStaging = message => /\b(staging|homologa|publiqu\w*|publicar)\b/.test(normalize(message || ''));

function specialistFor(message) {
  const m = normalize(message || '');
  if (/\b(botao|tela|css|layout|pagina|formulario|ui|responsiv\w*|componente|estilo|cor|fonte|seo|acessibilidade)\b/.test(m)) return 'frontend';
  if (/\b(firestore|banco|indice|schema|migra\w*|colecao|regras)\b/.test(m)) return 'database';
  if (/\b(api|endpoint|funcao|autentica\w*|webhook|job|backend|servidor)\b/.test(m)) return 'backend';
  return 'coder';
}

const slug = s => normalize(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'tarefa';

// ── Planos por intenção ──────────────────────────────────────────────────────
function planFor(intent, message) {
  const sp = specialistFor(message);
  const P = (agent, goal, action) => ({ agent, goal, action });
  switch (intent) {
    case 'change': return [
      P('architect', 'Analisar o pedido, localizar arquivos e propor a mudança mínima', 'agent:analyze'),
      P('coder', 'Criar a branch de trabalho "nexia/..."', 'create_branch'),
      P(sp, 'Implementar a mudança na branch de trabalho', 'agent:implement'),
      P('reviewer', 'Revisar o diff contra o pedido', 'agent:review'),
      P('security', 'Revisar o diff quanto a segurança', 'agent:security'),
      P('devops', 'Abrir o PR (rascunho) para a branch padrão', 'create_pr'),
      P('qa', 'Verificar os checks do CI (gates 1–7)', 'checks'),
    ];
    case 'pipeline': return [
      P('devops', 'Gerar o pipeline modelo a partir dos ambientes do Vault', 'render_pipeline'),
      P('devops', 'Criar a branch de trabalho', 'create_branch'),
      P('devops', 'Commitar o pipeline na branch', 'commit_pipeline'),
      P('devops', 'Abrir o PR (rascunho)', 'create_pr'),
      P('qa', 'Verificar os checks do CI (gates 1–7)', 'checks'),
    ];
    case 'deploy_staging': return [
      P('qa', 'Confirmar que o CI da branch de staging está verde (gates 1–7)', 'checks_before_deploy'),
      P('devops', 'Disparar o pipeline para staging', 'deploy_staging'),
      P('devops', 'Acompanhar o deploy e o health check', 'sync_deploy'),
    ];
    case 'deploy_production': return [P('devops', 'Produção exige aprovação humana (Fase 11)', 'production_blocked')];
    default: return [P('architect', 'Responder ao pedido só com leitura do Vault e do GitHub', 'agent:answer')];
  }
}

/**
 * @param {{ vault, gateway, router, now?: () => Date, resolver?, contextBuilder? }} deps
 */
function createOrchestrator(deps) {
  const { vault, gateway, router } = deps;
  const now = deps.now || (() => new Date());
  const resolve = deps.resolver || resolveProject;
  const contextOf = deps.contextBuilder || buildContext;
  const agentCtx = (ctx, agent) => ({ ...ctx, actor: { type: 'agent', id: agent } });

  async function save(ctx, exe, patch) {
    return vault.Execution.update(ctx, exe.id, patch, { expectedVersion: exe.version });
  }
  const tool = (ctx, exe, agent, name, input) => gateway.invoke(agentCtx(ctx, agent), { projectId: exe.project_id, tool: name, input });

  /** Executa os passos a partir do primeiro não concluído. */
  async function advance(ctx, exe, req) {
    const message = exe.request_summary;
    const plan = planFor(exe.intent, message);
    const meter = createMeter({ ...DEFAULT_BUDGET, ...(exe.budget || {}) });
    const project = await vault.Project.get(ctx, exe.project_id);
    const repo = project.primary_repository_id ? await vault.Repository.get(ctx, project.primary_repository_id)
      : (await vault.Repository.list(ctx, { where: { project_id: project.id }, limit: 1 }))[0];
    let context = null;
    const getContext = async () => context || (context = (await contextOf({ vault, ctx, projectId: project.id, message })).text);
    const baseUsage = exe.usage || {};   // uso acumulado antes desta rodada
    let state = { ...exe };
    let steps = exe.plan.map(s => ({ ...s }));
    let stop = null;          // { status, error_code?, result_summary?, question? }
    let checks = null;

    const commit = async patch => {
      state = await save(ctx, state, { plan: steps, usage: usageOf(meter, baseUsage), models: [...new Set([...(state.models || []), ...meter.usage.models])].slice(0, 20), ...patch });
      steps = state.plan.map(s => ({ ...s }));
    };
    const stepDone = (i, o) => { steps[i] = { ...steps[i], status: 'done', attempts: (steps[i].attempts || 0) + 1, ...clean(o) }; };
    const stepWait = (i, o) => { steps[i] = { ...steps[i], status: 'waiting_approval', attempts: (steps[i].attempts || 0) + 1, ...clean(o) }; };
    const stepFail = (i, o) => { steps[i] = { ...steps[i], status: 'failed', attempts: (steps[i].attempts || 0) + 1, ...clean(o) }; };
    const ids = r => (r && r.tool_call ? [r.tool_call.id] : []);
    const addIds = (i, more) => [...new Set([...(steps[i].tool_call_ids || []), ...more])].slice(0, 50);

    // Resultado de uma ferramenta determinística: segue, espera aprovação ou falha.
    const handle = (i, r, okSummary) => {
      if (r.status === 'succeeded') { stepDone(i, { tool_call_ids: addIds(i, ids(r)), summary: okSummary(r.result) }); return true; }
      if (r.status === 'pending_approval') { stepWait(i, { tool_call_ids: addIds(i, ids(r)), summary: `Aguardando aprovação: ${r.reason}` }); stop = { status: 'waiting_approval', result_summary: `Aguardando aprovação humana em /aprovacoes (${steps[i].goal}).` }; return false; }
      const code = r.status === 'denied' ? 'POLICY_DENIED' : (r.error && r.error.code) || 'TOOL_ERROR';
      stepFail(i, { tool_call_ids: addIds(i, ids(r)), error_code: code, summary: (r.error && r.error.message) || r.reason || code });
      stop = { status: 'failed', error_code: code, result_summary: `Falhou em "${steps[i].goal}": ${(r.error && r.error.message) || r.reason || code}` };
      return false;
    };

    const runA = async (i, agentId, goal, extraCtx = '') => {
      steps[i] = { ...steps[i], status: 'running' };
      await commit({ status: 'running' });
      const r = await runAgent({ agentId, goal, context: `${await getContext()}${extraCtx}`, router, gateway, ctx: agentCtx(ctx, agentId), projectId: project.id, meter });
      const base = { tool_call_ids: addIds(i, r.tool_call_ids), ...(r.model ? { model: r.model } : {}) };
      if (r.status === 'done') { stepDone(i, { ...base, summary: r.report ? `${r.report.verdict}: ${r.report.findings.map(f => `[${f.severity}] ${f.file ? `${f.file}: ` : ''}${f.message}`).join(' | ') || 'sem problemas'}` : r.text }); return r; }
      if (r.status === 'waiting_approval') { stepWait(i, { ...base, summary: r.text }); stop = { status: 'waiting_approval', result_summary: `Aguardando aprovação humana em /aprovacoes: ${r.pending.tool}.` }; return r; }
      stepFail(i, { ...base, error_code: r.error_code, summary: r.text });
      stop = { status: 'failed', error_code: r.error_code, result_summary: `O agente ${agentId} falhou: ${r.text}` };
      return r;
    };

    const readChecks = async (i, ref) => {
      const r = await tool(ctx, state, 'qa', 'github.get_checks', { ref });
      if (r.status !== 'succeeded') { handle(i, r); return null; }
      return { list: r.result.runs, id: r.tool_call.id };
    };

    try {
      for (let i = 0; i < plan.length && !stop; i++) {
        if (steps[i].status === 'done' || steps[i].status === 'skipped') continue;
        const { action } = plan[i];
        const analysis = (steps.find((s, k) => plan[k].action === 'agent:analyze') || {}).summary || '';
        const diffRef = `${repo ? repo.default_branch : 'main'}...${state.work_branch}`;

        if (action === 'agent:analyze' || action === 'agent:answer') {
          await runA(i, plan[i].agent, action === 'agent:answer'
            ? `Pedido do usuário: "${message}"\nResponda com base nas ferramentas de leitura. Cite as evidências (ids, arquivos, SHAs).`
            : `Pedido do usuário: "${message}"\nAnalise o repositório do projeto, localize os arquivos envolvidos e descreva a mudança mínima (arquivos e o que muda). Não altere nada.`);
        } else if (action === 'create_branch') {
          const branch = state.work_branch || `nexia/${slug(message)}-${state.execution_id.slice(-6).toLowerCase().replace(/[^a-z0-9]/g, '')}`;
          if (!state.work_branch) await commit({ work_branch: branch });
          const r = await tool(ctx, state, plan[i].agent, 'github.create_branch', { branch });
          const exists = r.status === 'failed' && r.error && r.error.code === 'CONFLICT' && (steps[i].attempts || 0) > 0;
          if (exists) stepDone(i, { tool_call_ids: addIds(i, ids(r)), summary: `${branch} já existia (retomada)` });
          else handle(i, r, x => `branch ${x.branch} criada de ${x.from}`);
        } else if (action === 'agent:implement') {
          await runA(i, plan[i].agent, `Pedido do usuário: "${message}"\nBranch de trabalho: ${state.work_branch} (já existe).\nAnálise do Architect:\n${analysis}\n\nLeia os arquivos atuais com github.get_file (ref ${state.work_branch}) e faça UM commit com github.commit_files na branch ${state.work_branch}. Não mexa em outros arquivos.`);
          if (!stop) {
            // Confirmação pela ferramenta: a branch tem que estar à frente da padrão.
            const c = await tool(ctx, state, 'qa', 'github.compare', { base: repo.default_branch, head: state.work_branch });
            if (c.status !== 'succeeded' || !c.result.ahead_by) {
              stepFail(i, { tool_call_ids: addIds(i, ids(c)), error_code: 'NO_CHANGES', summary: 'Nenhum commit na branch de trabalho; nada foi alterado.' });
              stop = { status: 'failed', error_code: 'NO_CHANGES', result_summary: 'O agente terminou sem commit na branch de trabalho; nada foi alterado.' };
            } else steps[i] = { ...steps[i], tool_call_ids: addIds(i, ids(c)), summary: `${steps[i].summary || ''}\n${c.result.ahead_by} commit(s), ${c.result.files.length} arquivo(s): ${c.result.files.map(f => f.path).slice(0, 10).join(', ')}`.trim().slice(0, 2000) };
          }
        } else if (action === 'agent:review' || action === 'agent:security') {
          const r = await runA(i, plan[i].agent, `Pedido do usuário: "${message}"\nRevise o diff ${diffRef} (github.compare com base ${repo.default_branch} e head ${state.work_branch}) e termine com report_findings.`);
          if (r.status === 'done') {
            const v = r.report ? r.report.verdict : 'changes_requested';
            if (!r.report) steps[i] = { ...steps[i], summary: `sem veredito estruturado (tratado como changes_requested): ${steps[i].summary || ''}`.slice(0, 2000) };
            await commit(action === 'agent:review' ? { review_verdict: v } : { security_verdict: v });
          }
        } else if (action === 'create_pr') {
          const r = await tool(ctx, state, plan[i].agent, 'github.create_pr', { head: state.work_branch,
            title: `NEXIA: ${message}`.slice(0, 120),
            body: `Pedido: ${message}\n\nExecution: ${state.execution_id}\nReviewer: ${state.review_verdict || '—'} · Security: ${state.security_verdict || '—'}\n\nAberto pelo NEXIA AI (rascunho). O merge é de uma pessoa.` });
          if (handle(i, r, x => `PR #${x.number} ${x.html_url}`)) await commit({ pull_request: r.result.number });
        } else if (action === 'checks' || action === 'checks_before_deploy') {
          const env = action === 'checks_before_deploy' ? (await vault.Environment.list(ctx, { where: { project_id: project.id }, limit: 20 })).find(e => e.name === 'staging') : null;
          const ref = action === 'checks' ? state.work_branch : ((env && env.branch) || repo.default_branch);
          const c = await readChecks(i, ref);
          if (c) {
            checks = c.list;
            const g = evaluateGates({ checks }).filter(x => x.gate <= 7);
            stepDone(i, { tool_call_ids: addIds(i, [c.id]), summary: g.map(x => `G${x.gate} ${x.status}`).join(', ') });
            if (action === 'checks_before_deploy' && verdict(g) !== 'passed') {
              stop = { status: verdict(g) === 'failed' ? 'failed' : 'running', error_code: verdict(g) === 'failed' ? 'GATES_FAILED' : undefined,
                result_summary: `O CI de ${ref} não está verde (${g.filter(x => x.status !== 'passed' && x.status !== 'not_applicable').map(x => `${x.name}: ${x.status}`).join('; ')}); staging não foi disparado.` };
            }
          }
        } else if (action === 'render_pipeline' || action === 'commit_pipeline') {
          if (action === 'render_pipeline') {
            const r = await tool(ctx, state, 'devops', 'cicd.render_pipeline', {});
            handle(i, r, x => `${x.path}${x.warnings.length ? ` (avisos: ${x.warnings.join(' ')})` : ''}`);
          } else {
            const r0 = await tool(ctx, state, 'devops', 'cicd.render_pipeline', {});
            if (handle(i, r0, () => 'pipeline gerado')) {
              steps[i].status = 'running';
              const r = await tool(ctx, state, 'devops', 'github.commit_files', { branch: state.work_branch, message: 'Adiciona o pipeline NEXIA (CI, staging e produção protegida)', files: [{ path: r0.result.path, content: r0.result.content }] });
              handle(i, r, x => `commit ${x.commit.slice(0, 7)} em ${x.branch}`);
            }
          }
        } else if (action === 'deploy_staging') {
          const r = await tool(ctx, state, 'devops', 'deploy.staging', {});
          if (handle(i, r, x => `${x.workflow} em ${x.ref} → ${x.deployment_id}`)) await commit({ deployment_id: r.result.deployment_id });
        } else if (action === 'sync_deploy') {
          const r = await tool(ctx, state, 'devops', 'deploy.sync_status', { deployment_id: state.deployment_id });
          handle(i, r, x => `Deployment ${x.deployment_id}: ${x.status}`);
        } else if (action === 'production_blocked') {
          steps[i] = { ...steps[i], status: 'skipped', summary: 'Produção ainda não é executada pelo NEXIA; exige aprovação humana (Fase 11).' };
          stop = { status: 'needs_input', question: 'Produção exige aprovação humana pelo fluxo de produção (Fase 11). Quer publicar em staging primeiro?',
            result_summary: 'Produção não foi tocada.' };
        }
        await commit({ status: stop ? stop.status : 'running' });
      }
    } catch (e) {
      const code = e && e.code === 'BUDGET_EXCEEDED' ? 'BUDGET_EXCEEDED' : (e && /^[A-Z_]+$/.test(e.code || '') ? e.code : 'ORCHESTRATOR_ERROR');
      stop = { status: 'failed', error_code: code, result_summary: code === 'BUDGET_EXCEEDED' ? e.message : 'Erro interno do Orchestrator; nada foi dado como concluído.' };
      if (code === 'ORCHESTRATOR_ERROR') console.error('[orchestrator]', e && e.stack);
    }

    return finish(ctx, state, steps, meter, stop, checks, baseUsage);
  }

  async function gateEvidence(ctx, exe, checks) {
    let ck = checks;
    if (!ck && exe.work_branch && ['change', 'pipeline'].includes(exe.intent)) {
      const r = await tool(ctx, exe, 'qa', 'github.get_checks', { ref: exe.work_branch });
      ck = r.status === 'succeeded' ? r.result.runs : null;
    }
    let deployment = null;
    if (exe.deployment_id) {
      const s = await tool(ctx, exe, 'devops', 'deploy.sync_status', { deployment_id: exe.deployment_id });
      deployment = s.status === 'succeeded' ? { id: exe.deployment_id, status: s.result.status } : await vault.Deployment.get(ctx, exe.deployment_id);
    }
    const isChange = exe.intent === 'change';
    return {
      checks: ['change', 'pipeline', 'deploy_staging'].includes(exe.intent) ? ck : [],
      review: isChange ? (exe.review_verdict ? { verdict: exe.review_verdict } : null) : { verdict: 'approve' },
      security: exe.security_verdict ? { verdict: exe.security_verdict } : null,
      wantsStaging: exe.intent === 'deploy_staging', deployment,
      wantsProduction: exe.intent === 'deploy_production',
    };
  }

  async function finish(ctx, exe, steps, meter, stop, checks, baseUsage = exe.usage) {
    const readOnly = ['question', 'status', 'unknown', 'review'].includes(exe.intent);
    let gates = [];
    let status = stop ? stop.status : 'running';
    let summary = stop && stop.result_summary;
    if (!stop) {
      if (readOnly) {
        status = 'succeeded';
        summary = steps.map(s => s.summary).filter(Boolean).join('\n').slice(0, 4000) || 'Concluído.';
      } else {
        gates = evaluateGates(await gateEvidence(ctx, exe, checks));
        const v = verdict(gates);
        status = v === 'passed' ? 'succeeded' : v === 'failed' ? 'failed' : 'running';
        summary = describe(exe, gates, v);
      }
    } else if (!readOnly && stop.status !== 'needs_input') {
      gates = evaluateGates(await gateEvidence(ctx, exe, checks).catch(() => ({ checks: null })));
    } else if (stop.status === 'needs_input') {
      gates = evaluateGates({ checks: [], review: { verdict: 'approve' }, wantsProduction: exe.intent === 'deploy_production' });
    }
    const patch = {
      plan: steps, status, gates, usage: usageOf(meter, baseUsage),
      models: [...new Set([...(exe.models || []), ...meter.usage.models])].slice(0, 20),
      result_summary: String(summary || '').slice(0, 4000) || undefined,
      ...(stop && stop.error_code ? { error_code: stop.error_code } : {}),
      ...(stop && stop.question ? { question: stop.question } : {}),
      ...(FINAL.includes(status) ? { finished_at: now().toISOString() } : {}),
    };
    return save(ctx, exe, clean(patch));
  }

  function describe(exe, gates, v) {
    const open = gates.filter(g => g.status === 'pending').map(g => g.name);
    const failed = gates.filter(g => g.status === 'failed').map(g => `${g.name} (${g.evidence})`);
    const where = [exe.work_branch && `branch ${exe.work_branch}`, exe.pull_request && `PR #${exe.pull_request}`, exe.deployment_id && `deployment ${exe.deployment_id}`].filter(Boolean).join(', ');
    if (v === 'passed') return `Concluído com todos os gates verdes${where ? ` (${where})` : ''}.`;
    if (v === 'failed') return `Não concluído: falhou ${failed.join('; ')}${where ? ` (${where})` : ''}.`;
    return `Em andamento${where ? ` (${where})` : ''}: aguardando ${open.join(', ')}.`;
  }

  /**
   * Novo pedido. Pedido ambíguo devolve a pergunta sem criar execução (spec §29 caso B).
   * @param ctx  contexto do usuário (tenant + ator)
   * @param {{ message, projectId?, conversationProjectId?, recentProjectIds?, repository?, budget?, idempotencyKey? }} req
   * @returns {{ status: 'needs_input', question, candidates } | { execution }}
   */
  async function start(ctx, req) {
    const message = String(req.message || '').trim();
    if (!message) return { status: 'needs_input', question: 'O que você quer fazer?', candidates: [] };
    const intent = classifyIntent(message);
    const r = await resolve({ vault, ctx, message, selectedProjectId: req.projectId, conversationProjectId: req.conversationProjectId,
      recentProjectIds: req.recentProjectIds, repository: req.repository });
    if (!r.project_id) {
      return { status: 'needs_input', intent, question: r.question || 'Não identifiquei o projeto. Qual é?', candidates: r.candidates };
    }
    const plan = planFor(intent, message).map((s, i) => ({ step: i + 1, agent: s.agent, goal: s.goal, status: 'pending', tool_call_ids: [] }));
    const { record, replayed } = await vault.Execution.create(ctx, {
      project_id: r.project_id, client_id: r.client_id, execution_id: ctx.executionId, requested_by: ctx.actor,
      request_summary: message.slice(0, 500), intent, status: 'planned', plan, budget: { ...DEFAULT_BUDGET, ...(req.budget || {}) },
      usage: { tool_calls: 0, input_tokens: 0, output_tokens: 0, cost_usd_micros: 0, cost_known: true, duration_ms: 0 },
      started_at: now().toISOString(),
    }, req.idempotencyKey ? { idempotencyKey: req.idempotencyKey } : {});
    return { execution: record, replayed, resolution: { confidence: r.confidence, rationale: r.rationale } };
  }

  /** Executa (ou continua) uma execução até concluir, esperar aprovação/CI ou falhar. */
  async function run(ctx, executionId) {
    const exe = await vault.Execution.get(ctx, executionId);
    if (FINAL.includes(exe.status) || exe.status === 'needs_input') return exe;
    return advance(ctx, exe);
  }

  /**
   * Retoma depois de uma aprovação: o passo que esperava segue se a chamada aprovada
   * terminou bem; falha se foi rejeitada/expirou/falhou; não faz nada se ainda está pendente.
   */
  async function resume(ctx, executionId) {
    const exe = await vault.Execution.get(ctx, executionId);
    if (exe.status !== 'waiting_approval') return run(ctx, executionId);
    const i = exe.plan.findIndex(s => s.status === 'waiting_approval');
    if (i < 0) return run(ctx, executionId);
    const lastId = (exe.plan[i].tool_call_ids || []).slice(-1)[0];
    const call = lastId ? await vault.ToolCall.get(ctx, lastId) : null;
    if (!call || call.status === 'pending_approval') return exe;
    const plan = exe.plan.map(s => ({ ...s }));
    const action = planFor(exe.intent, exe.request_summary)[i].action;
    if (call.status === 'succeeded') {
      // Passo determinístico: a própria chamada aprovada conclui o passo. Passo de agente: o
      // agente roda de novo para terminar o trabalho (a ação aprovada já foi feita).
      plan[i] = { ...plan[i], status: action.startsWith('agent:') ? 'pending' : 'done', summary: `${call.tool} aprovado e executado (${call.output_summary || 'ok'})`.slice(0, 2000) };
      const patch = { plan, status: 'running' };
      if (call.tool === 'github.create_pr' && /PR #(\d+)/.test(call.output_summary || '')) patch.pull_request = Number(RegExp.$1);
      if (call.tool === 'deploy.staging' && /→ (dpl_[0-9a-f]{32})/.test(call.output_summary || '')) patch.deployment_id = RegExp.$1;
      return advance(ctx, await save(ctx, exe, patch));
    }
    plan[i] = { ...plan[i], status: 'failed', error_code: call.error_code || call.status.toUpperCase() };
    return save(ctx, exe, { plan, status: 'failed', error_code: call.error_code || 'NOT_APPROVED', finished_at: now().toISOString(),
      result_summary: `A ação ${call.tool} não foi executada (${call.status}); a execução parou sem alterar mais nada.` });
  }

  /** Reavalia os gates (CI terminou? staging terminou?) de uma execução em andamento. */
  async function refresh(ctx, executionId) {
    const exe = await vault.Execution.get(ctx, executionId);
    if (exe.status !== 'running' || exe.plan.some(s => s.status !== 'done' && s.status !== 'skipped')) return exe;
    return finish(ctx, exe, exe.plan, createMeter({ ...DEFAULT_BUDGET }), null, null);
  }

  return { start, run, resume, refresh, classifyIntent, planFor };
}

function usageOf(meter, prev = {}) {
  const u = meter.usage;
  return {
    tool_calls: (prev.tool_calls || 0) + u.tool_calls,
    input_tokens: (prev.input_tokens || 0) + u.input_tokens,
    output_tokens: (prev.output_tokens || 0) + u.output_tokens,
    cost_usd_micros: (prev.cost_usd_micros || 0) + Math.round(u.cost_usd * 1e6),
    cost_known: (prev.cost_known !== false) && u.cost_known,
    duration_ms: (prev.duration_ms || 0) + meter.elapsed(),
  };
}
function clean(o) { return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')); }

module.exports = { createOrchestrator, classifyIntent, planFor, specialistFor, DEFAULT_BUDGET };
