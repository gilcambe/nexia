'use strict';

// NEXIA Body Coach — equipe de IA (coach, nutrólogo, personal, fisioterapeuta).
// Só usuário autenticado (Bearer do Firebase). Usa a lista de modelos GRÁTIS do Model Router, na ordem,
// e passa para o próximo quando um falha (cota, indisponível). Não registra o texto das mensagens.

const { verifyBearerToken, checkRateLimit, makeHeaders } = require('./middleware');
const { getRouter } = require('../../nexia-ai/model-router');
const { listFor } = require('../../nexia-ai/orchestrator/models');
const { estaBloqueado } = require('./body-coach/acesso');

const COMUM = ' Responda em português do Brasil como numa conversa de WhatsApp com UMA pessoa que você conhece: calorosa, natural e curta (1 a 3 frases na maioria das respostas; só passe disso se a pessoa pedir um plano ou uma explicação). Responda ao que a pessoa acabou de dizer, levando em conta as mensagens anteriores da conversa; nunca repita o que já foi dito e nunca despeje dicas, números ou listas que ninguém pediu. Se a pessoa só cumprimentar ("oi", "olá", "bom dia"), cumprimente de volta pelo apelido e pergunte UMA coisa simples sobre o dia dela (como dormiu, como está de energia ou se vai treinar hoje), usando o contexto só se ajudar. Se o contexto trouxer "apelido", chame a pessoa por ele. Use os dados do contexto só quando forem relevantes ao que foi perguntado e sem inventar nada que não esteja nele. Quando der conselho, personalize ao objetivo, às modalidades, ao nível e às limitações: quem corre recebe dicas de corrida, quem luta, de luta, quem nada, de natação; cadeirante nunca recebe exercício em pé, perna em pé nem esteira; respeite lesões e condições. Se a pessoa disser que está cansada, com sono ou desanimada, mostre que entendeu (ex.: "poxa, entendo") e sugira algo leve ou pergunte como ela dormiu; nunca comemore o cansaço. Não repita a mesma pergunta que já foi feita. Faça no máximo uma pergunta por mensagem. Não use listas nem títulos.';
const PAPEIS = {
  coach: 'Você é o coach do aluno no app NEXIA Body Coach: motivacional, conecta treino, dieta e rotina e ajuda a manter a constância.' + COMUM,
  nutrologo: 'Você é um médico nutrólogo no app NEXIA Body Coach: orienta alimentação e metas de macros. Não diagnostique e não prescreva remédios; em sintomas, exames alterados ou doenças, mande procurar um médico presencial.' + COMUM,
  personal: 'Você é um personal trainer no app NEXIA Body Coach: orienta carga, séries, técnica e progressão do treino.' + COMUM,
  fisioterapeuta: 'Você é um fisioterapeuta no app NEXIA Body Coach: orienta mobilidade, dor leve e prevenção de lesão. Em dor forte, formigamento ou lesão, mande procurar atendimento presencial.' + COMUM,
};

const CARDIO = 'Você lê a foto do painel de uma esteira, bicicleta, escada, elíptico ou relógio e devolve SOMENTE um JSON, sem texto e sem markdown, no formato {"aparelho":"esteira|bike|escada|eliptico|outro","tempo_seg":número,"distancia_km":número,"kcal":número,"velocidade_kmh":número,"passos":número}. Use null no que não aparecer ou não estiver legível. Tempo "01:00:02" vira 3602. Não invente números.';
const RECEITA = 'Você é um nutricionista no app NEXIA Body Coach e cria UMA receita simples, barata e gostosa da culinária brasileira, em português do Brasil. Use preferencialmente os ingredientes que a pessoa disser ter; se não disser, use itens comuns de mercado. Encaixe nas calorias e proteína que ainda faltam no dia (contexto) e respeite objetivo, restrições e limitações. Formato exato, sem enfeites: primeira linha só o nome da receita; depois "Tempo: X min | Rende: N porção(ões)"; depois "Ingredientes:" com um item por linha começando com "- "; depois "Modo de preparo:" com passos numerados (máximo 6, curtos); por fim "Aproximado por porção: X kcal, Y g de proteína". Não use markdown, asteriscos nem títulos. Não prescreva remédios nem trate doenças.';
const resposta = (event, statusCode, body) => ({ statusCode, headers: makeHeaders(event), body: JSON.stringify(body) });

