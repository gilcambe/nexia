/**
 * ╔══════════════════════════════════════════════════════╗
 * ║  NEXIA OS — AGENTS API v10.0                        ║
 * ║  CRUD com isolamento de tenant + Assistentes GPTs   ║
 * ║  Suporte a RAG (até 5 arquivos) e Link Público      ║
 * ╚══════════════════════════════════════════════════════╝
 */

const firebaseInit = require('./firebase-init');
const now = () => firebaseInit.admin ? firebaseInit.admin.firestore.FieldValue.serverTimestamp() : new Date();
const { guard, makeHeaders, checkPermission } = require('./middleware');
const modelRouter = require('../../nexia-ai/model-router');

// Agentes built-in que ninguém pode deletar
const PROTECTED_GLOBAL = ['business', 'dev', 'security'];

// 10 Assistentes Prontos (Estilo GPTs)
const PRESET_ASSISTANTS = [
  {
    id: 'ast_preset_instagram',
    name: 'Post de Instagram',
    displayName: 'Post de Instagram',
    description: 'Cria posts, legendas persuasivas e ganchos para Instagram.',
    systemPrompt: 'Você é um especialista em marketing digital e criação de conteúdo para Instagram. Crie posts engajantes, legendas persuasivas, ideias de carrossel e hashtags relevantes para o público-alvo informado.',
    icon: '📸',
    global: true,
    preset: true
  },
  {
    id: 'ast_preset_whatsapp',
    name: 'Resposta de WhatsApp',
    displayName: 'Resposta de WhatsApp',
    description: 'Atendimento e suporte ao cliente via WhatsApp.',
    systemPrompt: 'Você é um assistente de atendimento via WhatsApp. Responda a clientes de forma cordial, ágil, objetiva e profissional, tirando dúvidas e direcionando para fechamento com tom humano e empático.',
    icon: '💬',
    global: true,
    preset: true
  },
  {
    id: 'ast_preset_contrato',
    name: 'Contrato simples',
    displayName: 'Contrato simples',
    description: 'Elaboração de minutas e contratos de prestação de serviços.',
    systemPrompt: 'Você é um assistente especializado na elaboração de minutas e contratos simples de prestação de serviços ou compra e venda. Redija cláusulas claras, objetivas e alinhadas às boas práticas do direito brasileiro.',
    icon: '📄',
    global: true,
    preset: true
  },
  {
    id: 'ast_preset_orcamento',
    name: 'Orçamento',
    displayName: 'Orçamento',
    description: 'Gera propostas comerciais e orçamentos estruturados.',
    systemPrompt: 'Você é um assistente comercial focado na montagem de propostas e orçamentos detalhados. Estruture itens, valores, formas de pagamento, prazos de entrega e condições comerciais de forma clara e persuasiva.',
    icon: '💰',
    global: true,
    preset: true
  },
  {
    id: 'ast_preset_email',
    name: 'E-mail de venda',
    displayName: 'E-mail de venda',
    description: 'Copywriting para e-mails de vendas e prospecção.',
    systemPrompt: 'Você é um copywriter sênior especializado em e-mails de vendas e cold mails. Crie assuntos chamativos, ganchos de abertura envolventes e chamadas para ação (CTA) claras de alta conversão.',
    icon: '✉️',
    global: true,
    preset: true
  },
  {
    id: 'ast_preset_roteiro',
    name: 'Roteiro de vídeo',
    displayName: 'Roteiro de vídeo',
    description: 'Roteiros para Reels, TikTok, Shorts e YouTube.',
    systemPrompt: 'Você é um roteirista especializado em vídeos curtos e longos (Reels, TikTok, YouTube). Estruture o roteiro com gancho nos primeiros 3 segundos, corpo do conteúdo, marcações visuais/sonoras e CTA final.',
    icon: '🎬',
    global: true,
    preset: true
  },
  {
    id: 'ast_preset_plano_aula',
    name: 'Plano de aula',
    displayName: 'Plano de aula',
    description: 'Planejamento pedagógico e estruturação de aulas.',
    systemPrompt: 'Você é um designer instrucional e pedagogo. Crie planos de aula estruturados contendo tema, objetivo geral e específicos, metodologia, recursos necessários, cronograma de atividades e método de avaliação.',
    icon: '📚',
    global: true,
    preset: true
  },
  {
    id: 'ast_preset_cardapio',
    name: 'Cardápio',
    displayName: 'Cardápio',
    description: 'Atendente de restaurante, pizzaria ou delivery.',
    systemPrompt: 'Você é o atendente virtual de uma pizzaria/restaurante. Apresente os itens do cardápio com preços, descrições apetitosas, ofertas do dia e ajude os clientes a realizarem seus pedidos.',
    icon: '🍕',
    global: true,
    preset: true
  },
  {
    id: 'ast_preset_resumo_pdf',
    name: 'Resumo de PDF',
    displayName: 'Resumo de PDF',
    description: 'Síntese executiva e extração de tópicos de documentos.',
    systemPrompt: 'Você é um assistente analítico especializado em síntese de documentos e relatórios. Extraia os pontos chave, resumos executivos, dados numéricos essenciais e plano de ação de textos e relatórios fornecidos.',
    icon: '📑',
    global: true,
    preset: true
  },
  {
    id: 'ast_preset_mei',
    name: 'Ajuda com MEI',
    displayName: 'Ajuda com MEI',
    description: 'Orientação sobre tributos, DAS, nota fiscal e regras do MEI.',
    systemPrompt: 'Você é um consultor especialista para Microempreendedores Individuais (MEI). Esclareça dúvidas sobre pagamento do DAS, emissão de nota fiscal, declaração anual (DASN-SIMEI), limite de faturamento e obrigações legais.',
    icon: '🏢',
    global: true,
    preset: true
  }
];

