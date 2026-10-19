'use strict';
// Calendário semanal fixo + texto com gancho, chamada para ação e hashtags de nicho (grátis, sem IA).

const SEMANA = [
  { dia: 'domingo', tema: 'teste-gratis', assunto: 'comece o teste grátis hoje, sem cartão', cta: 'Link na bio e comece o teste grátis' },
  { dia: 'segunda', tema: 'dica-treino', assunto: 'uma dica prática de treino para a semana', cta: 'Salve este post e comente QUERO para receber o app' },
  { dia: 'terça', tema: 'recurso', assunto: 'um recurso do app que poupa tempo (treino, dieta ou fotos)', cta: 'Comente QUERO e te mando o link' },
  { dia: 'quarta', tema: 'desafio', assunto: 'o Desafio de 30 dias #DesafioBodyCoach', cta: 'Marque um amigo e comente EU VOU' },
  { dia: 'quinta', tema: 'antes-depois', assunto: 'a evolução de quem treina com acompanhamento (antes e depois)', cta: 'Link na bio: monte o seu treino' },
  { dia: 'sexta', tema: 'oferta-loja', assunto: 'as ofertas fitness da semana na Loja do app', cta: 'Link na bio e veja as ofertas' },
  { dia: 'sábado', tema: 'meme', assunto: 'um meme fitness leve e divertido', cta: 'Marque quem precisa ver isso' },
];

/** Tema do dia (fuso de Brasília). */
function temaDoDia(data = new Date()) {
  const br = new Date(data.getTime() - 3 * 3600 * 1000);
  return SEMANA[br.getUTCDay()];
}

/** Próximos 7 temas com horários de postagem (7h15, 12h15, 19h15). */
function proximos7Temas(data = new Date()) {
  const br = new Date(data.getTime() - 3 * 3600 * 1000);
  const hoje = br.getUTCDay();
  const temas = [];
  
  for (let i = 0; i < 7; i++) {
    const diaIndex = (hoje + i) % 7;
    const dia = SEMANA[diaIndex];
    const dataPostagem = new Date(br);
    dataPostagem.setDate(br.getDate() + i);
    
    temas.push({
      dia: dia.dia,
      tema: dia.tema,
      assunto: dia.assunto,
      cta: dia.cta,
      data: dataPostagem.toISOString().split('T')[0],
      horarios: ['07:15', '12:15', '19:15']
    });
  }
  
  return temas;
}

const GANCHOS = {
  'dica-treino': 'Pare de errar isso no treino:',
  recurso: 'Isso muda a sua semana de treino:',
  desafio: '30 dias. Você topa?',
  'antes-depois': 'Olha o que 8 semanas fazem:',
  'oferta-loja': 'Achados fitness com preço bom:',
  meme: 'Quem treina entende:',
  'teste-gratis': 'Domingo é dia de começar:',
};

const NICHO = ['#treino', '#academia', '#dieta', '#fitness', '#personaltrainer', '#musculacao', '#vidasaudavel', '#emagrecimento', '#treinoemcasa', '#foco', '#hipertrofia', '#saude'];

/** 5 a 10 hashtags: as do cliente primeiro, completa com as de nicho; sem repetir. */
function hashtagsNicho(cliente = {}, extra = []) {
  const vistos = new Set();
  const lista = [];
  for (const h of [...extra, ...(cliente.hashtagsInstagram || []), ...(cliente.hashtags || []), ...NICHO]) {
    const k = String(h).toLowerCase();
    if (/^#[\p{L}\d_]{2,40}$/u.test(h) && !vistos.has(k)) { vistos.add(k); lista.push(h); }
  }
  return lista.slice(0, 10);
}

/** Gancho na 1ª linha + corpo + CTA + hashtags. `corpo` vem da IA ou do assunto. */
function montarLegenda(cliente, tema, corpo) {
  const t = typeof tema === 'string' ? SEMANA.find(s => s.tema === tema) || SEMANA[1] : tema;
  const texto = String(corpo || `${cliente.nome}: ${t.assunto}.`).replace(/\s+/g, ' ').trim();
  const extra = t.tema === 'desafio' ? ['#DesafioBodyCoach'] : [];
  return `${GANCHOS[t.tema] || GANCHOS['dica-treino']}\n\n${texto}\n\n${t.cta}.\n\n${hashtagsNicho(cliente, extra).join(' ')}`;
}

module.exports = { SEMANA, temaDoDia, hashtagsNicho, montarLegenda, GANCHOS, proximos7Temas };
