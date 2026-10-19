'use strict';
// Roteirista do Divulga: roteiro de carrossel (gancho, 5 a 7 telas, CTA, legenda, hashtags e pergunta).
// Pede JSON à IA grátis (Groq, depois Gemini) e valida. Sem chave, sem internet ou com JSON ruim,
// usa um modelo fixo por série preenchido com os assuntos do cliente. Nunca para.
const { groq, gemini } = require('./texto');
const { temaDoDia } = require('./calendario');

const SERIES = ['3-erros', 'mito-verdade', 'passo-a-passo', 'antes-depois', 'checklist', 'pergunta-enquete', 'bastidores'];
const LIMITES = { telasMin: 5, telasMax: 7, titulo: 40, texto: 120, legenda: 900, gancho: 80, cta: 90, pergunta: 90, hashtags: 8 };

/** Tema do dia do calendário semanal -> série do carrossel. */
const SERIE_DO_TEMA = {
  'dica-treino': '3-erros',
  recurso: 'passo-a-passo',
  desafio: 'checklist',
  'antes-depois': 'antes-depois',
  'oferta-loja': 'mito-verdade',
  meme: 'bastidores',
  'teste-gratis': 'pergunta-enquete',
};

const serieDoDia = (data = new Date()) => SERIE_DO_TEMA[temaDoDia(data).tema] || SERIES[0];

const limpa = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
/** Corta no limite sem quebrar palavra no meio (quando dá). */
function corta(s, n) {
  const t = limpa(s);
  if (t.length <= n) return t;
  const c = t.slice(0, n - 1);
  const i = c.lastIndexOf(' ');
  return `${(i > n * 0.6 ? c.slice(0, i) : c).replace(/[\s,;:.-]+$/, '')}…`;
}

/** Sem promessa de resultado (regra de saúde/publicidade): tira "garantido", "cura", "perca X kg"... */
const semPromessa = t => String(t)
  .replace(/\b(resultados?\s+)?garantid[oa]s?\b/gi, '')
  .replace(/\b100\s*%\s*(eficaz|garantido|certo)\b/gi, '')
  .replace(/\b(cura|curar|curou)\b/gi, 'cuida')
  .replace(/\b(perca|perder|emagre\p{L}*)\s+\d+\s*(kg|quilos?)\b/giu, 'cuidar do corpo')
  .replace(/[ \t]{2,}/g, ' ')
  .replace(/ +([,.!?])/g, '$1');