// Limites por plano para chamadas de assistentes
const DEFAULT_PLAN_LIMITS = { master: 10000, enterprise: 5000, pro: 1000, starter: 200, free: 50 };

async function trackTenantUsage(tenantId, userId = 'public') {
  const db = firebaseInit.db || global.db;
  if (!db) return { ok: true, calls: 1, limit: 500, plan: 'free' };
  const today = new Date().toISOString().split('T')[0];
  try {
    const tenantDoc = await db.collection('tenants').doc(tenantId).get().catch(() => null);
    const plan = tenantDoc && typeof tenantDoc.data === 'function' ? (tenantDoc.data()?.plan || 'free') : 'free';
    const limit = tenantDoc && typeof tenantDoc.data === 'function' && tenantDoc.data()?.assistantLimit !== undefined ? tenantDoc.data().assistantLimit : (DEFAULT_PLAN_LIMITS[plan] || DEFAULT_PLAN_LIMITS.free);

    const ref = db.collection('tenants').doc(tenantId).collection('usage').doc(today);
    return await db.runTransaction(async tx => {
      const doc = await tx.get(ref);
      if (!doc || !doc.exists) {
        tx.set(ref, { date: today, cortexCalls: 1, tenantId, plan, userBreakdown: { [userId]: 1 } });
        return { ok: true, calls: 1, limit, plan };
      }
      const calls = (doc.data().cortexCalls || 0) + 1;
      if (limit > 0 && calls > limit) {
        return { ok: false, error: `Limite de mensagens do plano atingido (${limit} msgs/dia). Faça upgrade para continuar.`, calls: doc.data().cortexCalls, limit, plan };
      }
      tx.update(ref, {
        cortexCalls: (firebaseInit.admin ? firebaseInit.admin.firestore.FieldValue.increment(1) : calls),
        [`userBreakdown.${userId}`]: 1
      });
      return { ok: true, calls, limit, plan };
    });
  } catch (e) {
    return { ok: true, calls: 1, limit: 50, plan: 'free' };
  }
}

async function indexKnowledgeFiles(tenantId, agentId, files) {
  const db = firebaseInit.db || global.db;
  if (!db || !Array.isArray(files) || files.length === 0) return;
  const CHUNK_SIZE = 800;
  const OVERLAP = 150;

  for (const file of files.slice(0, 5)) {
    if (!file || !file.fileName || !file.content) continue;
    const content = String(file.content);
    const chunks = [];
    for (let i = 0; i < content.length; i += (CHUNK_SIZE - OVERLAP)) {
      chunks.push(content.substring(i, i + CHUNK_SIZE));
    }
    const docRef = db.collection('tenants').doc(tenantId).collection('rag_index').doc();
    await docRef.set({
      fileName: file.fileName,
      agentId,
      createdAt: firebaseInit.admin ? firebaseInit.admin.firestore.FieldValue.serverTimestamp() : new Date(),
      chunks: chunks.slice(0, 50)
    });
  }
}

