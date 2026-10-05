'use strict';
// ADR-AUTO-01: agenda dos Robôs NEXIA. Horário de parede no fuso do robô (padrão
// America/Sao_Paulo), convertido para UTC pelo Intl (sem tabela própria de fusos).
// Determinístico: o mesmo agendamento e o mesmo instante dão sempre o mesmo próximo horário.
//   hourly   → toda hora no minuto `minute` (padrão 0)
//   interval → a cada `every_hours` horas (divisor de 24, contado da meia-noite local), no minuto `minute`
//   daily    → todo dia às `time` (HH:MM)
//   weekly   → nos `days` (0 = domingo … 6 = sábado) às `time`
// Horário que não existe (início de horário de verão) anda para frente o tamanho do salto;
// horário repetido (fim do horário de verão) vale a primeira vez.

const KINDS = ['hourly', 'interval', 'daily', 'weekly'];
const EVERY_HOURS = [2, 3, 4, 6, 8, 12];
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
// Fusos do Brasil + UTC. A conta aceita qualquer fuso IANA (testes usam outros com horário de verão).
const TIMEZONES = ['America/Sao_Paulo', 'America/Bahia', 'America/Fortaleza', 'America/Recife', 'America/Belem', 'America/Manaus',
  'America/Cuiaba', 'America/Campo_Grande', 'America/Porto_Velho', 'America/Boa_Vista', 'America/Rio_Branco', 'America/Noronha', 'UTC'];
const DEFAULT_TZ = 'America/Sao_Paulo';
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const ALLOWED = { hourly: ['kind', 'minute'], interval: ['kind', 'every_hours', 'minute'], daily: ['kind', 'time'], weekly: ['kind', 'time', 'days'] };

/** Primeiro problema do agendamento (código curto) ou null. Estrito: campo de outro tipo é erro. */
function scheduleProblem(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return 'schedule';
  if (!KINDS.includes(s.kind)) return 'kind';
  const extra = Object.keys(s).filter(k => s[k] !== undefined && s[k] !== null && !ALLOWED[s.kind].includes(k));
  if (extra.length) return `extra:${extra[0]}`;
  const okMinute = m => m === undefined || m === null || (Number.isInteger(m) && m >= 0 && m <= 59);
  if (!okMinute(s.minute)) return 'minute';
  if (s.kind === 'interval' && !EVERY_HOURS.includes(s.every_hours)) return 'every_hours';
  if ((s.kind === 'daily' || s.kind === 'weekly') && !(typeof s.time === 'string' && TIME_RE.test(s.time))) return 'time';
  if (s.kind === 'weekly') {
    const d = s.days;
    if (!Array.isArray(d) || !d.length || d.length > 7 || new Set(d).size !== d.length || !d.every(x => Number.isInteger(x) && x >= 0 && x <= 6)) return 'days';
  }
  return null;
}

const fmtCache = new Map();
function formatter(tz) {
  if (!fmtCache.has(tz)) {
    fmtCache.set(tz, new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }));
  }
  return fmtCache.get(tz);
}

/** Diferença local − UTC (minutos) no instante `ms`, no fuso `tz`. */
function offsetAt(ms, tz) {
  const p = Object.fromEntries(formatter(tz).formatToParts(new Date(ms)).filter(x => x.type !== 'literal').map(x => [x.type, Number(x.value)]));
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / MIN);
}

/**
 * Horário de parede (y, m 1–12, d, h, min) no fuso → instante UTC (ms).
 * Testa os dois deslocamentos de ±24 h (cobre uma transição); repetido → o mais cedo; inexistente → anda para frente.
 */
function localToUtc(y, mo, d, h, mi, tz) {
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const before = offsetAt(wall - DAY, tz);
  const after = offsetAt(wall + DAY, tz);
  const ok = [...new Set([before, after])].map(o => wall - o * MIN).filter(t => wall - offsetAt(t, tz) * MIN === t);
  if (ok.length) return Math.min(...ok);
  return wall - before * MIN;
}

/** Data local (ano, mês, dia) do instante `ms` no fuso. */
function localDate(ms, tz) {
  const l = new Date(ms + offsetAt(ms, tz) * MIN);
  return { y: l.getUTCFullYear(), m: l.getUTCMonth() + 1, d: l.getUTCDate() };
}

/** Horários (h, min) de um dia local, conforme o tipo. */
function slots(s) {
  const minute = Number.isInteger(s.minute) ? s.minute : 0;
  if (s.kind === 'hourly') return Array.from({ length: 24 }, (_, h) => [h, minute]);
  if (s.kind === 'interval') return Array.from({ length: 24 / s.every_hours }, (_, i) => [i * s.every_hours, minute]);
  const [, hh, mm] = TIME_RE.exec(s.time);
  return [[Number(hh), Number(mm)]];
}

/**
 * Próximo horário estritamente depois de `afterMs` (ms UTC). Lança erro se o agendamento é inválido.
 * @returns {number} ms UTC
 */
function nextRunAt(schedule, tz = DEFAULT_TZ, afterMs = Date.now()) {
  const bad = scheduleProblem(schedule);
  if (bad) throw new Error(`Agendamento inválido (${bad}).`);
  if (!Number.isFinite(afterMs)) throw new Error('Instante inválido.');
  const start = localDate(afterMs, tz);
  let best = Infinity;
  // 9 dias locais cobrem a semana inteira mesmo com um só dia marcado.
  for (let i = -1; i <= 8 && best === Infinity; i++) {
    const day = new Date(Date.UTC(start.y, start.m - 1, start.d + i));
    if (schedule.kind === 'weekly' && !schedule.days.includes(day.getUTCDay())) continue;
    for (const [h, mi] of slots(schedule)) {
      const t = localToUtc(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), h, mi, tz);
      if (t > afterMs && t < best) best = t;
    }
  }
  return best;
}

const DAY_NAMES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
/** Texto curto em português para a tela e o log. */
function describeSchedule(s) {
  if (scheduleProblem(s)) return 'agendamento inválido';
  const mm = String(Number.isInteger(s.minute) ? s.minute : 0).padStart(2, '0');
  if (s.kind === 'hourly') return `a cada hora (minuto ${mm})`;
  if (s.kind === 'interval') return `a cada ${s.every_hours} horas (minuto ${mm})`;
  if (s.kind === 'daily') return `todo dia às ${s.time}`;
  return `${[...s.days].sort().map(d => DAY_NAMES[d]).join(', ')} às ${s.time}`;
}

module.exports = { KINDS, EVERY_HOURS, TIMEZONES, DEFAULT_TZ, scheduleProblem, nextRunAt, offsetAt, localToUtc, describeSchedule };
