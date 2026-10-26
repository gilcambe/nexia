'use strict';

// ── fetchWithTimeout helper ──
async function _fetchTimeout(url, opts = {}, ms = 30000) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(tid); }
}


/**
/**
 * ╔══════════════════════════════════════════════════════╗
 * ║  NEXIA OS — CORTEX MEMORY v9.0                      ║
 * ║  Memória isolada por tenant · Sumarização automática ║
 * ║  FIX v9: cortex_memory era global — agora é por     ║
 * ║  tenants/{tenantId}/cortex_memory/{userId}          ║
 * ╚══════════════════════════════════════════════════════╝
 */


const { admin, db } = require('./firebase-init');
const modelRouter = require('../../nexia-ai/model-router'); // Fase 10: chamadas de IA via Model Router
const { guard, assertTenantAccess, makeHeaders} = require('./middleware'); // SEC Fase 1: import faltante (antes /api/memory respondia 500)


const MAX_RAW_MESSAGES  = 30;
const MAX_KEEP_RECENT   = 10;
const MAX_SUMMARIES     = 5;
const MAX_TOTAL_HISTORY = 50;


// ── Sumariza histórico via IA ──────────────────────────────────
async function summarizeHistory(oldMessages) {
  try {
    const text = oldMessages
      .map(m => `${m.role === 'user' ? '👤' : '🤖'} ${m.content}`)
      .join('\n');


    // Sem chave / erro HTTP / rede → o Router lança e o catch devolve null (como antes).
    const data = await modelRouter.getRouter().chat({ provider: 'groq', model: 'llama-3.1-8b-instant' }, {
        temperature: 0,
        maxTokens: 500,
        messages: [
          {
            role: 'system',
            content: 'Você é um sistema de compressão de memória de IA. Resuma o histórico de forma concisa preservando: decisões tomadas, ações executadas, dados importantes de clientes/tarefas/reuniões, contexto do negócio e intenções do usuário. Máximo 350 palavras. Em português.'
          },
          { role: 'user', content: `HISTÓRICO:\n${text}\n\nRESUMO COMPRIMIDO:` }
        ]
    });


    return data.text;
  } catch {
    return null;
  }
}


// ── Classifica tipo de mensagem ────────────────────────────────
function classifyMessage(content) {
  if (!content) return 'chat';
  const c = content.toLowerCase();
  if (c.includes('✅') || c.includes('criado') || c.includes('executad') || c.includes('atualizado')) return 'action';
  if (c.includes('```') || c.includes('function') || c.includes('código') || c.includes('const ')) return 'dev';
  if (c.includes('r$') || c.includes('receita') || c.includes('despesa') || c.includes('financ')) return 'finance';
  if (c.includes('reunião') || c.includes('meeting') || c.includes('agendar')) return 'meeting';
  return 'chat';
}


// ── Rota de storage isolada por tenant ────────────────────────
function memRef(tenantId, userId, conversationId = 'default') {
  return db.collection("tenants").doc(tenantId)
    .collection("cortex_memory").doc(`${userId}_${conversationId}`);
}


// ── Carrega memória ────────────────────────────────────────────
async function load(userId, tenantId = 'nexia', conversationId = 'default') {
  try {
    const doc = await memRef(tenantId, userId, conversationId).get();
    if (!doc.exists) return { history: [], summaries: [], stats: {}, entities: {} };
    return {
      history:   doc.data().history   || [],
      summaries: doc.data().summaries || [],
      stats:     doc.data().stats     || {},
      entities:  doc.data().entities  || {}  // clientes, tarefas mencionadas
    };
  } catch (e) {
    console.error('[CORTEX-MEMORY] load error:', 'Internal error');
    return { history: [], summaries: [], stats: {}, entities: {} };
  }
}