async function buildRAGContextForAgent(tenantId, agentId, query) {
  const db = firebaseInit.db || global.db;
  if (!db || !query) return '';
  try {
    const snap = await db.collection('tenants').doc(tenantId).collection('rag_index').get();
    const queryWords = query.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const results = [];

    const docs = Array.isArray(snap) ? snap : (snap.docs || snap);

    docs.forEach(doc => {
      const data = typeof doc.data === 'function' ? doc.data() : doc;
      if (agentId && data.agentId && data.agentId !== agentId) return;
      if (!data.chunks) return;
      for (const chunk of data.chunks) {
        const textWords = chunk.toLowerCase().split(/\W+/);
        let score = 0;
        for (const w of queryWords) {
          if (textWords.includes(w)) score++;
        }
        if (queryWords.length > 0 && score > 0) {
          results.push({ chunk, score: score / queryWords.length, fileName: data.fileName });
        }
      }
    });

    const top = results.sort((a, b) => b.score - a.score).slice(0, 3);
    if (!top.length) return '';
    return top.map(r => `[Arquivo: ${r.fileName}]\n${r.chunk}`).join('\n\n');
  } catch (e) {
    return '';
  }
}

exports.PRESET_ASSISTANTS = PRESET_ASSISTANTS;
exports.indexKnowledgeFiles = indexKnowledgeFiles;
exports.buildRAGContextForAgent = buildRAGContextForAgent;

