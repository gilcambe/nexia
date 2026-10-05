'use strict';
// ADR-AUTO-01: Robôs NEXIA — conta da agenda (fusos, horário de verão), validação, tarefa
// robots.run e o Cron do Worker (só dispara quando há robô vencido). Sem Firestore.
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { nextRunAt, scheduleProblem, offsetAt, localToUtc, describeSchedule, TIMEZONES } = require('../../nexia-ai/robots/schedule');
const { prepareInput, withRun, findDueRobots, TEMPLATES } = require('../../nexia-ai/robots');
const { validateJob, scheduledSweep } = require('../../nexia-ai/jobs');
const { SCHEMAS, idPattern } = require('../../nexia-ai/vault/schemas');
const { validateEntity } = require('../../nexia-ai/vault/validate');
const { classifyIntent } = require('../../nexia-ai/orchestrator');

const SP = 'America/Sao_Paulo';
const at = s => Date.parse(s);
const iso = ms => new Date(ms).toISOString();
const next = (s, after, tz = SP) => iso(nextRunAt(s, tz, at(after)));

test('R1. agenda diária, semanal, por hora e a cada N horas em America/Sao_Paulo (UTC−3, sem horário de verão desde 2019)', () => {
  assert.strictEqual(offsetAt(at('2026-10-05T12:00:00Z'), SP), -180);
  assert.strictEqual(next({ kind: 'daily', time: '08:00' }, '2026-10-05T10:59:59Z'), '2026-10-05T11:00:00.000Z');
  assert.strictEqual(next({ kind: 'daily', time: '08:00' }, '2026-10-05T11:00:00Z'), '2026-10-06T11:00:00.000Z', 'estritamente depois');
  assert.strictEqual(next({ kind: 'daily', time: '23:30' }, '2026-10-05T12:00:00Z'), '2026-10-06T02:30:00.000Z', 'vira o dia em UTC');
  assert.strictEqual(next({ kind: 'hourly' }, '2026-10-05T12:00:00Z'), '2026-10-05T13:00:00.000Z');
  assert.strictEqual(next({ kind: 'hourly', minute: 15 }, '2026-10-05T12:20:00Z'), '2026-10-05T13:15:00.000Z');
  // a cada 6 h contadas da meia-noite local: 00:15, 06:15, 12:15, 18:15 (horário de Brasília)
  assert.strictEqual(next({ kind: 'interval', every_hours: 6, minute: 15 }, '2026-10-05T12:00:00Z'), '2026-10-05T15:15:00.000Z');
  assert.strictEqual(next({ kind: 'interval', every_hours: 12 }, '2026-10-05T15:00:00Z'), '2026-10-06T03:00:00.000Z');
  // 2026-10-05 é segunda (1). Só sábado (6) → 2026-10-10; seg/qua às 09:00 depois das 09:00 de segunda → quarta.
  assert.strictEqual(next({ kind: 'weekly', time: '09:00', days: [6] }, '2026-10-05T12:00:00Z'), '2026-10-10T12:00:00.000Z');
  assert.strictEqual(next({ kind: 'weekly', time: '09:00', days: [1, 3] }, '2026-10-05T12:00:00Z'), '2026-10-07T12:00:00.000Z');
  assert.strictEqual(next({ kind: 'weekly', time: '09:00', days: [1] }, '2026-10-05T12:00:00Z'), '2026-10-12T12:00:00.000Z', 'mesmo dia da semana, semana seguinte');
  assert.strictEqual(next({ kind: 'daily', time: '08:00' }, '2026-10-05T11:00:00Z', 'UTC'), '2026-10-06T08:00:00.000Z');
  assert.strictEqual(next({ kind: 'daily', time: '08:00' }, '2026-10-05T11:00:00Z', 'America/Noronha'), '2026-10-06T10:00:00.000Z');
});

