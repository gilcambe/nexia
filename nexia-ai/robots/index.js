'use strict';
// ADR-AUTO-01: Robôs NEXIA. Um robô é um pedido ao Orchestrator que se repete numa agenda.
// Não faz nada sozinho além disso: cada rodada é uma execução comum, com a autonomia do
// projeto, as aprovações em /aprovacoes e o CI de sempre (deploy de produção só com aprovação).
//
// Fluxo agendado: Cron do Worker (a cada 5 min) → uma consulta (next_run_at <= agora) →
// havendo vencido, dispara UMA tarefa "robots.run" no GitHub Actions (só o tipo, sem ids) →
// runDueRobots reivindica cada robô (avança next_run_at com expectedVersion: duas tarefas
// nunca rodam o mesmo horário) → start + run da execução em nome do dono → registra a rodada.

const { createExecutionContext } = require('../vault/execution');
const { SCHEMAS } = require('../vault/schemas');
const { nextRunAt, DEFAULT_TZ } = require('./schedule');
const { TEMPLATES } = require('./templates');

const COLLECTION = SCHEMAS.Robot.collection;
const MAX_PER_SWEEP = 10;
const MAX_RUNS_KEPT = 10;
const MAX_PER_TENANT = 20;
const SYSTEM = { type: 'system', id: 'robots' };
// Campos que só o servidor grava (a tela não manda).
const SERVER_FIELDS = ['owner', 'next_run_at', 'last_run_at', 'last_run_execution_id', 'recent_runs'];

const toMs = v => (v && typeof v.toMillis === 'function' ? v.toMillis() : v instanceof Date ? v.getTime() : Date.parse(v));

/**
 * Robôs vencidos (todas as empresas), mais atrasados primeiro. Consulta de campo único:
 * robô desligado ou excluído não tem next_run_at e não aparece.
 * @param {{ select?: boolean }} o  select=true lê só os campos de controle (Cron do Worker)
 */
async function findDueRobots(db, nowMs, { limit = 25, select = false } = {}) {
  let q = db.collection(COLLECTION).where('next_run_at', '<=', new Date(nowMs)).orderBy('next_run_at', 'asc').limit(limit);
  if (select) q = q.select('enabled', 'deleted_at', 'next_run_at');
  const snap = await q.get();
  return snap.docs.map(d => d.data()).filter(r => r && r.enabled === true && !r.deleted_at);
}

/**
 * Normaliza o corpo vindo da tela para create/update: tira campos do servidor e recalcula
 * next_run_at quando agenda, fuso ou "ligado" mudam.
 * @param body     o que a tela mandou
 * @param current  registro atual (update) ou null (create)
 */
function prepareInput(body, current, nowMs = Date.now()) {
  const input = { ...(body && typeof body === 'object' && !Array.isArray(body) ? body : {}) };
  for (const k of SERVER_FIELDS) delete input[k];
  const merged = { ...(current || {}), ...input };
  const touches = !current || ['schedule', 'timezone', 'enabled'].some(k => k in input);
  if (touches) {
    let next = null;
    if (merged.enabled === true && merged.schedule) {
      // Agenda inválida: deixa o schema do Vault apontar o erro (schedule_shape).
      try { next = new Date(nextRunAt(merged.schedule, merged.timezone || DEFAULT_TZ, nowMs)).toISOString(); } catch { next = null; }
    }
    if (next) input.next_run_at = next;
    else if (current) input.next_run_at = null;
  }
  return input;
}

/** Acrescenta (ou atualiza, mesmo execution_id) uma rodada no topo da lista. */
function withRun(robot, run) {
  const runs = (robot.recent_runs || []).filter(r => !(run.execution_id && r.execution_id === run.execution_id));
  return [run, ...runs].slice(0, MAX_RUNS_KEPT);
}

/** Atualiza o robô relendo a versão (a tela pode ter editado no meio); 3 tentativas. */
async function patchRobot(vault, ctx, id, fn) {
  for (let i = 0; i < 3; i++) {
    const cur = await vault.Robot.get(ctx, id);
    try { return await vault.Robot.update(ctx, id, fn(cur), { expectedVersion: cur.version }); }
    catch (e) { if (e.code !== 'VERSION_CONFLICT' || i === 2) throw e; }
  }
  return null;
}

const codeOf = e => (e && /^[A-Z][A-Z0-9_]{0,63}$/.test(e.code || '') ? e.code : 'ERROR');

/**
 * Inicia uma rodada: cria a execução (Orchestrator) e registra no robô.
 * @returns {{ execution?, status, error_code? }}
 */
