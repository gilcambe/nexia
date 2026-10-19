'use strict';
/**
 * Health Watcher — Monitora endpoints críticos e dispara alertas
 * Polling a cada minuto, alerta após 2 falhas consecutivas
 */

const https = require('https');
const http = require('http');
const { sendAlertEmail } = require('../notification/brevoClient');

const HEALTH_ENDPOINT = process.env.HEALTH_ENDPOINT || 'http://localhost:3001/health';
const BODY_COACH_URL = process.env.BODY_COACH_URL || 'http://localhost:3001/body-coach';
const POLL_INTERVAL_MS = 60 * 1000; // 1 minuto
const MAX_CONSECUTIVE_FAILURES = 2;

let consecutiveFailures = 0;
let watcherInterval = null;
let isAlertSent = false;

/**
 * Faz uma requisição HTTP/HTTPS e retorna true se status 200
 */
function checkEndpoint(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        const ok = res.statusCode === 200;
        if (ok) {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.status === 'ok');
          } catch {
            resolve(true); // 200 OK mesmo sem JSON válido
          }
        } else {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Verifica ambos os endpoints
 */
async function runHealthCheck() {
  const [apiOk, bodyCoachOk] = await Promise.all([
    checkEndpoint(HEALTH_ENDPOINT),
    checkEndpoint(BODY_COACH_URL),
  ]);

  const allOk = apiOk && bodyCoachOk;

  if (allOk) {
    consecutiveFailures = 0;
    isAlertSent = false;
    console.log('[HealthWatcher] ✓ API e Body Coach OK');
  } else {
    consecutiveFailures++;
    console.warn(`[HealthWatcher] ✗ Falha ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES} — API: ${apiOk ? 'OK' : 'FALHOU'}, Body Coach: ${bodyCoachOk ? 'OK' : 'FALHOU'}`);

    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && !isAlertSent) {
      await triggerAlert(apiOk, bodyCoachOk);
      isAlertSent = true;
    }
  }
}

/**
 * Dispara alerta por e-mail e registra na Central
 */
async function triggerAlert(apiOk, bodyCoachOk) {
  const timestamp = new Date().toISOString();
  const details = {
    timestamp,
    apiHealth: apiOk ? 'ok' : 'failed',
    bodyCoach: bodyCoachOk ? 'ok' : 'failed',
    consecutiveFailures,
  };

  console.error('[HealthWatcher] ALERTA: Falhas consecutivas detectadas', details);

  // Envia e-mail via Brevo
  try {
    await sendAlertEmail({
      subject: '🚨 NEXIA Health Alert: Falhas consecutivas detectadas',
      html: `
        <h2>Alerta de Monitoramento NEXIA</h2>
        <p><strong>Timestamp:</strong> ${timestamp}</p>
        <p><strong>Endpoint /health:</strong> ${apiOk ? '✅ OK' : '❌ FALHOU'}</p>
        <p><strong>Body Coach:</strong> ${bodyCoachOk ? '✅ OK' : '❌ FALHOU'}</p>
        <p><strong>Falhas consecutivas:</strong> ${consecutiveFailures}</p>
        <hr>
        <p>Este alerta foi disparado automaticamente após ${MAX_CONSECUTIVE_FAILURES} falhas consecutivas.</p>
      `,
      text: `Alerta NEXIA
Timestamp: ${timestamp}
/health: ${apiOk ? 'OK' : 'FALHOU'}
Body Coach: ${bodyCoachOk ? 'OK' : 'FALHOU'}
Falhas consecutivas: ${consecutiveFailures}

Este alerta foi disparado automaticamente após ${MAX_CONSECUTIVE_FAILURES} falhas consecutivas.`
    });
    console.log('[HealthWatcher] E-mail de alerta enviado via Brevo');
  } catch (err) {
    console.error('[HealthWatcher] Falha ao enviar e-mail de alerta:', err.message);
  }

  // Registra na Central de monitoramento (log local por enquanto)
  // TODO: integrar com Central real quando disponível
  logToCentral(details);
}

/**
 * Registra evento na Central de monitoramento real
 * Envia evento para a Central de monitoramento via API
 */
async function logToCentral(details) {
  const https = require('https');
  const CENTRAL_API_URL = process.env.CENTRAL_API_URL || 'https://api.nexia.app/monitoring/log';
  const CENTRAL_API_KEY = process.env.CENTRAL_API_KEY;

  if (!CENTRAL_API_KEY) {
    console.warn('[HealthWatcher] CENTRAL_API_KEY não definida, fallback para log local');
    return logToCentralFallback(details);
  }

  const payload = JSON.stringify({
    service: 'nexia-health-monitor',
    level: 'error',
    message: 'Falhas consecutivas detectadas no monitoramento',
    details,
    timestamp: details.timestamp,
  });

  return new Promise((resolve, reject) => {
    const req = https.request(CENTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CENTRAL_API_KEY}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('[HealthWatcher] Evento registrado na Central de monitoramento');
          resolve({ status: res.statusCode, body: data });
        } else {
          console.error(`[HealthWatcher] Falha ao registrar na Central: ${res.statusCode} - ${data}`);
          logToCentralFallback(details);
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => {
      console.error('[HealthWatcher] Falha de rede ao registrar na Central:', err.message);
      logToCentralFallback(details);
      resolve({ status: 500, error: err.message });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      console.error('[HealthWatcher] Timeout ao registrar na Central');
      logToCentralFallback(details);
      resolve({ status: 408, error: 'Timeout' });
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Fallback para log local quando Central não está disponível
 */
function logToCentralFallback(details) {
  const fs = require('fs');
  const path = require('path');
  const logDir = path.join(__dirname, '..', '..', 'logs');
  const logFile = path.join(logDir, 'health-alerts.log');

  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(logFile, JSON.stringify({
      ...details,
      fallback: true,
      timestamp: new Date().toISOString(),
    }) + '\n');
    console.log('[HealthWatcher] Evento salvo em log local (fallback)');
  } catch (err) {
    console.error('[HealthWatcher] Falha ao gravar log fallback:', err.message);
  }
}

/**
 * Inicia o watcher
 */
function startHealthWatcher() {
  if (watcherInterval) {
    console.warn('[HealthWatcher] Já está rodando');
    return;
  }

  console.log('[HealthWatcher] Iniciando monitoramento...');
  console.log('[HealthWatcher] Endpoints:', { HEALTH_ENDPOINT, BODY_COACH_URL });
  console.log('[HealthWatcher] Intervalo:', POLL_INTERVAL_MS / 1000, 'segundos');
  console.log('[HealthWatcher] Limite de falhas:', MAX_CONSECUTIVE_FAILURES);

  // Executa verificação imediata
  runHealthCheck();

  // Agenda verificações periódicas
  watcherInterval = setInterval(runHealthCheck, POLL_INTERVAL_MS);
  watcherInterval.unref(); // Não impede o processo de sair
}

/**
 * Para o watcher (útil para testes)
 */
function stopHealthWatcher() {
  if (watcherInterval) {
    clearInterval(watcherInterval);
    watcherInterval = null;
    console.log('[HealthWatcher] Parado');
  }
}

module.exports = {
  startHealthWatcher,
  stopHealthWatcher,
  runHealthCheck,
  // Para testes
  __internals: {
    checkEndpoint,
    triggerAlert,
    logToCentral,
  },
};
