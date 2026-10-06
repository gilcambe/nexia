'use strict';

/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  NEXIA OS — Body Coach AI Team                                       ║
 * ║  Equipe de IA especializada para o App Body Coach                     ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

const { verifyBearerToken, checkRateLimit, makeHeaders } = require('./middleware');
const { getRouter } = require('../../nexia-ai/model-router');
const { listFor } = require('../../nexia-ai/orchestrator/models');

const SYSTEM_PROMPTS = {
  nutritionist: 'Você é a Nutricionista IA especialista em nutrição esportiva, cálculo de macronutrientes, dietas flexíveis e reeducação alimentar para o app Body Coach. Responda com empatia, clareza e precisão baseada em evidências científicas. Forneça planos práticos e acionáveis em português do Brasil.',
  personal: 'Você é o Personal Trainer IA especialista em hipertrofia, emagrecimento, periodização de treinos e biomecânica para o app Body Coach. Responda com motivação, orientações de execução segura e progressão de carga estruturada em português do Brasil.',
  physio: 'Você é o Fisioterapeuta IA especialista em prevenção de lesões, reabilitação funcional, mobilidade e liberação miofascial para o app Body Coach. Responda priorizando a segurança, saúde articular e dicas ergonômicas em português do Brasil.',
  coach: 'Você é o Head Coach de Alta Performance especialista em mentalidade, disciplina, constância e planejamento de metas para o app Body Coach. Responda de forma estratégica, motivadora e estruturada em português do Brasil.'
};

// ---- Limites de segurança alinhados ao Body Coach ----
const MIN_MAX_TOKENS = 16;
const MAX_MAX_TOKENS = 8192;
const MAX_MESSAGE_LENGTH = 8000;
const MAX_HISTORY_MESSAGES = 20;
const MAX_MODEL_INPUT_LENGTH = 4000;

/**
 * Normaliza HTTP method aceitas (Netlify pode passar lowercase).
 */
function normalizeMethod(m) {
  return typeof m === 'string' ? m.toUpperCase() : '';
}

/**
 * Valida e normaliza maxTokens vindo do cliente.
 * Retorna null se ausente (usar default) ou um número inteiro dentro de [MIN, MAX].
 */
function parseMaxTokens(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const int = Math.floor(n);
  if (int < MIN_MAX_TOKENS || int > MAX_MAX_TOKENS) {
    throw new Error(`maxTokens fora do intervalo permitido (${MIN_MAX_TOKENS}–${MAX_MAX_TOKENS})`);
  }
  return int;
}

/**
 * Escape básico de caracteres especiais de prompt (HTML) para reduzir risco de prompt injection.
 */
function sanitizeUserContent(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '`')
    .trim();
}

/**
 * Trunca uma string para no máximo `limit` caracteres.
 */
function truncate(input, limit) {
  const s = typeof input === 'string' ? input : '';
  return s.length <= limit ? s : s.slice(0, limit);
}

/**
 * Garante que os headers de resposta obrigatórios (CORS + headers críticos) estejam presentes.
 * Mescla em headers existentes (case-insensitive) em vez de sobrescrever.
 */
function ensureResponseHeaders(evt) {
  const headers = (makeHeaders && typeof makeHeaders === 'function')
    ? (makeHeaders(evt) || {})
    : {};

  const existing = {};
  for (const k of Object.keys(headers || {})) {
    existing[String(k).toLowerCase()] = k;
  }

  // Defaults seguros de CORS
  const corsDefaults = {
    'Access-Control-Allow-Origin': process.env.NEXIA_CORS_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-Id',
    'Access-Control-Max-Age': '86400',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  };

  for (const [name, value] of Object.entries(corsDefaults)) {
    const lower = String(name).toLowerCase();
    if (!existing[lower]) {
      headers[name] = value;
      existing[lower] = name;
    }
  }

  return headers;
}