test('R2. horário de verão: hora que não existe anda para frente; hora repetida vale a primeira vez (determinístico)', () => {
  // Brasil, 04/11/2018: 00:00 → 01:00 (−03 → −02). 00:30 não existiu.
  assert.strictEqual(next({ kind: 'daily', time: '00:30' }, '2018-11-03T12:00:00Z'), '2018-11-04T03:30:00.000Z');
  assert.strictEqual(next({ kind: 'daily', time: '08:00' }, '2018-11-04T03:30:00Z'), '2018-11-04T10:00:00.000Z', 'depois do salto, UTC−2');
  // Brasil, 17/02/2019: 00:00 → 23:00 do dia 16 (−02 → −03). 23:30 do dia 16 aconteceu duas vezes.
  assert.strictEqual(next({ kind: 'daily', time: '23:30' }, '2019-02-16T12:00:00Z'), '2019-02-17T01:30:00.000Z');
  assert.strictEqual(next({ kind: 'daily', time: '23:30' }, '2019-02-17T01:30:00Z'), '2019-02-18T02:30:00.000Z', 'não roda duas vezes no mesmo dia');
  // Nova York, 08/03/2026: 02:00 → 03:00. De hora em hora: 01:00, 03:00 (02:00 vira 03:00), 04:00 — sem repetir.
  const ny = 'America/New_York';
  const seq = [];
  let t = at('2026-03-08T05:30:00Z');
  for (let i = 0; i < 3; i++) { t = nextRunAt({ kind: 'hourly' }, ny, t); seq.push(iso(t)); }
  assert.deepStrictEqual(seq, ['2026-03-08T06:00:00.000Z', '2026-03-08T07:00:00.000Z', '2026-03-08T08:00:00.000Z']);
  // Nova York, 01/11/2026: 02:00 → 01:00. Diário 01:30 = primeira vez (EDT, 05:30Z).
  assert.strictEqual(next({ kind: 'daily', time: '01:30' }, '2026-10-31T12:00:00Z', ny), '2026-11-01T05:30:00.000Z');
  assert.strictEqual(localToUtc(2026, 11, 1, 1, 30, ny), at('2026-11-01T05:30:00Z'));
  // Mesma entrada, mesma saída (sem relógio).
  assert.strictEqual(next({ kind: 'weekly', time: '07:45', days: [0, 4] }, '2026-12-31T23:59:00Z'), next({ kind: 'weekly', time: '07:45', days: [0, 4] }, '2026-12-31T23:59:00Z'));
});

test('R3. validação estrita da agenda (na conta e no schema do Vault)', () => {
  for (const ok of [{ kind: 'hourly' }, { kind: 'hourly', minute: 59 }, { kind: 'interval', every_hours: 2 }, { kind: 'daily', time: '00:00' },
    { kind: 'weekly', time: '23:59', days: [0, 6] }]) assert.strictEqual(scheduleProblem(ok), null, JSON.stringify(ok));
  const bad = [[null, 'schedule'], [{ kind: 'cron' }, 'kind'], [{ kind: 'daily' }, 'time'], [{ kind: 'daily', time: '24:00' }, 'time'],
    [{ kind: 'daily', time: '8:00' }, 'time'], [{ kind: 'daily', time: '08:00', days: [1] }, 'extra:days'], [{ kind: 'hourly', minute: 60 }, 'minute'],
    [{ kind: 'interval', every_hours: 5 }, 'every_hours'], [{ kind: 'interval', every_hours: 1 }, 'every_hours'],
    [{ kind: 'weekly', time: '09:00', days: [] }, 'days'], [{ kind: 'weekly', time: '09:00', days: [1, 1] }, 'days'],
    [{ kind: 'weekly', time: '09:00', days: [7] }, 'days'], [{ kind: 'weekly', time: '09:00' }, 'days']];
  for (const [s, code] of bad) assert.strictEqual(scheduleProblem(s), code, JSON.stringify(s));
  assert.throws(() => nextRunAt({ kind: 'daily' }, SP, Date.now()), /Agendamento inválido/);
  assert.strictEqual(describeSchedule({ kind: 'weekly', time: '09:00', days: [5, 1] }), 'seg, sex às 09:00');
  assert.ok(TIMEZONES.includes(SP));

  const ids = { Project: `prj_${crypto.randomBytes(16).toString('hex')}` };
  const v = data => validateEntity(SCHEMAS.Robot, data, { refPattern: idPattern });
  const base = { project_id: ids.Project, name: 'Vigia', task: 'Confira o site', schedule: { kind: 'daily', time: '07:00' }, enabled: true,
    owner: { type: 'user', id: 'u1' }, next_run_at: '2026-10-06T10:00:00.000Z' };
  assert.deepStrictEqual(v(base).issues, []);
  assert.strictEqual(v(base).value.timezone, SP, 'fuso padrão');
  assert.ok(v({ ...base, schedule: { kind: 'daily', time: '07:00', days: [1] } }).issues.some(i => i.rule === 'schedule_shape'));
  assert.ok(v({ ...base, schedule: { kind: 'daily', time: '7h' } }).issues.some(i => i.rule === 'pattern:hh_mm'));
  assert.ok(v({ ...base, schedule: { kind: 'daily', time: '07:00', cron: '* * * * *' } }).issues.some(i => i.rule === 'unknownField'));
  assert.ok(v({ ...base, timezone: 'Europe/Lisbon' }).issues.some(i => i.rule === 'enum'));
  assert.ok(v({ ...base, enabled: false }).issues.some(i => i.rule === 'disabled_without_next_run_at'));
  assert.ok(v({ ...base, next_run_at: undefined }).issues.some(i => i.rule === 'enabled_requires_next_run_at'));
});