exports.handler = async (event) => {
  const headers = makeHeaders(event);
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const params = event.queryStringParameters || {};
  let body = {};
  if (event.httpMethod !== 'GET') {
    try { body = JSON.parse(event.body || '{}'); } catch { }
  }

  // Permite acesso público sem token APENAS para rotas/ações públicas explícitas:
  // 1) Consulta pública de informações do assistente: GET ?publicId=...
  // 2) Execução de chat público de um cliente final: POST { action: 'publicChat' }
  const isPublicRequest = (event.httpMethod === 'GET' && !!params.publicId) ||
                          (event.httpMethod === 'POST' && body.action === 'publicChat');

  const guardOpts = isPublicRequest ? { skipAuth: true, skipTenant: true } : {};
  const guardErr = await guard(event, 'agents', guardOpts);
  if (guardErr) return guardErr;

  const db = firebaseInit.db || global.db;

  try {
    const tenantId = params.tenantId || body.tenantId || 'nexia';
    const role = event._role || 'user';

    // GET ?publicId=xxx — busca pública de um assistente por ID público ou ID comum
    if (event.httpMethod === 'GET' && params.publicId) {
      let agent = PRESET_ASSISTANTS.find(a => a.id === params.publicId);
      if (!agent && db) {
        const doc = await db.collection('agents').doc(params.publicId).get();
        if (doc && (doc.exists || typeof doc.data === 'function')) {
          agent = { id: doc.id || params.publicId, ...(typeof doc.data === 'function' ? doc.data() : doc) };
        }
      }
      if (!agent) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Assistente não encontrado' }) };
      }
      // Oculta systemPrompt em consulta pública para privacidade
      const { systemPrompt, ...publicInfo } = agent;
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, agent: publicInfo }) };
    }

    // GET — lista agentes do tenant + globais + presets (Requer autenticação)
    if (event.httpMethod === 'GET' && !params.id) {
      let tenantSnap = { docs: [] };
      let globalSnap = { docs: [] };
      if (db) {
        try {
          [tenantSnap, globalSnap] = await Promise.all([
            db.collection('agents').where('tenantId', '==', tenantId).get(),
            db.collection('agents').where('global', '==', true).get()
          ]);
        } catch { }
      }

      const seen = new Set();
      const list = [];

      for (const p of PRESET_ASSISTANTS) {
        seen.add(p.id);
        list.push(p);
      }

      const tDocs = tenantSnap.docs || (Array.isArray(tenantSnap) ? tenantSnap : []);
      const gDocs = globalSnap.docs || (Array.isArray(globalSnap) ? globalSnap : []);

      for (const d of [...tDocs, ...gDocs]) {
        const id = d.id;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const data = typeof d.data === 'function' ? d.data() : d;
        list.push({ id, ...data });
      }

      return { statusCode: 200, headers, body: JSON.stringify({ agents: list, total: list.length }) };
    }

    // GET ?id=xxx — busca um agente específico por ID
    if (event.httpMethod === 'GET' && params.id) {
      let agentData = PRESET_ASSISTANTS.find(a => a.id === params.id);
      if (!agentData && db) {
        const doc = await db.collection('agents').doc(params.id).get();
        if (doc && (doc.exists || typeof doc.data === 'function')) {
          agentData = { id: doc.id || params.id, ...(typeof doc.data === 'function' ? doc.data() : doc) };
        }
      }
      if (!agentData) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Agente não encontrado' }) };
      }
      if (!agentData.global && agentData.tenantId !== tenantId) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Acesso negado' }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ id: agentData.id, ...agentData }) };
    }

    // Se db for nulo para ações de modificação no Firestore
    if (!db && event.httpMethod !== 'GET' && body.action !== 'publicChat' && body.action !== 'chat') {
      return { statusCode: 503, headers, body: JSON.stringify({ ok: false, error: 'Firebase indisponível.' }) };
    }

    // POST com action: 'chat' ou 'publicChat' — executa conversa com o assistente
    if (event.httpMethod === 'POST' && (body.action === 'chat' || body.action === 'publicChat')) {
      const { agentId, message, history = [] } = body;
      if (!agentId || !message) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'agentId e message são obrigatórios' }) };
      }

      let agent = PRESET_ASSISTANTS.find(a => a.id === agentId);
      if (!agent && db) {
        const doc = await db.collection('agents').doc(agentId).get();
        if (doc && (doc.exists || typeof doc.data === 'function')) {
          agent = { id: doc.id || agentId, ...(typeof doc.data === 'function' ? doc.data() : doc) };
        }
      }
      if (!agent) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Assistente não encontrado' }) };
      }

      const targetTenantId = agent.tenantId || tenantId || 'nexia';

      // Checa cota/limite do tenant do proprietário do assistente
      const usage = await trackTenantUsage(targetTenantId, event._uid || 'public_user');
      if (!usage.ok) {
        return { statusCode: 429, headers, body: JSON.stringify({ error: usage.error, plan: usage.plan, limit: usage.limit }) };
      }

      // Busca contexto RAG nos arquivos do assistente
      const ragCtx = await buildRAGContextForAgent(targetTenantId, agent.id, message);

      const system = `${agent.systemPrompt || 'Você é um assistente prestativo.'}\n\n${ragCtx ? `## DOCUMENTOS E CONHECIMENTO:\n${ragCtx}\n` : ''}`;

      const messages = [
        ...history.slice(-10).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content) })),
        { role: 'user', content: message }
      ];

      let reply = '';
      const providerChain = [
        { provider: 'groq', model: 'openai/gpt-oss-120b' },
        { provider: 'gemini', model: 'gemini-2.5-flash' },
        { provider: 'openrouter', model: 'meta-llama/llama-4-maverick:free' }
      ];

      for (const prov of providerChain) {
        try {
          const routerRes = await modelRouter.getRouter().chat(prov, { system, messages, maxTokens: 2048 });
          if (routerRes && routerRes.text) {
            reply = routerRes.text;
            break;
          }
        } catch { }
      }

      if (!reply) {
        reply = `Olá! Sou o ${agent.displayName || agent.name}. Recebi sua mensagem: "${message}". Como posso ajudar?`;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          reply,
          agent: { id: agent.id, name: agent.displayName || agent.name, icon: agent.icon },
          usage: { calls: usage.calls, limit: usage.limit }
        })
      };
    }

    // POST — cria agente / assistente (Protegido por autenticação e papéis)
    if (event.httpMethod === 'POST') {
      if (!checkPermission(role, 'createAgent')) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Sem permissão para criar agentes' }) };
      }

      const { name, displayName, description, systemPrompt, agentType, model, temperature, icon, capabilities, tags, knowledgeFiles = [] } = body;
      if (!name || !systemPrompt) throw new Error('name e systemPrompt são obrigatórios');
      if (systemPrompt.length < 10) throw new Error('systemPrompt muito curto (mínimo 10 chars)');
      if (systemPrompt.length > 5000) throw new Error('systemPrompt muito longo (máximo 5000 chars)');

      if (Array.isArray(knowledgeFiles) && knowledgeFiles.length > 5) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Máximo de 5 arquivos de conhecimento por assistente.' }) };
      }

      const id = 'agent_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);

      const filesMeta = (knowledgeFiles || []).slice(0, 5).map(f => ({
        fileName: f.fileName || 'documento.txt',
        size: (f.content || '').length
      }));

      const data = {
        id,
        name: name.slice(0, 80),
        displayName: (displayName || name).slice(0, 80),
        description: (description || '').slice(0, 500),
        systemPrompt: systemPrompt.slice(0, 5000),
        agentType: agentType || 'custom',
        model: model || 'llama-3.3-70b-versatile',
        temperature: Math.min(2, Math.max(0, temperature ?? 0.7)),
        icon: (icon || '🤖').slice(0, 100),
        capabilities: (capabilities || []).slice(0, 20),
        tags: (tags || []).slice(0, 10),
        knowledgeFiles: filesMeta,
        tenantId,
        global: false,
        active: true,
        runCount: 0,
        lastRun: null,
        createdBy: event._userId || 'unknown',
        createdAt: now(),
        updatedAt: now()
      };

      await db.collection('agents').doc(id).set(data);

      if (Array.isArray(knowledgeFiles) && knowledgeFiles.length > 0) {
        await indexKnowledgeFiles(tenantId, id, knowledgeFiles);
      }

      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, id, agent: data }) };
    }

    // PATCH — atualiza agente (Protegido por autenticação e papéis)
    if (event.httpMethod === 'PATCH') {
      if (!checkPermission(role, 'updateAgent')) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Sem permissão para editar agentes' }) };
      }

      const { id, knowledgeFiles, ...fields } = body;
      if (!id) throw new Error('id é obrigatório');

      const doc = await db.collection('agents').doc(id).get();
      if (!doc || (!doc.exists && typeof doc.data !== 'function')) throw new Error('Agente não encontrado');

      const agentData = typeof doc.data === 'function' ? doc.data() : doc;
      if (!agentData.global && agentData.tenantId !== tenantId) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Acesso negado' }) };
      }
      if (PROTECTED_GLOBAL.includes(id) && fields.systemPrompt !== undefined) {
        throw new Error('System prompt de agentes padrão não pode ser alterado');
      }

      const EDITABLE = ['displayName', 'description', 'systemPrompt', 'agentType', 'model', 'temperature', 'icon', 'capabilities', 'tags', 'active'];
      const update = {};
      for (const k of EDITABLE) {
        if (fields[k] !== undefined) update[k] = fields[k];
      }
      if (update.systemPrompt) update.systemPrompt = update.systemPrompt.slice(0, 5000);

      if (Array.isArray(knowledgeFiles)) {
        if (knowledgeFiles.length > 5) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: 'Máximo de 5 arquivos de conhecimento por assistente.' }) };
        }
        update.knowledgeFiles = knowledgeFiles.map(f => ({ fileName: f.fileName || 'doc.txt', size: (f.content || '').length }));
        await indexKnowledgeFiles(tenantId, id, knowledgeFiles);
      }

      update.updatedAt = now();
      update.updatedBy = event._userId || 'unknown';

      await db.collection('agents').doc(id).update(update);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, id, updated: update }) };
    }

    // DELETE — remove agente (Protegido por autenticação e papéis)
    if (event.httpMethod === 'DELETE') {
      if (!checkPermission(role, 'deleteAgent')) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Sem permissão para deletar agentes' }) };
      }

      const id = params.id || body.id;
      if (!id) throw new Error('id é obrigatório');
      if (PROTECTED_GLOBAL.includes(id)) throw new Error('Agentes padrão não podem ser removidos');

      const doc = await db.collection('agents').doc(id).get();
      if (!doc || (!doc.exists && typeof doc.data !== 'function')) throw new Error('Agente não encontrado');
      const agentData = typeof doc.data === 'function' ? doc.data() : doc;
      if (agentData.tenantId !== tenantId) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Acesso negado' }) };
      }

      await db.collection('agents').doc(id).delete();
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, deleted: id }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  } catch (err) {
    console.error('[AGENTS] ❌', err && err.message ? err.message : 'Internal error');
    return { statusCode: 400, headers, body: JSON.stringify({ error: err && err.message ? err.message : 'Internal error' }) };
  }
};
