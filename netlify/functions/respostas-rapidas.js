'use strict';

/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  NEXIA OS — RESPOSTAS RÁPIDAS v1.0                                  ║
 * ║  Perguntas diretas sem fila de issues (Melhoria 46)                 ║
 * ║  Modelo leve, custo 0, acesso imediato aos artefatos da Central      ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

const { admin, db } = require('./firebase-init');
const { guard, sanitizePrompt, HEADERS, makeHeaders } = require('./middleware');
const { publicErrorBody } = require('../../lib/safe-error');
const nexiaCortex = require('../../nexia-ai/cortex');

// Modelos leves e rápidos para perguntas diretas (sem custo)
const QUICK_MODELS = [
  'groq_llama3_fast',    // Mais rápido
  'gemini_25_flash',     // Respostas diretas
  'mistral_small',       // Leve e rápido
  'cohere_command_r'     // Boa para perguntas
];

// Lista de perguntas que são consideradas "rápidas" e não criam issues
const QUICK_QUESTIONS = [
  /como estamos/i,
  /como vai/i,
  /status/i,
  /o que falta/i,
  /pendencias/i,
  /prazo/i,
  /entrega/i,
  /progresso/i,
  /andamento/i,
  /resumo/i,
  /dashboard/i,
  /central/i
];

function isQuickQuestion(message) {
  return QUICK_QUESTIONS.some(pattern => pattern.test(message));
}

async function callQuickModel(system, messages, modelKey) {
  try {
    const modelRouter = require('../../nexia-ai/model-router');
    const ai = {
      provider: modelKey.includes('groq') ? 'groq' : 
                modelKey.includes('gemini') ? 'gemini' : 
                modelKey.includes('mistral') ? 'mistral' : 'cohere',
      model: modelKey
    };
    
    const result = await modelRouter.getRouter().chat(ai, {
      system,
      messages,
      maxTokens: 2000
    });
    
    return result.text;
  } catch (error) {
    console.warn('[RESPOSTAS-RÁPIDAS] Erro ao chamar modelo:', error.message);
    throw error;
  }
}

async function getCentralContext(tenantId) {
  try {
    // Busca os artefatos mais recentes da Central para contexto
    const snapshot = await db.collection('tenants').doc(tenantId).collection('central')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();
    
    const artifacts = [];
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      artifacts.push({
        type: data.type || 'log',
        content: data.content || data.message || '',
        timestamp: data.timestamp || data.ts
      });
    });
    
    return artifacts;
  } catch (error) {
    console.warn('[RESPOSTAS-RÁPIDAS] Erro ao buscar contexto da Central:', error.message);
    return [];
  }
}

exports.handler = async (event) => {
  const headers = makeHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  const guardErr = await guard(event, 'respostas-rapidas');
  if (guardErr) return guardErr;

  try {
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON inválido no body' }) }; }

    const { message, tenantId = 'nexia', conversationId = 'default' } = body;
    
    if (!message) return { statusCode: 400, headers, body: JSON.stringify({ error: 'message é obrigatório' }) };
    
    // Sanitiza a mensagem
    let sanitizedMessage;
    try { sanitizedMessage = sanitizePrompt(message); }
    catch (se) { return { statusCode: 400, headers, body: JSON.stringify({ error: se.message }) }; }

    // Verifica se é uma pergunta rápida
    if (!isQuickQuestion(sanitizedMessage)) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ 
          error: 'Esta não é uma pergunta rápida. Use o endpoint /api/cortex para perguntas complexas ou pedidos de código.' 
        }) 
      };
    }

    // Busca contexto da Central
    const centralArtifacts = await getCentralContext(tenantId);
    
    // Constrói o prompt para a resposta rápida
    const systemPrompt = `Você é o assistente de respostas rápidas do NEXIA OS. Responda perguntas diretas sobre status, andamento e pendências com base nos artefatos da Central.

## Regras:
- Seja direto e objetivo
- Use markdown simples para formatação
- Inclua datas e horários quando relevantes
- Se não houver informação suficiente, diga "Não há informações suficientes na Central para responder esta pergunta"
- Responda em português do Brasil

## Artefatos da Central (últimos 10):
${centralArtifacts.map(art => `- ${art.type}: ${art.content.substring(0, 100)}${art.content.length > 100 ? '...' : ''}`).join('\n')}`;

    const messages = [{ role: 'user', content: sanitizedMessage }];
    
    // Tenta modelos em ordem de velocidade
    let response = '';
    let modelUsed = '';
    
    for (const modelKey of QUICK_MODELS) {
      try {
        response = await callQuickModel(systemPrompt, messages, modelKey);
        modelUsed = modelKey;
        break;
      } catch (error) {
        console.warn(`[RESPOSTAS-RÁPIDAS] Modelo ${modelKey} falhou, tentando próximo...`);
        continue;
      }
    }
    
    if (!response) {
      throw new Error('Nenhum modelo rápido disponível');
    }

    // Log da resposta rápida (sem criar issue)
    if (db) {
      try {
        await db.collection('tenants').doc(tenantId).collection('quick_responses').add({
          message: sanitizedMessage,
          response,
          model: modelUsed,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          conversationId
        });
      } catch (error) {
        console.warn('[RESPOSTAS-RÁPIDAS] Erro ao log resposta:', error.message);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        reply: response,
        type: 'quick_response',
        model: modelUsed,
        artifactsCount: centralArtifacts.length,
        timestamp: new Date().toISOString()
      })
    };

  } catch (err) {
    console.error('[RESPOSTAS-RÁPIDAS] Erro:', err);
    const body = publicErrorBody('RESPOSTAS RÁPIDAS', err, 'Erro ao processar pergunta rápida. Tente novamente.');
    return { statusCode: 500, headers, body: JSON.stringify(body) };
  }
};