async function startRun({ vault, orchestrator, robot, ctx, trigger, at, idempotencyKey }) {
  const sys = createExecutionContext({ tenantId: robot.tenant_id, actor: SYSTEM });
  let r;
  try {
    r = await orchestrator.start(ctx, { message: robot.task, projectId: robot.project_id, ...(idempotencyKey ? { idempotencyKey } : {}) });
  } catch (e) {
    await patchRobot(vault, sys, robot.id, cur => ({ recent_runs: withRun(cur, { at, trigger, status: 'error', error_code: codeOf(e) }) })).catch(() => {});
    return { status: 'error', error_code: codeOf(e) };
  }
  if (!r.execution) {
    await patchRobot(vault, sys, robot.id, cur => ({ recent_runs: withRun(cur, { at, trigger, status: 'needs_input', error_code: 'NEEDS_INPUT' }) })).catch(() => {});
    return { status: 'needs_input', error_code: 'NEEDS_INPUT' };
  }
  const exe = r.execution;
  await patchRobot(vault, sys, robot.id, cur => ({ last_run_execution_id: exe.id,
    recent_runs: withRun(cur, { at, trigger, status: exe.status, execution_id: exe.id }) })).catch(() => {});
  return { execution: exe, status: exe.status };
}

/** Grava o status final de uma rodada (depois do run). */
async function finishRun({ vault, robot, executionId, status, error_code }) {
  const sys = createExecutionContext({ tenantId: robot.tenant_id, actor: SYSTEM });
  await patchRobot(vault, sys, robot.id, cur => {
    const prev = (cur.recent_runs || []).find(x => x.execution_id === executionId);
    if (!prev) return { last_run_execution_id: executionId };
    return { recent_runs: withRun(cur, { ...prev, status, ...(error_code ? { error_code } : {}) }) };
  }).catch(() => {});
}

/**
 * Tarefa "robots.run" (Actions ou processo Node): até `max` robôs vencidos. Primeiro reivindica e
 * cria as execuções de todos; depois roda uma por vez. Se a tarefa cair no meio, as execuções já
 * criadas ficam "planned" e a retomada de hora em hora (sweep) termina. Devolve só contagens e
 * ids (o log do Actions é público).
 */
async function runDueRobots({ db, vault, orchestrator, now = () => Date.now(), max = MAX_PER_SWEEP }) {
  const due = await findDueRobots(db, now(), { limit: 25 });
  const out = { due: due.length, claimed: 0, started: 0, items: [] };
  const started = [];
  for (const doc of due) {
    if (out.claimed >= max) break;
    const sys = createExecutionContext({ tenantId: doc.tenant_id, actor: SYSTEM });
    const slot = toMs(doc.next_run_at);
    const nowMs = now();
    // Reivindica primeiro: avança a agenda com a versão lida. Outra tarefa que leu a mesma
    // versão recebe VERSION_CONFLICT e pula este robô (nunca roda o mesmo horário duas vezes).
    let robot;
    try {
      robot = await vault.Robot.update(sys, doc.id, {
        next_run_at: new Date(nextRunAt(doc.schedule, doc.timezone || DEFAULT_TZ, nowMs)).toISOString(),
        last_run_at: new Date(nowMs).toISOString(),
      }, { expectedVersion: doc.version });
    } catch (e) {
      out.items.push({ id: doc.id, skipped: codeOf(e) });
      continue;
    }
    out.claimed++;
    const ctx = createExecutionContext({ tenantId: robot.tenant_id, actor: robot.owner });
    // Mesma chave para o mesmo horário: repetição da tarefa não cria outra execução.
    const s = await startRun({ vault, orchestrator, robot, ctx, trigger: 'schedule', at: new Date(nowMs).toISOString(),
      idempotencyKey: `robot:${robot.id}:${slot}` });
    if (s.execution) { out.started++; started.push({ robot, ctx, execution: s.execution }); }
    else out.items.push({ id: robot.id, status: s.status });
  }
  for (const { robot, ctx, execution } of started) {
    let status;
    let error_code;
    try { status = (await orchestrator.run(ctx, execution.id)).status; }
    catch (e) { status = 'error'; error_code = codeOf(e); }
    await finishRun({ vault, robot, executionId: execution.id, status, error_code });
    out.items.push({ id: robot.id, execution: execution.id, status });
  }
  return out;
}

module.exports = { findDueRobots, prepareInput, runDueRobots, startRun, finishRun, withRun, TEMPLATES,
  MAX_PER_SWEEP, MAX_PER_TENANT, SERVER_FIELDS, SYSTEM };
