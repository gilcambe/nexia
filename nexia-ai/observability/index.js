'use strict';
// Observabilidade, auditoria e custos (spec §21, §30 fase 21; Fase 11 do plano).
// Agrega o que o Vault já registra — Execution (plano, gates, uso, custo), ToolCall (cada
// ferramenta, decisão da política, aprovação) e Deployment — por projeto ou pelo tenant.
// Só leitura; nenhum dado de entrada de ferramenta é exposto (o Vault guarda só resumos).
const LIMIT = 200; // máximo do Vault por listagem; "truncated" avisa quando o recorte pode estar incompleto

const inc = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; return o; };

/**
 * @param {{ vault, ctx, projectId?: string, since?: string }} o  since: ISO; só registros a partir dessa data
 */
async function collectMetrics({ vault, ctx, projectId, since }) {
  const where = projectId ? { project_id: projectId } : {};
  const after = r => !since || String(r.created_at || r.started_at || r.requested_at || '') >= since;
  const [exes, calls, deps, envs] = await Promise.all([
    vault.Execution.list(ctx, { where, limit: LIMIT }),
    vault.ToolCall.list(ctx, { where, limit: LIMIT }),
    vault.Deployment.list(ctx, { where, limit: LIMIT }),
    vault.Environment.list(ctx, { where, limit: LIMIT }),
  ]);
  const e = exes.filter(after);
  const c = calls.filter(after);
  const d = deps.filter(after);
  const envName = new Map(envs.map(x => [x.id, x.name]));

  const executions = { total: e.length, by_status: {}, by_intent: {}, input_tokens: 0, output_tokens: 0, tool_calls: 0,
    cost_usd: 0, cost_unknown: 0, duration_ms_total: 0, finished: 0 };
  for (const x of e) {
    inc(executions.by_status, x.status); inc(executions.by_intent, x.intent);
    const u = x.usage || {};
    executions.input_tokens += u.input_tokens || 0; executions.output_tokens += u.output_tokens || 0; executions.tool_calls += u.tool_calls || 0;
    executions.cost_usd += (u.cost_usd_micros || 0) / 1e6;
    if (u.cost_known === false) executions.cost_unknown++;
    if (x.finished_at) { executions.finished++; executions.duration_ms_total += Date.parse(x.finished_at) - Date.parse(x.started_at); }
  }
  const finals = (executions.by_status.succeeded || 0) + (executions.by_status.failed || 0);
  executions.success_rate = finals ? Math.round(((executions.by_status.succeeded || 0) / finals) * 1000) / 1000 : null;
  executions.avg_duration_ms = executions.finished ? Math.round(executions.duration_ms_total / executions.finished) : null;
  executions.cost_usd = Math.round(executions.cost_usd * 1e6) / 1e6;
  delete executions.duration_ms_total;

  const tools = {};
  const decisions = {};
  const approvals = { pending: 0, approved: 0, rejected: 0, expired: 0 };
  for (const x of c) {
    const t = tools[x.tool] || (tools[x.tool] = { risk: x.risk, total: 0, succeeded: 0, failed: 0, denied: 0, duration_ms_total: 0, timed: 0 });
    t.total++;
    if (x.status === 'succeeded') t.succeeded++;
    if (x.status === 'failed') t.failed++;
    if (x.status === 'denied') t.denied++;
    if (x.duration_ms !== undefined) { t.duration_ms_total += x.duration_ms; t.timed++; }
    inc(decisions, x.decision);
    if (x.decision === 'confirm') {
      if (x.status === 'pending_approval') approvals.pending++;
      else if (x.status === 'rejected') approvals.rejected++;
      else if (x.status === 'expired') approvals.expired++;
      else approvals.approved++;
    }
  }
  for (const t of Object.values(tools)) { t.avg_duration_ms = t.timed ? Math.round(t.duration_ms_total / t.timed) : null; delete t.duration_ms_total; delete t.timed; }

  const deployments = { total: d.length, by_environment: {} };
  for (const x of d) {
    const name = envName.get(x.environment_id) || 'outro';
    const b = deployments.by_environment[name] || (deployments.by_environment[name] = { total: 0, by_status: {}, last: null });
    b.total++; inc(b.by_status, x.status);
    if (!b.last || x.started_at > b.last.started_at) b.last = { id: x.id, status: x.status, release: x.release, started_at: x.started_at, approved_by: x.approved_by ? x.approved_by.id : undefined };
  }

  return {
    scope: projectId ? { project_id: projectId } : { tenant: ctx.tenantId }, since: since || null,
    truncated: [exes, calls, deps].some(l => l.length >= LIMIT),
    executions, tools, decisions, approvals, deployments,
  };
}

module.exports = { collectMetrics };