test('R4. entrada da tela: campos do servidor saem; next_run_at recalculado só quando agenda/fuso/ligado mudam', () => {
  const now = at('2026-10-05T12:00:00Z');
  const body = { name: 'X', task: 't', schedule: { kind: 'daily', time: '08:00' }, enabled: true, owner: { type: 'user', id: 'intruso' },
    next_run_at: '2020-01-01T00:00:00Z', last_run_at: 'x', recent_runs: [], last_run_execution_id: 'exe_x' };
  const created = prepareInput(body, null, now);
  assert.deepStrictEqual(Object.keys(created).sort(), ['enabled', 'name', 'next_run_at', 'schedule', 'task']);
  assert.strictEqual(created.next_run_at, '2026-10-06T11:00:00.000Z');
  assert.strictEqual(prepareInput({ ...body, enabled: false }, null, now).next_run_at, undefined);
  const current = { ...created, version: 3, timezone: SP };
  assert.deepStrictEqual(prepareInput({ name: 'Y' }, current, now), { name: 'Y' }, 'só o nome: agenda intacta');
  assert.deepStrictEqual(prepareInput({ enabled: false }, current, now), { enabled: false, next_run_at: null });
  assert.strictEqual(prepareInput({ schedule: { kind: 'hourly' } }, current, now).next_run_at, '2026-10-05T13:00:00.000Z');
  // agenda inválida: não inventa horário (o schema aponta o erro)
  assert.strictEqual(prepareInput({ schedule: { kind: 'daily' } }, current, now).next_run_at, null);
  const runs = Array.from({ length: 10 }, (_, i) => ({ at: 'x', trigger: 'schedule', status: 'succeeded', execution_id: `exe_${String(i).repeat(32)}` }));
  const w = withRun({ recent_runs: runs }, { at: 'y', trigger: 'manual', status: 'planned', execution_id: 'exe_' + 'f'.repeat(32) });
  assert.deepStrictEqual([w.length, w[0].trigger, w[9].execution_id], [10, 'manual', runs[8].execution_id]);
  assert.strictEqual(withRun({ recent_runs: w }, { ...w[0], status: 'succeeded' }).filter(r => r.execution_id === w[0].execution_id).length, 1);
});

test('R5. modelos prontos: vigia, revisor e relatório; agenda válida; revisor e relatório só leem', () => {
  assert.deepStrictEqual(TEMPLATES.map(t => t.name), ['Vigia do site', 'Revisor de PRs', 'Relatório diário']);
  for (const t of TEMPLATES) assert.strictEqual(scheduleProblem(t.schedule), null, t.id);
  const intent = Object.fromEntries(TEMPLATES.map(t => [t.id, classifyIntent(t.task)]));
  assert.deepStrictEqual(intent, { site_watch: 'change', pr_review: 'status', daily_report: 'status' });
  assert.ok(!Object.values(intent).some(i => i.startsWith('deploy')), 'nenhum modelo pede deploy');
});