exports.handler = async (event) => {
  const method = String(event.httpMethod || '').toUpperCase();
  if (method === 'OPTIONS') return { statusCode: 204, headers: makeHeaders(event), body: '' };
  if (method !== 'POST') return resposta(event, 405, { error: 'Method Not Allowed' });

  const auth = await verifyBearerToken(event);
  if (!auth.ok) return resposta(event, 401, { error: 'Entre na sua conta para falar com a equipe.' });
  const rl = await checkRateLimit(auth.uid, 'body-coach-ai');
  if (!rl.ok) return resposta(event, 429, { error: 'Muitas mensagens seguidas. Aguarde um instante.' });
  // Período grátis acabou e não pagou: a IA também fica bloqueada (o bloqueio é no servidor, não só na tela).
  try {
    const { db } = require('./firebase-init');
    if (db) {
      const eu = (await db.collection('bc_diretorio').doc(auth.uid).get()).data?.() || {};
      if (await estaBloqueado(db, auth.uid, { master: auth.role === 'master', email: auth.email, papel: eu.papel, coachUid: eu.papel === 'aluno' ? eu.coachUid || '' : '' })) {
        return resposta(event, 402, { error: 'Seu período grátis acabou. Pague para continuar usando o app.', bloqueado: true });
      }
    }
  } catch { /* banco fora do ar: não bloqueia */ }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return resposta(event, 400, { error: 'Pedido inválido.' }); }
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (message.length < 1 || message.length > 3000) return resposta(event, 400, { error: 'Escreva uma mensagem de até 3000 caracteres.' });
  const role = Object.prototype.hasOwnProperty.call(PAPEIS, body.role) ? body.role : 'coach';
  const contexto = JSON.stringify(body.context && typeof body.context === 'object' ? body.context : {}).slice(0, 2000);
  const receita = body.task === 'receita';
  const cardio = body.task === 'cardio';
  if (cardio && typeof body.image !== 'string') return resposta(event, 400, { error: 'Mande a foto do painel.' });
  const system = `${cardio ? CARDIO : receita ? RECEITA : PAPEIS[role]}\nContexto do aluno: ${contexto}`;
  // Últimas mensagens da conversa (até 10), para o coach lembrar o que o aluno já disse.
  const historico = Array.isArray(body.history) ? body.history.slice(-10).filter((h) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string' && h.content.trim()).map((h) => ({ role: h.role, content: h.content.trim().slice(0, 600) })) : [];
  const mensagens = [...historico, { role: 'user', content: message }];
  // Foto de evolução (opcional): só modelos com visão (Gemini grátis) olham a imagem.
  let images;
  if (typeof body.image === 'string') {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(body.image);
    if (!m || m[2].length > 900000) return resposta(event, 400, { error: 'Foto inválida ou grande demais.' });
    images = [{ mime: m[1], data: m[2] }];
  }

  // 1. Uso exclusivo da lista grátis (FREE.fast / FREE.reasoning), nunca anthropic
  const useModels = (role === 'nutrologo' || role === 'fisioterapeuta' || receita) ? FREE.reasoning : FREE.fast;
  for (const m of useModels) {
    if (m.provider === 'anthropic') {
      throw new Error('Erro crítico: Provedor anthropic não permitido no Body Coach');
    }
  }

  // 2. Respostas prontas locais (sem IA) para perguntas mais comuns detectadas por palavras-chave
  const lcMsg = message.toLowerCase();
  let localReply = null;
  const ctxObj = body.context && typeof body.context === 'object' ? body.context : {};
  
  if (lcMsg.includes('quanto ainda posso comer') || lcMsg.includes('calorias restantes') || lcMsg.includes('quanto falta comer')) {
    const metas = ctxObj.metas || {};
    const consumido = ctxObj.consumido || {};
    const metaCal = Number(metas.calorias) || Number(metas.kcal) || 2000;
    const consCal = Number(consumido.calorias) || Number(consumido.kcal) || 0;
    const restCal = metaCal - consCal;
    if (restCal > 0) {
      localReply = `Ainda faltam cerca de ${Math.round(restCal)} kcal para atingir sua meta de hoje. Mantenha o foco nos macros!`;
    } else {
      localReply = `Você já atingiu ou ultrapassou a meta de calorias de hoje em ${Math.abs(Math.round(restCal))} kcal. Cuidado com os excessos!`;
    }
  } else if (lcMsg.includes('o que treino hoje') || lcMsg.includes('qual o treino de hoje') || lcMsg.includes('treino de hoje')) {
    const treinoHoje = ctxObj.treinoHoje || ctxObj.treino || '';
    if (treinoHoje) {
      localReply = `Hoje seu treino programado é: ${typeof treinoHoje === 'string' ? treinoHoje : JSON.stringify(treinoHoje)}. Arrebenta!`;
    } else {
      localReply = `Não encontrei um treino específico cadastrado para hoje no seu painel. Que tal uma caminhada ou um treino leve de mobilidade?`;
    }
  } else if (lcMsg.includes('troca de exercício') || lcMsg.includes('trocar exercício') || lcMsg.includes('substituir exercício')) {
    localReply = `Para trocar um exercício, escolha uma opção que trabalhe o mesmo grupo muscular e respeite suas limitações atuais. Se sentir dor ou desconforto, pare imediatamente!`;
  } else if (lcMsg.includes('água') || lcMsg.includes('beber água') || lcMsg.includes('hidratação')) {
    localReply = `A hidratação é fundamental para o seu desempenho e recuperação. Tente beber água regularmente ao longo do dia, ajustando conforme sua sede e o volume de treino.`;
  } else if (lcMsg.includes('sono') || lcMsg.includes('dormir') || lcMsg.includes('descanso')) {
    localReply = `Uma boa noite de sono (entre 7 e 8 horas) é essencial para a recuperação muscular e para manter a energia em dia. Tente descansar bem!`;
  }

  if (localReply) {
    return resposta(event, 200, { reply: localReply, role, model: 'local-cache' });
  }

  // 3. Cache de 24h por pergunta normalizada + contexto resumido no Firestore (ou Map em memória como fallback rápido)
  const normMsg = lcMsg.replace(/[^a-z0-9]/g, '_').slice(0, 100);
  const cacheKey = `${auth.uid}_${role}_${normMsg}_${contexto.slice(0, 50)}`;
  // Usamos cache em memória ou Firestore. Como o acesso tem Map, podemos usar um cache global ou verificar no Firestore se db estiver disponível.
  // Vamos usar um Map estático simples com expiração de 24h para atender ao requisito de cache de forma robusta e rápida.
  if (!global.__bcAiCache) global.__bcAiCache = new Map();
  const cachedItem = global.__bcAiCache.get(cacheKey);
  const now = Date.now();
  if (cachedItem && cachedItem.exp > now) {
    return resposta(event, 200, { reply: cachedItem.text, role, model: cachedItem.model });
  }

  const router = getRouter();
  let lastErrorMsg = '';
  for (const d of useModels) {
    try {
      const cap = router.capabilities(d);
      if (!cap.available || (images && !cap.vision)) continue;
      // Cada modelo tem 12 s; se demorar, passa logo para o próximo (nunca deixa o aluno esperando no vazio).
      const out = await Promise.race([router.chat(d, { system, messages: mensagens, maxTokens: images ? 1200 : receita ? 2000 : 700, ...(images ? { images } : {}) }), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000))]);
      if (out && out.text) {
        global.__bcAiCache.set(cacheKey, { text: out.text, model: d.model, exp: now + 24 * 3600000 });
        return resposta(event, 200, { reply: out.text, role, model: d.model });
      }
    } catch (err) { lastErrorMsg = err.message; /* tenta o próximo modelo */ }
  }

  // 4. Se todos os modelos grátis falharem: resposta local útil + "tente de novo em alguns minutos", nunca erro em branco.
  const fallbackReply = `Estou com dificuldades técnicas no momento para acessar a IA, mas lembre-se de manter o foco na sua constância, hidratação e descanso. Tente de novo em alguns minutos!`;
  return resposta(event, 200, { reply: fallbackReply, role, model: 'fallback-local' });
};