// ── Salva memória com sumarização automática ───────────────────
async function save(userId, history, existingSummaries = [], tenantId = 'nexia', entities = {}, conversationId = 'default') {
  let summaries = [...existingSummaries];


  if (history.length > MAX_RAW_MESSAGES) {
    const toSummarize = history.slice(0, history.length - MAX_KEEP_RECENT);
    const recent      = history.slice(history.length - MAX_KEEP_RECENT);


    const summary = await summarizeHistory(toSummarize);
    if (summary) {
      summaries.push({
        content:   summary,
        createdAt: new Date().toISOString(),
        msgCount:  toSummarize.length
      });
      if (summaries.length > MAX_SUMMARIES) summaries = summaries.slice(-MAX_SUMMARIES);
      history = recent;
    } else {
      history = history.slice(-MAX_KEEP_RECENT);
    }
  }


  if (history.length > MAX_TOTAL_HISTORY) history = history.slice(-MAX_TOTAL_HISTORY);


  const stats = {
    totalMessages:   history.length,
    totalSummaries:  summaries.length,
    lastUpdated:     new Date().toISOString(),
    messageTypes:    history.reduce((acc, m) => {
      const t = classifyMessage(m.content);
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {})
  };


  await memRef(tenantId, userId, conversationId).set({
    history,
    summaries,
    stats,
    entities,
    tenantId,
    userId,
    updatedAt: new Date().toISOString()
  });


  return { history, summaries, stats, entities };
}


// ── Extrai entidades mencionadas (clientes, tarefas, etc) ─────
function extractEntities(messages, existingEntities = {}) {
  const entities = { ...existingEntities };
  for (const m of messages) {
    if (!m.content) continue;
    // Detecta IDs de recursos nas respostas do assistente
    const idMatches = m.content.matchAll(/`?(createClient|createTask|createMeeting|createFinance)`?.+?ID[:\s]+`?([A-Za-z0-9]{15,30})`?/g);
    for (const match of idMatches) {
      const [, type, id] = match;
      const key = type.replace('create', '').toLowerCase() + 's';
      if (!entities[key]) entities[key] = [];
      if (!entities[key].includes(id)) entities[key].push(id);
      // Mantém só os últimos 10 por tipo
      if (entities[key].length > 10) entities[key] = entities[key].slice(-10);
    }
  }
  return entities;
}


// ── Monta contexto completo para enviar à IA ──────────────────
function buildContext(history, summaries, maxRecent = 20) {
  const recent = history.slice(-maxRecent);
  if (!summaries.length) return recent;


  const summaryText = summaries
    .map((s, i) => `[Resumo ${i + 1} — ${s.msgCount} mensagens anteriores]:\n${s.content}`)
    .join('\n\n');


  return [
    { role: 'system', content: `MEMÓRIA COMPRIMIDA (contexto anterior do usuário):\n${summaryText}` },
    ...recent
  ];
}


// ── Deleta memória de um usuário ───────────────────────────────
async function clear(userId, tenantId = 'nexia', conversationId = 'default') {
  await memRef(tenantId, userId, conversationId).delete();
  return { ok: true, cleared: true };
}


// ── Handler Netlify ────────────────────────────────────────────
exports.handler = async (event) => {
  const headers = makeHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

  const guardErr = await guard(event, 'cortex-memory', { skipTenant: true });
  if (guardErr) return guardErr;

  if (!db) return { statusCode: 503, headers, body: JSON.stringify({ ok: false, error: 'Firebase indisponível — configure FIREBASE_SERVICE_ACCOUNT nos segredos do Worker.' }) };


  try {
    const _body = JSON.parse(event.body || '{}');
    const { tenantId = 'nexia', messages, action, conversationId = 'default' } = _body;
    // FIX IDOR: userId SEMPRE do token verificado — nunca do body
    const userId = event._uid || _body.userId;
    if (!userId) throw new Error('userId é obrigatório');
    // FIX TENANT ISOLATION: valida que o caller pertence ao tenantId fornecido
    const tenantErr = await assertTenantAccess(event, tenantId, headers);
    if (tenantErr) return tenantErr;


    const mem = await load(userId, tenantId, conversationId);


    if (action === 'get') {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          history:   mem.history,
          summaries: mem.summaries,
          stats:     mem.stats,
          entities:  mem.entities,
          context:   buildContext(mem.history, mem.summaries)
        })
      };
    }


    if (action === 'clear') {
      const result = await clear(userId, tenantId, conversationId);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }


    if (!Array.isArray(messages)) throw new Error('messages[] é obrigatório');
    const updated  = [...mem.history, ...messages];
    const entities = extractEntities(messages, mem.entities);
    const result   = await save(userId, updated, mem.summaries, tenantId, entities, conversationId);


    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        ok: true,
        total:     result.history.length,
        summaries: result.summaries.length,
        stats:     result.stats,
        entities:  result.entities
      })
    };


  } catch (err) {
    console.error('[CORTEX-MEMORY] ❌', 'Internal error');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error' }) };
  }
};