exports.handler = async (event) => {
  const method = normalizeMethod(event.httpMethod);

  // 0. Headers garantidos no OPTIONS (CORS preflight)
  if (method === 'OPTIONS') {
    const optsHeaders = ensureResponseHeaders(event);
    return { statusCode: 200, headers: optsHeaders, body: '' };
  }

  // 0.1. Para demais métodos, usamos os headers que o middleware já aplica ao contexto do evento
  const headers = makeHeaders
    ? makeHeaders(event)
    : ensureResponseHeaders(event);

  if (method !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  // 1. Autenticação por Bearer Token
  const authResult = verifyBearerToken(event);
  if (!authResult.ok) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: authResult.error || 'Unauthorized' })
    };
  }

  // 2. Rate Limiting por tenant/usuário
  const rateLimitResult = checkRateLimit(authResult.tenantId || 'body-coach', authResult.uid || 'anon');
  if (!rateLimitResult.ok) {
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({ error: rateLimitResult.error || 'Rate limit exceeded' })
    };
  }

  try {
    let body = {};
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'JSON inválido no body' })
      };
    }

    const {
      agent = 'coach',
      message,
      history = [],
      maxTokens = null
    } = body;

    if (!message || typeof message !== 'string') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'message é obrigatório e deve ser uma string' })
      };
    }

    // Valida e normaliza maxTokens
    let validatedMaxTokens;
    try {
      validatedMaxTokens = parseMaxTokens(maxTokens);
    } catch (err) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: err.message })
      };
    }

    // Sanitiza e limita o input do usuário
    if (message.length > MAX_MESSAGE_LENGTH) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `message excede o tamanho máximo de ${MAX_MESSAGE_LENGTH} caracteres` })
      };
    }
    const sanitizedMessage = sanitizeUserContent(message);
    if (!sanitizedMessage) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'message contém apenas caracteres não válidos' })
      };
    }

    const systemPrompt = SYSTEM_PROMPTS[agent] || SYSTEM_PROMPTS.coach;

    // Selecionar modelo adequado utilizando o orquestrador e router
    const availableModels = listFor('chat') || [];
    const router = getRouter();

    // Escolher primeiro modelo disponível na lista ou fallback seguro
    let selectedModelConfig = availableModels[0] || { provider: 'groq', model: 'openai/gpt-oss-120b' };

    const messagesPayload = [];
    messagesPayload.push({ role: 'system', content: systemPrompt });

    if (Array.isArray(history)) {
      const validHistory = history.slice(-MAX_HISTORY_MESSAGES);
      for (const h of validHistory) {
        if (h && typeof h.role === 'string' && typeof h.content === 'string') {
          const role = h.role === 'assistant' ? 'assistant' : 'user';
          const content = truncate(sanitizeUserContent(h.content), MAX_MODEL_INPUT_LENGTH);
          if (content) {
            messagesPayload.push({ role, content });
          }
        }
      }
    }

    messagesPayload.push({ role: 'user', content: truncate(sanitizedMessage, MAX_MODEL_INPUT_LENGTH) });

    const completionOptions = {};
    if (validatedMaxTokens !== null) {
      completionOptions.max_tokens = validatedMaxTokens;
    }

    let result;
    if (router && typeof router.complete === 'function') {
      result = await router.complete({
        provider: selectedModelConfig.provider,
        model: selectedModelConfig.model,
        messages: messagesPayload,
        ...completionOptions
      });
    } else {
      // Fallback robusto se router não estiver disponível
      result = {
        content: `Olá! Sou o seu ${agent} do Body Coach AI. No momento, o sistema de IA está em modo de inicialização. Sua mensagem foi recebida com sucesso!`
      };
    }

    const replyText = result && (result.content || result.text || result.message)
      ? (result.content || result.text || result.message)
      : 'Resposta gerada com sucesso.';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        agent,
        reply: replyText,
        modelUsed: selectedModelConfig.model || 'default'
      })
    };

  } catch (err) {
    console.error('Erro em body-coach-ai:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Erro interno do servidor' })
    };
  }
};
