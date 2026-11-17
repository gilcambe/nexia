'use strict';
/**
 * Kernex Finance: score de crédito (Serasa, SPC, Boa Vista) lido de print ou digitado.
 * Não existe API grátis para pessoa física e o app nunca pede senha: o usuário manda o print e confere.
 * Dados só em c.base.collection('scores') (a área do usuário), com histórico. Nada em arquivo.
 */
const { lerPorImagens, numero, texto } = require('./leitor');

const BIROS = { serasa: 'Serasa', spc: 'SPC', boavista: 'Boa Vista' };
const DATA = /^\d{4}-\d{2}-\d{2}$/;

// Faixas (score 0 a 1000). Serasa: faixas oficiais do Serasa Score (baixo, regular, bom, excelente).
// SUPOSIÇÃO: SPC Brasil e Boa Vista usam faixas parecidas, mas não confirmei os cortes exatos de cada um;
// por isso as faixas deles são marcadas como estimativa (suposicao: true) e têm 5 degraus.
const FAIXAS = {
  serasa: [[300, 'baixo'], [500, 'regular'], [700, 'bom'], [1000, 'excelente']],
  spc: [[200, 'baixo'], [400, 'regular'], [600, 'bom'], [800, 'muito bom'], [1000, 'excelente']],
  boavista: [[200, 'baixo'], [400, 'regular'], [600, 'bom'], [800, 'muito bom'], [1000, 'excelente']],
};
function faixaDe(biro, score) {
  const tab = FAIXAS[biro];
  if (!tab || !Number.isFinite(score)) return null;
  const f = tab.find(([max]) => score <= max) || tab[tab.length - 1];
  return { nome: f[1], suposicao: biro !== 'serasa' };
}

const DICAS = [
  'Pague as contas em dia: atraso é o que mais derruba o score.',
  'Negocie e quite dívidas em aberto; nome limpo ajuda muito.',
  'Não use todo o limite do cartão: tente ficar abaixo de 30% do limite.',
  'Mantenha seu cadastro atualizado (endereço, telefone e renda) nos birôs.',
  'Evite pedir crédito em muitos lugares ao mesmo tempo.',
  'Cadastre-se no Cadastro Positivo: o bom pagador ganha pontos.',
];
/** 3 dicas simples. Faixa baixa/regular começa por quitar dívidas; faixa alta por manter o hábito. */
function dicasPara(faixa) {
  const baixa = !faixa || faixa === 'baixo' || faixa === 'regular';
  const ordem = baixa ? [1, 0, 2, 5, 3, 4] : [0, 2, 5, 4, 3, 1];
  return ordem.slice(0, 3).map((i) => DICAS[i]);
}

const LER_SCORE = `Você lê UM print do app ou site de score de crédito brasileiro (Serasa, SPC Brasil ou Boa Vista). Responda SÓ com JSON:
{"biro":"serasa|spc|boavista","score":0,"data":"AAAA-MM-DD"}
biro = qual empresa é (pela marca na tela); score = a pontuação de 0 a 1000; data = data da consulta se aparecer, senão "".
Não copie CPF, nome da pessoa nem outros dados pessoais.`;

function validarScore(o, hoje) {
  const biro = texto(o && o.biro, 20).toLowerCase().replace(/[\s_-]/g, '');
  const chave = biro === 'boavista' || biro === 'scpc' || biro === 'boavistascpc' ? 'boavista' : biro;
  if (!BIROS[chave]) return { ok: false, erro: 'Diga o birô: Serasa, SPC ou Boa Vista.' };
  const s = numero(o.score);
  if (!Number.isFinite(s) || !Number.isInteger(s) || s < 0 || s > 1000) return { ok: false, erro: 'O score é um número inteiro de 0 a 1000.' };
  const data = texto(o.data, 10) || hoje;
  if (!DATA.test(data)) return { ok: false, erro: 'Diga a data no formato AAAA-MM-DD.' };
  if (data > hoje) return { ok: false, erro: 'A data do score não pode ser no futuro.' };
  return { ok: true, item: { biro: chave, score: s, data } };
}

/** Resumo por birô a partir do histórico: último, anterior, variação, faixa e dicas. */
function resumirScores(lista) {
  const por_biro = {};
  for (const chave of Object.keys(BIROS)) {
    const hist = lista.filter((x) => x.biro === chave).sort((a, b) => String(b.data).localeCompare(String(a.data)));
    if (!hist.length) continue;
    const ultimo = hist[0]; const anterior = hist[1] || null;
    const faixa = faixaDe(chave, ultimo.score);
    por_biro[chave] = { biro: chave, nome: BIROS[chave], score: ultimo.score, data: ultimo.data, faixa: faixa.nome, faixa_suposicao: faixa.suposicao,
      anterior: anterior ? anterior.score : null, variacao: anterior ? ultimo.score - anterior.score : null, historico: hist.map((x) => ({ data: x.data, score: x.score })) };
  }
  const lista_biros = Object.values(por_biro);
  const pior = lista_biros.map((x) => x.faixa).find((f) => f === 'baixo' || f === 'regular') || (lista_biros[0] && lista_biros[0].faixa) || null;
  return { por_biro, dicas: dicasPara(pior) };
}

async function agirScore(acao, body, c) {
  if (!['score_print_ler', 'score_salvar', 'score_listar'].includes(acao)) return null;
  const hoje = c.agoraIso.slice(0, 10);
  switch (acao) {
    case 'score_print_ler': return lerPorImagens(c, body, LER_SCORE, (j) => validarScore({ ...j, data: j.data || hoje }, hoje), 'score');
    case 'score_salvar': {
      const v = validarScore(body, hoje);
      if (!v.ok) return [400, { error: v.erro }];
      const id = `${v.item.biro}_${v.item.data}`;
      await c.base.collection('scores').doc(id).set({ ...v.item, atualizado_em: c.agoraIso });
      return [200, { ok: true, id, ...resumirScores(await c.listar(c.base.collection('scores'))) }];
    }
    case 'score_listar': return [200, { biros: BIROS, ...resumirScores(await c.listar(c.base.collection('scores'))), aviso: 'Não existe consulta automática grátis: o score vem do print que você mandar. O app nunca pede sua senha.' }];
    default: return null;
  }
}

module.exports = { agirScore, validarScore, faixaDe, resumirScores, dicasPara, BIROS };