test('R6. tarefa robots.run: só o tipo, sem tenant, ator nem ids (log público do Actions)', () => {
  assert.deepStrictEqual(validateJob({ kind: 'robots.run' }), { kind: 'robots.run' });
  for (const bad of [{ kind: 'robots.run', tenant: 'ces', actor: { type: 'user', id: 'u' } }, { kind: 'robots.run', id: 'rbt_' + 'a'.repeat(32) },
    { kind: 'robots.run', ctx_id: 'exec_' + 'a'.repeat(32) }, { kind: 'robots.run', tenant: 'ces' }, { kind: 'robot.run' }]) {
    assert.throws(() => validateJob(bad), e => e.code === 'INVALID_JOB', JSON.stringify(bad));
  }
});

/** Banco falso: guarda as consultas feitas e devolve linhas por coleção. */
function fakeDb(rowsByCol) {
  const queries = [];
  return { queries, collection: name => {
    const st = { name, ops: [] };
    const q = {
      where: (...a) => { st.ops.push(['where', ...a]); return q; }, orderBy: (...a) => { st.ops.push(['orderBy', ...a]); return q; },
      limit: n => { st.ops.push(['limit', n]); return q; }, select: (...a) => { st.ops.push(['select', ...a]); return q; },
      get: async () => { queries.push(st); return { docs: (rowsByCol[name] || []).map(r => ({ data: () => r })) }; },
    };
    return q;
  } };
}

test('R7. Cron (a cada 5 min): uma consulta de robôs; dispara UMA tarefa só quando há robô vencido e ligado', async () => {
  const now = at('2026-10-05T12:35:00Z');
  const sent = [];
  const jobs = { enabled: true, dispatch: async j => { sent.push(j); return { queued: true }; } };
  const empty = fakeDb({});
  assert.deepStrictEqual(await scheduledSweep({ db: empty, jobs, now: () => now }), { robots: 0 });
  assert.deepStrictEqual(sent, [], 'nada vencido: nenhum minuto do Actions');
  assert.strictEqual(empty.queries.length, 1, 'fora do tique da hora, só a consulta de robôs');
  const q = empty.queries[0];
  assert.strictEqual(q.name, 'vault_robots');
  assert.deepStrictEqual(q.ops.find(o => o[0] === 'where').slice(1, 3), ['next_run_at', '<=']);
  assert.strictEqual(q.ops.find(o => o[0] === 'where')[3].getTime(), now);
  assert.ok(q.ops.some(o => o[0] === 'select'), 'Worker lê só campos de controle');
  // desligado e excluído não contam (não deveriam ter next_run_at, mas o filtro protege)
  const off = fakeDb({ vault_robots: [{ enabled: false }, { enabled: true, deleted_at: '2026-10-01T00:00:00Z' }] });
  assert.deepStrictEqual(await scheduledSweep({ db: off, jobs, now: () => now }), { robots: 0 });
  assert.deepStrictEqual(sent, []);
  const due = fakeDb({ vault_robots: [{ enabled: true, deleted_at: null }, { enabled: true }] });
  assert.deepStrictEqual(await scheduledSweep({ db: due, jobs, now: () => now }), { robots: 2, robots_queued: true });
  assert.deepStrictEqual(sent, [{ kind: 'robots.run' }], 'uma tarefa para todos, só com o tipo');
  // Falha na fila não derruba a retomada de execuções no tique da hora.
  const failing = { enabled: true, dispatch: async j => { if (j.kind === 'robots.run') throw Object.assign(new Error('x'), { code: 'DISPATCH_FAILED' }); return { queued: true }; } };
  const r = await scheduledSweep({ db: fakeDb({ vault_robots: [{ enabled: true }], vault_executions: [] }), jobs: failing, now: () => at('2026-10-05T13:00:00Z') });
  assert.deepStrictEqual(r, { robots: 1, robots_error: 'DISPATCH_FAILED', stale: 0 });
  // findDueRobots (tarefa no Actions): sem select, com ordenação pelo mais atrasado
  const db2 = fakeDb({ vault_robots: [{ id: 'a', enabled: true }] });
  assert.deepStrictEqual(await findDueRobots(db2, now), [{ id: 'a', enabled: true }]);
  assert.deepStrictEqual(db2.queries[0].ops.find(o => o[0] === 'orderBy'), ['orderBy', 'next_run_at', 'asc']);
  assert.ok(!db2.queries[0].ops.some(o => o[0] === 'select'));
});