/** "Link na bio" no máximo uma vez. */
function umaBio(t) {
  let visto = false;
  return String(t).replace(/(pelo\s+)?link na bio\.?/gi, m => { if (visto) return ''; visto = true; return m; }).replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const ehHashtag = h => /^#[\p{L}\d_]{2,40}$/u.test(h);
const GENERICAS = ['#dicas', '#novidade', '#brasil', '#conteudo', '#qualidade', '#inspiracao', '#aprenda', '#vida'];

/** 8 hashtags: 3 grandes do nicho + 3 médias (do cliente primeiro, depois da IA) + 2 da marca/cidade. */
function hashtagsRoteiro(cliente = {}, daIA = []) {
  const vistos = new Set();
  const add = (lista, h) => { const t = limpa(h).replace(/^([^#])/, '#$1'); const k = t.toLowerCase(); if (ehHashtag(t) && !vistos.has(k)) { vistos.add(k); lista.push(t); } };
  const marcaSlug = slug(cliente.nome);
  const marca = [];
  for (const h of [`#${marcaSlug}`, cliente.cidade && `#${slug(cliente.cidade)}`, cliente.instagram && `#${slug(cliente.instagram)}`].filter(Boolean)) if (marca.length < 2) add(marca, h);
  const nicho = [];
  const doCliente = (cliente.hashtags || []).concat(cliente.hashtagsInstagram || []);
  for (const h of [...doCliente, ...(Array.isArray(daIA) ? daIA : []), ...GENERICAS]) if (nicho.length < LIMITES.hashtags - marca.length) add(nicho, h);
  return [...nicho, ...marca].slice(0, LIMITES.hashtags);
}

/** Pega o i-ésimo assunto do cliente (repete se tiver poucos). */
const assuntoDe = (cliente, i) => {
  const a = (cliente.assuntos || []).filter(Boolean);
  return a.length ? a[i % a.length] : cliente.nome || 'nosso trabalho';
};
const Maiusc = s => { const t = limpa(s); return t.charAt(0).toUpperCase() + t.slice(1); };

/** Modelos fixos por série (funcionam sem IA). */
const MODELOS = {
  '3-erros': c => ({
    gancho: `3 erros que atrapalham quem busca ${assuntoDe(c, 0)}`,
    telas: [
      { titulo: 'Erro 1', texto: `Deixar ${assuntoDe(c, 0)} para depois e nunca começar.` },
      { titulo: 'Erro 2', texto: `Ignorar ${assuntoDe(c, 1)}.` },
      { titulo: 'Erro 3', texto: `Fazer tudo sozinho sem orientação sobre ${assuntoDe(c, 2)}.` },
      { titulo: 'O que fazer', texto: `Comece pequeno, com constância e com quem entende de ${assuntoDe(c, 0)}.` },
      { titulo: `Com a ${c.nome}`, texto: `${Maiusc(assuntoDe(c, 3))}, do jeito certo.` },
    ],
    cta: 'Salve e mande para quem precisa ver isso',
    pergunta: 'Qual desses erros você já cometeu?',
  }),
  'mito-verdade': c => ({
    gancho: `Mito ou verdade sobre ${assuntoDe(c, 0)}?`,
    telas: [
      { titulo: 'Mito', texto: `"${Maiusc(assuntoDe(c, 0))} é só para poucos."` },
      { titulo: 'Verdade', texto: `Com orientação, ${assuntoDe(c, 0)} fica ao alcance de muito mais gente.` },
      { titulo: 'Mito', texto: `"${Maiusc(assuntoDe(c, 1))} dá trabalho demais."` },
      { titulo: 'Verdade', texto: `Com método, ${assuntoDe(c, 1)} cabe na sua rotina.` },
      { titulo: 'Na prática', texto: `Na ${c.nome}: ${assuntoDe(c, 2)}.` },
    ],
    cta: 'Salve para lembrar e compartilhe com um amigo',
    pergunta: 'Você acreditava em algum desses mitos?',
  }),
  'passo-a-passo': c => ({
    gancho: `Passo a passo: ${assuntoDe(c, 0)}`,
    telas: [
      { titulo: 'Passo 1', texto: 'Defina o que você quer e por quê.' },
      { titulo: 'Passo 2', texto: `Conheça as opções: ${assuntoDe(c, 1)}.` },
      { titulo: 'Passo 3', texto: `Escolha quem cuida de ${assuntoDe(c, 2)} com você.` },
      { titulo: 'Passo 4', texto: 'Acompanhe de perto e ajuste no caminho.' },
      { titulo: 'Passo 5', texto: `Comece hoje com a ${c.nome}.` },
    ],
    cta: 'Salve este passo a passo para usar depois',
    pergunta: 'Em qual passo você está agora?',
  }),
  'antes-depois': c => ({
    gancho: `Antes e depois de ${assuntoDe(c, 0)}`,
    telas: [
      { titulo: 'Antes', texto: 'Tudo espalhado, sem plano e sem acompanhamento.' },
      { titulo: 'O ponto de virada', texto: `Conhecer ${assuntoDe(c, 0)}.` },
      { titulo: 'Depois', texto: `${Maiusc(assuntoDe(c, 1))}, com clareza e no seu ritmo.` },
      { titulo: 'O que mudou', texto: `${Maiusc(assuntoDe(c, 2))}.` },
      { titulo: 'Sua vez', texto: `A ${c.nome} te ajuda a dar o primeiro passo.` },
    ],
    cta: 'Comente EU QUERO para saber como começar',
    pergunta: 'O que você quer mudar primeiro?',
  }),
  checklist: c => ({
    gancho: `Checklist: você já tem isso?`,
    telas: [
      { titulo: 'Item 1', texto: `${Maiusc(assuntoDe(c, 0))}.` },
      { titulo: 'Item 2', texto: `${Maiusc(assuntoDe(c, 1))}.` },
      { titulo: 'Item 3', texto: `${Maiusc(assuntoDe(c, 2))}.` },
      { titulo: 'Item 4', texto: `${Maiusc(assuntoDe(c, 3))}.` },
      { titulo: 'Faltou algum?', texto: `A ${c.nome} cuida disso com você.` },
    ],
    cta: 'Salve o checklist e marque quem precisa',
    pergunta: 'Quantos itens você já marcou?',
  }),
  'pergunta-enquete': c => ({
    gancho: `Responda rápido: o que mais importa para você?`,
    telas: [
      { titulo: 'Opção A', texto: `${Maiusc(assuntoDe(c, 0))}.` },
      { titulo: 'Opção B', texto: `${Maiusc(assuntoDe(c, 1))}.` },
      { titulo: 'Opção C', texto: `${Maiusc(assuntoDe(c, 2))}.` },
      { titulo: 'Por que perguntamos', texto: 'Queremos criar conteúdo útil de verdade para você.' },
      { titulo: 'Conta pra gente', texto: `Na ${c.nome}, a sua resposta vira o próximo post.` },
    ],
    cta: 'Comente A, B ou C',
    pergunta: 'Qual é a sua: A, B ou C?',
  }),
  bastidores: c => ({
    gancho: `Bastidores da ${c.nome}`,
    telas: [
      { titulo: 'Como começa', texto: `Tudo começa ouvindo você: ${assuntoDe(c, 0)}.` },
      { titulo: 'O cuidado', texto: `${Maiusc(assuntoDe(c, 1))}.` },
      { titulo: 'Os detalhes', texto: `${Maiusc(assuntoDe(c, 2))}.` },
      { titulo: 'Quem faz', texto: 'Gente que gosta do que faz, em cada etapa.' },
      { titulo: 'O resultado', texto: 'Um trabalho feito com atenção, do começo ao fim.' },
    ],
    cta: 'Siga para ver mais bastidores',
    pergunta: 'O que você quer ver nos próximos bastidores?',
  }),
};

/** Legenda: gancho > valor > CTA > pergunta, até 900 caracteres, sem promessa e com no máximo 1 "link na bio". */
function montarLegendaRoteiro({ gancho, valor, cta, pergunta }) {
  const fim = `\n\n${limpa(cta).replace(/[.!]*$/, '.')}\n\n${pergunta}`;
  const ini = `${gancho}\n\n`;
  const sobra = LIMITES.legenda - ini.length - fim.length;
  const corpo = sobra > 20 ? corta(valor, sobra) : '';
  return umaBio(semPromessa(`${ini}${corpo}${fim}`)).slice(0, LIMITES.legenda);
}

/** Normaliza qualquer roteiro (da IA ou fixo) dentro dos limites. Devolve null se não tiver o mínimo. */
function normalizar(bruto, cliente, serie) {
  if (!bruto || typeof bruto !== 'object' || !Array.isArray(bruto.telas)) return null;
  const telas = bruto.telas
    .filter(t => t && typeof t === 'object' && limpa(t.titulo) && limpa(t.texto))
    .slice(0, LIMITES.telasMax)
    .map(t => ({ titulo: corta(semPromessa(t.titulo), LIMITES.titulo), texto: corta(semPromessa(t.texto), LIMITES.texto) }));
  const gancho = corta(semPromessa(bruto.gancho), LIMITES.gancho);
  if (telas.length < LIMITES.telasMin || !gancho) return null;
  const cta = corta(umaBio(semPromessa(bruto.cta || 'Salve e compartilhe')), LIMITES.cta);
  let pergunta = corta(semPromessa(bruto.pergunta || 'E você, o que acha?'), LIMITES.pergunta);
  if (!/\?$/.test(pergunta)) pergunta = `${pergunta.replace(/[.!…]+$/, '')}?`;
  const valor = limpa(bruto.legenda) && limpa(bruto.legenda).length >= 40
    ? limpa(bruto.legenda).replace(limpa(bruto.gancho), '').replace(pergunta, '').trim()
    : telas.map(t => `${t.titulo}: ${t.texto}`).join(' ');
  return {
    serie,
    gancho,
    telas,
    cta,
    legenda: montarLegendaRoteiro({ gancho, valor, cta, pergunta }),
    hashtags: hashtagsRoteiro(cliente, bruto.hashtags),
    pergunta,
  };
}

/** Modelo fixo da série (sem IA). Sempre devolve um roteiro válido. */
const roteiroFixo = (cliente, serie) => normalizar(MODELOS[serie](cliente), cliente, serie);

const pedidoRoteiro = (c, serie) =>
  `Crie o roteiro de um carrossel de Instagram em português do Brasil para "${c.nome}" (${(c.assuntos || []).slice(0, 6).join('; ')}). ` +
  `Série: ${serie}. Responda SÓ com JSON, sem texto fora dele, no formato ` +
  '{"gancho":"..","telas":[{"titulo":"..","texto":".."}],"cta":"..","legenda":"..","hashtags":["#.."],"pergunta":".."}. ' +
  `Regras: 5 a 7 telas; título até ${LIMITES.titulo} caracteres; texto até ${LIMITES.texto}; legenda até 700 caracteres ` +
  '(gancho, valor, chamada, pergunta); sem link; sem promessa de resultado de saúde ou dinheiro; hashtags em português.';

/** Tira o JSON de dentro da resposta da IA (aceita ```json ... ```). */
function lerJson(texto) {
  const t = String(texto || '');
  const i = t.indexOf('{');
  const f = t.lastIndexOf('}');
  if (i < 0 || f <= i) return null;
  try { return JSON.parse(t.slice(i, f + 1)); } catch { return null; }
}

/**
 * Roteiro de carrossel do cliente.
 * @returns {Promise<{serie:string,gancho:string,telas:{titulo:string,texto:string}[],cta:string,legenda:string,hashtags:string[],pergunta:string,fonte:'ia'|'modelo'}>}
 */
async function roteiro(cliente, { serie, env = {}, fetchImpl = fetch, log = () => {}, data } = {}) {
  const s = SERIES.includes(serie) ? serie : serieDoDia(data);
  const prompt = pedidoRoteiro(cliente, s);
  const fontes = [
    env.GROQ_API_KEY && (() => groq(prompt, env, fetchImpl, { maxTokens: 1200 })),
    env.GEMINI_API_KEY && (() => gemini(prompt, env, fetchImpl)),
  ].filter(Boolean);
  for (const f of fontes) {
    try {
      const r = normalizar(lerJson(await f()), cliente, s);
      if (r) return { ...r, fonte: 'ia' };
      log('IA devolveu roteiro inválido; tentando a próxima.');
    } catch (e) { log(`IA falhou: ${e.message}`); }
  }
  return { ...roteiroFixo(cliente, s), fonte: 'modelo' };
}

module.exports = { roteiro, roteiroFixo, normalizar, hashtagsRoteiro, serieDoDia, SERIES, LIMITES };
