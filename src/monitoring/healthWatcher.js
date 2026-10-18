import { enviarEmailBrevo } from '../notification/brevoClient.js';

const ENDPOINTS = [
  { nome: 'API /health', url: process.env.HEALTH_URL || 'http://localhost:8787/health' },
  { nome: 'Body Coach', url: process.env.BODYCOACH_URL || 'https://bodycoach.nexia.app' },
];

const FALHAS_LIMITE = 2;
const falhasConsecutivas = {};

for (const ep of ENDPOINTS) {
  falhasConsecutivas[ep.nome] = 0;
}

/**
 * Inicia o watcher de saúde: faz polling a cada minuto,
 * conta falhas consecutivas e dispara alerta ao atingir o limite.
 * @param {number} intervaloMs intervalo entre polls (padrão: 60s)
 */
export function iniciarHealthWatcher(intervaloMs = 60 * 1000) {
  setInterval(async () => {
    for (const ep of ENDPOINTS) {
      try {
        const resposta = await fetch(ep.url, {
          method: 'GET',
          signal: AbortSignal.timeout(10000),
        });
        if (resposta.ok) {
          falhasConsecutivas[ep.nome] = 0;
        } else {
          registrarFalha(ep, `HTTP ${resposta.status}`);
        }
      } catch (erro) {
        registrarFalha(ep, erro.message);
      }
    }
  }, intervaloMs);
}

async function registrarFalha(endpoint, motivo) {
  falhasConsecutivas[endpoint.nome] += 1;
  console.warn(
    `[HealthWatcher] Falha em ${endpoint.nome}: ${motivo} (`
    + `${falhasConsecutivas[endpoint.nome]}/${FALHAS_LIMITE})`,
  );

  if (falhasConsecutivas[endpoint.nome] >= FALHAS_LIMITE) {
    await dispararAlerta(endpoint, motivo);
  }
}

async function dispararAlerta(endpoint, motivo) {
  const assunto = `Alerta de queda: ${endpoint.nome}`;
  const conteudoHtml = `
    <p>O endpoint <strong>${endpoint.nome}</strong> (${endpoint.url}) falhou.</p>
    <p>Motivo: ${motivo}</p>
    <p>Evento registrado na Central de monitoramento.</p>
  `;

  try {
    await enviarEmailBrevo({
      destinatario: process.env.ALERT_EMAIL || 'monitoramento@seudominio.com',
      assunto,
      conteudoHtml,
    });
  } catch (erro) {
    console.error('[HealthWatcher] Erro ao enviar e-mail de alerta:', erro.message);
  }

  registrarCentral(endpoint, motivo);
}

function registrarCentral(endpoint, motivo) {
  const evento = {
    timestamp: new Date().toISOString(),
    endpoint: endpoint.nome,
    url: endpoint.url,
    tipo: 'ALERTA_QUEDA',
    motivo,
  };
  console.log('[Central de monitoramento]', JSON.stringify(evento));
  // Persistir em Firestore/D1 quando a integração estiver disponível.
}