exports.load         = load;
exports.save         = save;
exports.clear        = clear;
exports.buildContext = buildContext;
exports.extractEntities = extractEntities;

// ── Funções puras para gerenciamento de lições ────────────────────

/**
 * Adiciona uma nova lição à lista, garantindo que contenha os campos obrigatórios
 * e mantendo no máximo as últimas 30 lições
 * @param {Array} lessons - Array atual de lições
 * @param {Object} lessonData - Objeto com data, tentativa, erro e regra
 * @returns {Array} Nova lista de lições com a nova lição adicionada e limitada a 30
 */
function addLesson(lessons = [], lessonData) {
  // Validação dos campos obrigatórios
  if (!lessonData || typeof lessonData !== 'object') {
    throw new Error('lessonData deve ser um objeto com data, tentativa, erro e regra');
  }
  
  const requiredFields = ['data', 'tentativa', 'erro', 'regra'];
  for (const field of requiredFields) {
    if (lessonData[field] === undefined || lessonData[field] === null) {
      throw new Error(`Campo obrigatório '${field}' está faltando na lição`);
    }
  }
  
  // Adiciona a nova lição com timestamp
  const newLesson = {
    ...lessonData,
    createdAt: new Date().toISOString()
  };
  
  // Adiciona ao início do array (mais recente primeiro) e limita a 30
  const updatedLessons = [newLesson, ...lessons].slice(0, 30);
  
  return updatedLessons;
}

/**
 * Retorna a lista atual de lições
 * @param {Array} lessons - Array de lições
 * @returns {Array} Lista de lições
 */
function getLessons(lessons = []) {
  return Array.isArray(lessons) ? lessons : [];
}

/**
 * Formata as últimas 5 a 8 lições para injetar no prompt dos agentes
 * @param {Array} lessons - Array de lições
 * @param {number} minCount - Número mínimo de lições a formatar (padrão: 5)
 * @param {number} maxCount - Número máximo de lições a formatar (padrão: 8)
 * @returns {string} Lições formatadas para o prompt
 */
function formatLessonsForPrompt(lessons = [], minCount = 5, maxCount = 8) {
  const lessonsList = getLessons(lessons);
  
  // Valida os parâmetros de contagem
  if (minCount < 1) minCount = 1;
  if (maxCount < minCount) maxCount = minCount;
  
  // Seleciona as lições mais recentes (últimas do array)
  const selectedCount = Math.min(
    Math.max(minCount, maxCount),
    lessonsList.length
  );
  
  const selectedLessons = lessonsList.slice(0, selectedCount);
  
  // Formata as lições para o prompt
  return selectedLessons.map((lesson, index) => {
    return `Lição ${index + 1} (${new Date(lesson.createdAt).toLocaleDateString()}):
- Tentativa: ${lesson.tentativa}
- Erro: ${lesson.erro}
- Regra: ${lesson.regra}`;
  }).join('\n\n');
}

// Exporta as funções de lições
exports.addLesson = addLesson;
exports.getLessons = getLessons;
exports.formatLessonsForPrompt = formatLessonsForPrompt;
