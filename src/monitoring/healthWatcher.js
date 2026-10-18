// Watcher de saúde: faz polling a cada minuto no endpoint /health da API
// e no aplicativo Body Coach, contando falhas consecutivas. Após duas falhas
// seguidas, dispara alerta por e-mail (Brevo) e registra o evento na Central.
import { sendBrevoEmail } from '../notification/brevoClient.js';

const TARGETS = [
  { name: 'API /health', url: `${process.env.NEXIA_APP_URL || 'http://localhost:8787'}/health` },
  { name: 'Body Coach', url: process.env.BODY_COACH_URL || 'https://app.bodycoach.example.com' },
];

const MAX_CONSECUTIVE_FAILURES = 2;
let consecutiveFailures = 0;
let alertSent = false; // evita alerta repetido enquanto estiver fora

// Registro na Central de monitoramento (memória).
// Em produção substituir por gravação no Firestore/D1.
const centralEvents = [];
export function getCentralEvents() {
  return centralEvents;
}
export function getConsecutiveFailures() {
  return consecutiveFailures;
}

function registerEvent(target, status, detail) {
  centralEvents.push({
    at: new Date().toISOString(),
    target: target.name,
    status,
    detail,
  });
  if (centralEvents.length > 1000) centralEvents.shift();
}

async function checkTarget(target) {
  try {
    const response = await fetch(target.url, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    registerEvent(target, 'ok', `status ${response.status}`);
    return true;
  } catch (error) {
    registerEvent(target, 'fail', error.message);
    return false;
  }
}

export async function runHealthCheck() {
  const results = await Promise.all(TARGETS.map(checkTarget));
  const allOk = results.every(Boolean);

  if (allOk) {
    consecutiveFailures = 0;
    alertSent = false;
    return { ok: true, consecutiveFailures: 0 };
  }

  consecutiveFailures += 1;
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && !alertSent) {
    alertSent = true;
    const failing = TARGETS.map((t, i) => ({ ...t, ok: results[i] }))
      .filter((r) => !r.ok)
      .map((r) => `- ${r.name}: ${r.url}`)
      .join('\n');
    try {
      await sendBrevoEmail({
        to: process.env.ALERT_EMAIL || 'time@nexia.ai',
        subject: '[NEXIA] Alerta de queda — monitoramento automático',
        text: `Falha detectada por ${consecutiveFailures} verificação(ões) consecutiva(s):\n\n${failing}\n\nEvento registrado na Central de monitoramento.`,
        html: `<p>Falha detectada por <strong>${consecutiveFailures}</strong> verificação(ões) consecutiva(s):</p><ul>${failing.split('\n').map((l) => `<li>${l}</li>`).join('')}</ul><p>Evento registrado na Central de monitoramento.</p>`,
      });
    } catch (emailError) {
      registerEvent({ name: 'Brevo', url: '' }, 'fail', `e-mail: ${emailError.message}`);
    }
  }

  return { ok: false, consecutiveFailures };
}

export function startHealthWatcher(intervalMs = 60000) {
  runHealthCheck();
  return setInterval(runHealthCheck, intervalMs);
}
