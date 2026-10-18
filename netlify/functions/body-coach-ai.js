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

  const router = getRouter();
  // Regra do dono: o Body Coach só usa IA grátis, mesmo que alguém configure a chave paga da Anthropic.
  for (const d of listFor('fast').filter((x) => x.provider !== 'anthropic')) {
    try {
      const cap = router.capabilities(d);
      if (!cap.available || (images && !cap.vision)) continue;
      // Cada modelo tem 12 s; se demorar, passa logo para o próximo (nunca deixa o aluno esperando no vazio).
      const out = await Promise.race([router.chat(d, { system, messages: mensagens, maxTokens: images ? 1200 : receita ? 2000 : 700, ...(images ? { images } : {}) }), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000))]);
      if (out && out.text) return resposta(event, 200, { reply: out.text, role, model: d.model });
    } catch { /* tenta o próximo modelo */ }
  }
  return resposta(event, 503, { error: 'A equipe está indisponível agora. Tente de novo em alguns minutos.' });
};
