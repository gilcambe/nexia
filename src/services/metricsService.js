/**
 * metricsService.js
 * Serviço de métricas do Cortex.
 * Expõe funções para obter estado do sistema usando fontes de dados existentes:
 * logs, banco e filas.
 * Todas as funções retornam promises. Valores de fallback são usados quando
 * a fonte não está disponível (sem quebrar a aplicação).
 */

const API_BASE = window.location.origin;

/** Faz fetch com timeout e trata erro de rede graceful. */
async function fetchJson(path, opts = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Agora em ISO string. */
function agora() {
  return new Date().toISOString();
}

/** Há uma hora atrás em ISO string. */
function umaHoraAtras() {
  return new Date(Date.now() - 60 * 60 * 1000).toISOString();
}

/** Agora menos 60 segundos em ISO string. */
function umMinutoAtras() {
  return new Date(Date.now() - 60 * 1000).toISOString();
}

/** Início de hoje (00:00) em ISO string. */
function inicioHoje() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Tenta ler do Firestore via endpoint /api/logs (ou similar existente). */
async function lerLogs(caminho) {
  return await fetchJson(caminho) || [];
}

/** ------------------------------------------------------------------ */

/**
 * 1. Estado do Cortex (online/offline/degradado).
 * Fonte: endpoint /api/cortex ou /api/logs.
 * @returns {Promise<{estado: string, ultimaAtualizacao: string}>
 */
async function estadoCortex() {
  const dados = await lerLogs('/api/cortex') || await lerLogs('/api/logs');
  const agoraTs = Date.now();
  let online = false;
  let ultima = agora();
  if (dados && Array.isArray(dados) && dados.length > 0) {
    const item = dados[dados.length - 1];
    ultima = item.timestamp || item.hora || item.atualizado_em || agora();
    const diff = Math.abs(agoraTs - new Date(ultima).getTime());
    online = diff <= 10 * 60 * 1000; // 10 minutos
  }
  const estado = online ? 'online' : (dados ? 'degradado' : 'offline');
  return { estado, ultimaAtualizacao: ultima };
}

/**
 * 2. Tempo médio de resposta na última hora (ms).
 * Fonte: logs de requisições nos últimos 60 minutos.
 * @returns {Promise<number>} tempo médio em ms.
 */
async function tempoMedioRespostaUltimaHora() {
  const logs = await lerLogs('/api/logs') || [];
  const corte = new Date(umaHoraAtras()).getTime();
  const tempos = logs
    .filter((l) => {
      const t = l.timestamp || l.hora || l.created_at;
      return t && new Date(t).getTime() >= corte;
    })
    .map((l) => l.tempo_resposta || l.latency || l.duration_ms || l.tempo || 0)
    .filter((t) => typeof t === 'number' && t > 0);
  if (tempos.length === 0) return 0;
  const soma = tempos.reduce((a, b) => a + b, 0);
  return Math.round(soma / tempos.length);
}

/**
 * 3. Status das IAs (verde / amarelo / vermelho).
 * Fonte: /api/models ou /api/agents (provedores de IA).
 * Retorna objeto por provedor e status geral.
 * @returns {Promise<{geral: string, provedores: Record<string,string>}>
 */
async function statusIAS() {
  const provedores = {};
  let falhas = 0;
  let total = 0;
  const fontes = ['/api/models', '/api/agents', '/api/ia-status'];
  for (const fonte of fontes) {
    const dados = await lerLogs(fonte);
    if (!dados) continue;
    const lista = Array.isArray(dados) ? dados : dados.provedores || dados.models || [];
    for (const p of lista) {
      const nome = p.nome || p.provider || p.id || 'desconhecido';
      let status = 'vermelho';
      if (p.status === 'ok' || p.status === 'ativo' || p.saudavel) status = 'verde';
      else if (p.status === 'lento' || p.degradado || p.rate_limited) status = 'amarelo';
      else if (p.tempo_resposta && p.tempo_resposta > 5000) status = 'amarelo';
      provedores[nome] = status;
      total++;
      if (status === 'vermelho') falhas++;
    }
  }
  let geral = 'vermelho';
  if (total === 0) geral = 'vermelho';
  else if (falhas === 0) geral = 'verde';
  else if (falhas < total / 2) geral = 'amarelo';
  return { geral, provedores };
}

/**
 * 4. Cota usada por provedor hoje.
 * Fonte: /api/usage ou /api/billing (uso por provedor no dia).
 * @returns {Promise<Record<string, {usado: number, limite: number, percentual: number}>>}
 */
async function cotaUsadaPorProvedor() {
  const dados = await lerLogs('/api/usage') || await lerLogs('/api/billing') || {};
  const resultado = {};
  const lista = Array.isArray(dados) ? dados : (dados.provedores || dados.cotas || []);
  for (const item of lista) {
    const nome = item.provedor || item.provider || item.nome || 'desconhecido';
    const usado = Number(item.usado || item.used || 0);
    const limite = Number(item.limite || item.limit || 0);
    const percentual = limite > 0 ? Math.round((usado / limite) * 100) : 0;
    resultado[nome] = { usado, limite, percentual };
  }
  return resultado;
}

/**
 * 5. Mensagens por minuto (último minuto).
 * Fonte: /api/events ou /api/logs filtrando eventos de mensagem.
 * @returns {Promise<number>} quantidade de mensagens no último minuto.
 */
async function mensagensPorMinuto() {
  const logs = await lerLogs('/api/events') || await lerLogs('/api/logs') || [];
  const corte = new Date(umMinutoAtras()).getTime();
  const count = logs.filter((l) => {
    const t = l.timestamp || l.hora || l.created_at;
    if (!t) return false;
    const ts = new Date(t).getTime();
    return ts >= corte;
  }).length;
  return count;
}

/**
 * 6. Tamanho da fila do Cortex.
 * Fonte: /api/pedidos (fila) ou /api/fila.
 * @returns {Promise<{tamanho: number, pendentes: number, processando: number}>}
 */
async function tamanhoFila() {
  const dados = await lerLogs('/api/pedidos') || await lerLogs('/api/fila') || {};
  const lista = Array.isArray(dados) ? dados : (dados.fila || dados.pedidos || []);
  let tamanho = 0;
  let pendentes = 0;
  let processando = 0;
  for (const item of lista) {
    tamanho++;
    const s = (item.status || item.estado || '').toString().toLowerCase();
    if (s === 'pendente' || s === 'aguardando' || s === 'waiting') pendentes++;
    else if (s === 'processando' || s === 'processing' || s === 'em_andamento') processando++;
  }
  return { tamanho, pendentes, processando };
}

/**
 * 7. Erros na última hora.
 * Fonte: /api/logs filtrando nível erro.
 * @returns {Promise<number>} quantidade de erros na última hora.
 */
async function errosUltimaHora() {
  const logs = await lerLogs('/api/logs') || [];
  const corte = new Date(umaHoraAtras()).getTime();
  const count = logs.filter((l) => {
    const t = l.timestamp || l.hora || l.created_at;
    if (!t) return false;
    const ts = new Date(t).getTime();
    if (ts < corte) return false;
    const nivel = (l.nivel || l.level || l.tipo || '').toString().toLowerCase();
    const msg = (l.mensagem || l.message || '').toString().toLowerCase();
    return nivel === 'erro' || nivel === 'error' || msg.includes('erro') || msg.includes('error');
  }).length;
  return count;
}

/**
 * Resumo de todas as métricas de uma vez.
 * Útil para dashboards.
 * @returns {Promise<object>}
 */
async function resumo() {
  const [estado, tempo, statusIA, cota, msgMin, fila, erros] = await Promise.all([
    estadoCortex(),
    tempoMedioRespostaUltimaHora(),
    statusIAS(),
    cotaUsadaPorProvedor(),
    mensagensPorMinuto(),
    tamanhoFila(),
    errosUltimaHora(),
  ]);
  return {
    estadoCortex: estado,
    tempoMedioRespostaUltimaHoraMs: tempo,
    statusIAS,
    cotaUsadaPorProvedor: cota,
    mensagensPorMinuto: msgMin,
    fila,
    errosUltimaHora: erros,
    geradoEm: agora(),
  };
}

module.exports = {
  estadoCortex,
  tempoMedioRespostaUltimaHora,
  statusIAS,
  cotaUsadaPorProvedor,
  mensagensPorMinuto,
  tamanhoFila,
  errosUltimaHora,
  resumo,
};
