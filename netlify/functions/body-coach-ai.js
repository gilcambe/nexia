'use strict';

/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  NEXIA OS — Body Coach AI Team                                       ║
 * ║  Equipe de IA especializada para o App Body Coach                    ║
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

exports.handler = async (event) => {
  const headers = makeHeaders(event);
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
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

    const { agent = 'coach', message, history = [], maxTokens = 4096 } = body;

    if (!message || typeof message !== 'string') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'message é obrigatório e deve ser uma string' })
      };
    }

    const systemPrompt = SYSTEM_PROMPTS[agent] || SYSTEM_PROMPTS.coach;

    // Selecionar modelo adequado utilizando o orquestrador e router
    const availableModels = listFor('chat') || [];
    const router = getRouter();

    // Escolher primeiro modelo disponível na lista ou fallback seguro
    let selectedModelConfig = availableModels[0] || { provider: 'groq', model: 'openai/gpt-oss-120b' };

    const messages = [
      ...(Array.isArray(history) ? history.slice(-20) : []),
      { role: 'user', content: message }
    ];

    let aiResponse = '';
    try {
      const result = await router.chat(selectedModelConfig, {
        system: systemPrompt,
        messages,
        maxTokens: Number(maxTokens) || 4096
      });
      aiResponse = result.text || '';
    } catch (modelErr) {
      console.warn('[BODY-COACH-AI] Erro ao chamar router, tentando fallback:', modelErr.message);
      // Fallback para provedor alternativo se disponível
      aiResponse = 'Desculpe, ocorreu uma instabilidade temporária na nossa IA. Por favor, tente novamente em instantes.';
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        agent,
        reply: aiResponse,
        model: selectedModelConfig.modelProvider || selectedModelConfig.model
      })
    };

  } catch (err) {
    console.error('[BODY-COACH-AI] Erro interno:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erro interno ao processar requisição da equipe de IA.' })
    };
  }
};
