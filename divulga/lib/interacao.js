'use strict';
// Lista semanal para o dono interagir à mão (comentar com gosto, sem spam) e roteiro de collabs.
// Não inventa perfis: dá hashtags, buscas e o tipo de perfil; o dono escolhe os reais no Instagram.

const HASHTAGS = ['#personaltrainer', '#treinoemcasa', '#musculacao', '#emagrecimento', '#dietaflexivel', '#hipertrofia', '#vidasaudavel', '#academia',
  '#fitnessbrasil', '#treinofeminino', '#corrida', '#crossfit', '#nutricaoesportiva', '#receitasfit', '#marombeiros', '#fitmoms', '#saudeebemestar', '#habitosaudavel'];
const TIPOS = [
  'personal trainer pequeno da sua cidade (até 5 mil seguidores)',
  'nutricionista que posta receitas simples',
  'pessoa que mostra a própria evolução de 3 a 12 meses',
  'academia de bairro ou studio de treino funcional',
  'grupo de corrida de rua',
];
const COMENTARIOS = [
  'Gostei muito desse treino! Qual a série que você mais indica para iniciantes?',
  'Que evolução! Quanto tempo de treino até aqui?',
  'Receita boa e simples. Você tem uma versão com mais proteína?',
  'Parabéns pela constância! Qual foi a maior dificuldade no começo?',
];

const semana = (hoje = new Date()) => Math.floor(hoje.getTime() / (7 * 86400000));
const gira = (lista, n, k) => Array.from({ length: Math.min(k, lista.length) }, (_, i) => lista[(n + i) % lista.length]);

/** 20 itens da semana: 12 hashtags para olhar e comentar + 8 buscas por tipo de perfil. */
function listaSemanal(hoje = new Date()) {
  const n = semana(hoje);
  const hs = gira(HASHTAGS, n * 3, 12).map(h => ({ tipo: 'hashtag', alvo: h, fazer: 'Abra a hashtag, vá em "Recentes" e comente com carinho em 3 posts (sem copiar e colar).' }));
  const ps = [];
  for (let i = 0; i < 8; i++) ps.push({ tipo: 'perfil', alvo: TIPOS[(n + i) % TIPOS.length], fazer: `Procure por "${gira(HASHTAGS, n + i, 1)[0]}" ou pela cidade e escolha 1 perfil real desse tipo. Curta e comente algo específico.` });
  return { semana: n, itens: [...hs, ...ps], comentarios: COMENTARIOS };
}

/** Convite pronto para colar na DM de um personal pequeno (collab). */
function conviteCollab(nome = '') {
  const a = nome ? `Oi, ${nome}!` : 'Oi!';
  return `${a} Sou do Body Coach, um app de treino e dieta com IA (teste grátis). Gostei do seu trabalho e queria te propor uma collab: um post a quatro mãos (você mostra um treino seu, eu mostro como ele fica no app) com marcação mútua. Sem custo nenhum. Topa conversar? 💪`;
}

function roteiroCollabs() {
  return [
    { passo: 1, titulo: 'Escolha 3 personais pequenos reais', texto: 'Perfis com 500 a 5 mil seguidores, que postam treino e respondem comentários.' },
    { passo: 2, titulo: 'Interaja por 3 dias', texto: 'Curta e comente em 2 posts por dia antes de mandar a mensagem.' },
    { passo: 3, titulo: 'Mande o convite', texto: conviteCollab('(nome)') },
    { passo: 4, titulo: 'Combine o post', texto: 'Carrossel a quatro mãos: 1 treino do personal + 1 tela do app. Os dois marcam um ao outro.' },
  ];
}

module.exports = { listaSemanal, conviteCollab, roteiroCollabs, HASHTAGS };
