'use strict';
/**
 * Health Watcher — monitora /health da API e faz polling a cada minuto.
 * Após 2 falhas consecutivas, dispara alerta por e-mail (Brevo) e registra na Central.
 */
const fetch = require('node-fetch');
const brevoClient = require('../notification/brevoClient');

const INTERVAL_MS = 60 * 1000; // 1 minuto
const MAX_CONSECUTIVE_FAILURES = 2;

let consecutiveFailures = 0;
let alerted = false; // evita re-alerta contínuo enquanto fica down

function nowIso() { return new Date().toISOString(); }

function registerCentralEvent(event) {
  // Registro na Central de monitoramento (log estruturado)
  console.log(`[CENTRAL] ${event.type} | ${event.service} | ${event.message} | ${event.timestamp}`);
}

async function checkHealth() {
  const appUrl = process.env.NEXIA_APP_URL || process.env.HEALTH_URL;
  if (!appUrl) {
    consecutiveFailures = 0;
    alerted = false;
    return;
  }
  const healthUrl = appUrl.endsWith('/health')
    ? appUrl
    : appUrl.replace(/\/$/, '') + '/health';

  let ok = false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(timeout);
    ok = res.ok;
  } catch (e) {
    ok = false;
  }

  if (ok) {
    if (consecutiveFailures > 0) {
      registerCentralEvent({
        type: 'RECUPERADO',
        service: 'health',
        message: `Endpoint ${healthUrl} voltou a responder com sucesso`,
        timestamp: nowIso(),
      });
    }
    consecutiveFailures = 0;
    alerted = false;
    return;
  }

  consecutiveFailures++;
  registerCentralEvent({
    type: 'FALHA',
    service: 'health',
    message: `Endpoint ${healthUrl} falhou (falha consecutiva ${consecutiveFailures})`,
    timestamp: nowIso(),
  });

  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && !alerted) {
    alerted = true;
    try {
      await brevoClient.sendEmail({
        to: process.env.ALERT_EMAIL || process.env.NEXIA_ALERT_EMAIL,
        subject: 'Alerta NEXIA: endpoint /health fora do ar',
        text: `O endpoint ${healthUrl} falhou ${consecutiveFailures} vezes consecutivas. Verifique a API e o aplicativo Body Coach.`,
        html: `<p>O endpoint <b>${healthUrl}</b> falhou <b>${consecutiveFailures}</b> vezes consecutivas.</p><p>Verifique a API e o aplicativo Body Coach.</p>`,
      });
      registerCentralEvent({
        type: 'ALERTA_ENVIADO',
        service: 'health',
        message: `Alerta por e-mail enviado para ${process.env.ALERT_EMAIL || process.env.NEXIA_ALERT_EMAIL}`,
        timestamp: nowIso(),
      });
    } catch (e) {
      console.error('[BREVO] Falha ao enviar alerta:', e.message);
    }
  }
}

function startHealthWatcher() {
  checkHealth(); // checagem imediata ao iniciar
  const timer = setInterval(checkHealth, INTERVAL_MS);
  timer.unref();
  console.log('[HEALTH WATCHER] Ativo — polling a cada 1 minuto, alerta após', MAX_CONSECUTIVE_FAILURES, 'falhas consecutivas');
}

module.exports = { startHealthWatcher, checkHealth };
