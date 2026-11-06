'use strict';
/**
 * Kernex Finance, fase 5: assistente. Entende pedidos por regras fixas (sem IA inventando números):
 * - PERGUNTAS são respondidas só com os números do motor, sempre dizendo a fonte, o mês e o que falta;
 * - COMANDOS ("registre uma despesa...", "crie um limite...") só viram uma PROPOSTA. Nada é gravado
 *   até a pessoa confirmar (ação assistente_confirmar). Nunca paga, transfere, resgata nem investe.
 */
const crypto = require('crypto');
const { totais, chave } = require('./motor');
const cartoes = require('./cartoes');
const fin = require('./financas');
const { CATEGORIAS_KF } = require('./documentos');

const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const fmt = (n) => 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NOME = { moradia: 'Moradia', alimentacao: 'Alimentação', transporte: 'Transporte', saude: 'Saúde', educacao: 'Educação', familia: 'Família', lazer: 'Lazer', compras: 'Compras', assinaturas: 'Assinaturas', financeiro: 'Financeiro', impostos: 'Impostos', investimentos: 'Investimentos', outros: 'Outros' };
const SINONIMOS = { mercado: 'alimentacao', supermercado: 'alimentacao', comida: 'alimentacao', restaurante: 'alimentacao', delivery: 'alimentacao', lanche: 'alimentacao', aluguel: 'moradia', condominio: 'moradia', casa: 'moradia', uber: 'transporte', gasolina: 'transporte', combustivel: 'transporte', onibus: 'transporte',
  farmacia: 'saude', remedio: 'saude', medico: 'saude', escola: 'educacao', curso: 'educacao', cinema: 'lazer', viagem: 'lazer', streaming: 'assinaturas', roupa: 'compras', roupas: 'compras' };

function categoriaDe(t) {
  const x = sem(t).replace(/[^a-z\s]/g, ' ');
  for (const c of CATEGORIAS_KF) if (new RegExp(`\\b${c}\\b`).test(x)) return c;
  for (const [k, c] of Object.entries(SINONIMOS)) if (new RegExp(`\\b${k}\\b`).test(x)) return c;
  return null;
}
function valorDe(t) {
  const m = /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?|\d+\.\d{1,2})/.exec(String(t).toLowerCase());
  if (!m) return NaN;
  let s = m[1];
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); else if (/\.\d{3}/.test(s)) s = s.replace(/\./g, '');
  return Number(s);
}

/** Texto -> proposta de comando, ou null. */
function parseComando(texto) {
  const t = sem(texto);
  let m = /\b(registre|registrar|anote|anotar|lance|lancar|adicione|adicionar)\b.*\b(despesa|gasto)\b(.*)$/.exec(t);
  if (m) {
    const valor = valorDe(m[3]);
    if (!(valor > 0)) return { erro: 'Qual o valor da despesa? Exemplo: "registre uma despesa de R$ 50 em alimentação".' };
    const categoria = categoriaDe(m[3]) || 'outros';
    const resto = m[3].replace(/r\$\s*[\d.,]+|\d[\d.,]*/g, ' ').replace(/\b(de|em|com|no|na|para|uma|um|reais|real)\b/g, ' ').replace(/\s+/g, ' ').trim();
    return { tipo: 'registrar_despesa', valor, categoria, descricao: resto && !CATEGORIAS_KF.includes(resto) ? resto : NOME[categoria] };
  }
  m = /\b(crie|criar|defina|definir|coloque|colocar|estabeleca)\b.*\blimite\b(.*)$/.exec(t);
  if (m) {
    const valor = valorDe(m[2]); const categoria = categoriaDe(m[2]);
    if (!(valor > 0) || !categoria) return { erro: 'Diga o valor e a categoria. Exemplo: "crie um limite de R$ 300 para lazer".' };
    return { tipo: 'criar_limite', valor, categoria };
  }
  if (/\b(pague|pagar|transfira|transferir|resgate|resgatar|invista|investir|compre|comprar)\b/.test(t) && /\b(r\$|\d)/.test(t)) return { erro: 'Eu não faço pagamentos, transferências, resgates nem investimentos. Posso registrar uma despesa, criar um limite ou simular se a compra cabe.' };
  return null;
}
const descreve = (p) => (p.tipo === 'registrar_despesa' ? `Registrar uma despesa de ${fmt(p.valor)} em ${NOME[p.categoria]} (${p.descricao}), com a data de hoje.` : `Criar o limite mensal de ${fmt(p.valor)} para ${NOME[p.categoria]}.`);

/** Pergunta -> resposta só com números reais, com fonte. null se não entendi. */
function responder(texto, d) {
  const t = sem(texto); const fonteMes = `lançamentos confirmados de ${d.mes}`;
  const r = (resposta, fonte, falta = []) => ({ resposta, fonte, atualizado_em: d.agoraIso, falta });
  let m;
  if (/\bsaldo\b|\bdinheiro disponivel\b|^quanto (eu )?tenho( disponivel)?( hoje)?( em conta)?\??$/.test(t) && !/milha|ponto|investi|patrimonio/.test(t))
    return d.saldo === null ? r('Ainda não sei: você não cadastrou nenhuma conta.', 'contas', ['contas']) : r(`Você tem ${fmt(d.saldo)} disponíveis em conta (só reais; limite de cartão não conta).`, 'saldos das contas que você cadastrou');
  if ((m = /quanto (eu )?gastei (com|em|no|na|de)\s+(.+?)(?:\s+(este|neste|nesse|no)\s+mes)?\??$/.exec(t))) {
    const c = categoriaDe(m[3]);
    if (!c) return r(`Não reconheci a categoria "${m[3]}". As categorias são: ${Object.values(NOME).join(', ')}.`, 'categorias do Kernex Finance');
    return r(`Em ${NOME[c]} você gastou ${fmt(d.por_categoria[c] || 0)} em ${d.mes}.`, fonteMes, d.qtd ? [] : ['lançamentos (envie uma fatura ou extrato)']);
  }
  if (/maior (despesa|gasto)/.test(t)) {
    if (!d.maior) return r('Ainda não há despesas confirmadas neste mês.', fonteMes, ['lançamentos']);
    return r(`Sua maior despesa em ${d.mes} foi "${d.maior.descricao}": ${fmt(d.maior.valor)} em ${d.maior.data.split('-').reverse().join('/')}.`, fonteMes);
  }
  if (/quanto (eu )?(devo|tenho (de|em)? ?(fatura|divida)).*cart|fatura/.test(t) || /quanto devo nos cart/.test(t))
    return r(`Seus cartões têm ${fmt(d.comprometido)} comprometidos (estimativa: soma as parcelas do mês em diante, sem saber o que já foi pago).`, 'compras e parcelas lançadas nos cartões', d.temCartao ? [] : ['cartões']);
  if (/patrimonio/.test(t)) return d.dividasConhecidas
    ? r(`Seu patrimônio líquido é ${fmt(d.patrimonio)} (contas em reais + investimentos${d.dividaTotal ? ' − dívidas de ' + fmt(d.dividaTotal) : ', sem dívidas'}).`, 'contas, carteira e dívidas')
    : r(`Seu patrimônio líquido é ${fmt(d.patrimonio)} (contas em reais + investimentos). Dívidas ainda não estão cadastradas, então não foram descontadas.`, 'contas e carteira', ['dividas']);
  if (/quanto (eu )?devo\b|minhas dividas|divida/.test(t) && !/cart/.test(t)) return d.dividasConhecidas ? r(d.dividaTotal ? `Você deve ${fmt(d.dividaTotal)} em dívidas cadastradas (fora a fatura dos cartões).` : 'Você informou que não tem dívidas.', 'dívidas que você cadastrou') : r('Ainda não sei: você não cadastrou dívidas nem informou que não tem.', 'dívidas', ['dividas']);
  if (/milhas|pontos/.test(t)) return r(`Suas milhas e pontos valem cerca de ${fmt(d.milhas)} pelo valor do milheiro que você informou.`, 'saldos de pontos que você cadastrou');
  if (/quanto (eu )?(recebi|ganhei)/.test(t)) return r(`Você recebeu ${fmt(d.receitas)} em ${d.mes}.`, fonteMes);
  return null;
}

const AJUDA = 'Posso responder: "Quanto tenho disponível?", "Quanto gastei com alimentação?", "Qual foi minha maior despesa?", "Quanto devo nos cartões?", "Qual o meu patrimônio?" e "Quanto tenho em milhas?". Também registro uma despesa ou crio um limite, sempre pedindo sua confirmação.';

async function agirAssistente(acao, body, c) {
  if (!['assistente_perguntar', 'assistente_confirmar'].includes(acao)) return null;
  const { base, listar, agoraIso } = c;
  if (acao === 'assistente_perguntar') {
    const texto = typeof body.texto === 'string' ? body.texto.trim().slice(0, 300) : '';
    if (!texto) return [400, { error: 'Escreva o que você quer saber ou fazer.' }];
    const cmd = parseComando(texto);
    if (cmd && cmd.erro) return [200, { tipo: 'recusa', resposta: cmd.erro }];
    if (cmd) return [200, { tipo: 'proposta', proposta: cmd, resposta: descreve(cmd), precisa_confirmar: true }];
    const mes = agoraIso.slice(0, 7);
    const [lancs, contas, carteira, pontos, cts, gastos, dividas] = await Promise.all(['lancamentos', 'contas', 'carteira', 'pontos', 'cartoes', 'gastos', 'dividas'].map((n) => listar(base.collection(n))));
    const cfgDiv = await base.collection('config').doc('dividas').get();
    const dividaTotal = dividas.reduce((s, x) => s + Math.round(x.saldo * 100), 0) / 100;
    const doMes = lancs.filter((x) => String(x.data).startsWith(mes));
    const tot = totais(doMes);
    const sd = fin.saldoDisponivel(contas);
    const desp = doMes.filter((x) => x.tipo === 'despesa').sort((a, b) => b.valor - a.valor);
    const comprometido = cts.reduce((s, k) => s + Math.round(cartoes.limiteDoCartao(k, gastos, mes).comprometido * 100), 0) / 100;
    const inv = carteira.reduce((s, x) => s + Math.round((x.valor || 0) * 100), 0) / 100;
    const brl = contas.filter((k) => (k.moeda || 'BRL') === 'BRL').reduce((s, k) => s + Math.round((k.saldo || 0) * 100), 0) / 100;
    const out = responder(texto, { mes, agoraIso, saldo: sd.saldo, por_categoria: tot.por_categoria, qtd: doMes.length, maior: desp[0], comprometido, temCartao: cts.length > 0, patrimonio: Math.round((brl + inv - dividaTotal * 1) * 100) / 100, dividaTotal, dividasConhecidas: dividas.length > 0 || !!(cfgDiv && cfgDiv.exists && cfgDiv.data().sem_dividas),
      milhas: Math.round(pontos.reduce((s, p) => s + ((p.saldo || 0) / 1000) * (p.valor_milheiro || 0), 0) * 100) / 100, receitas: tot.receitas });
    return [200, out ? { tipo: 'resposta', ...out } : { tipo: 'nao_entendi', resposta: 'Não entendi esse pedido e prefiro não chutar um número. ' + AJUDA }];
  }
  // assistente_confirmar: só grava o que a pessoa confirmou na tela
  const p = body.proposta;
  if (!p || typeof p !== 'object') return [400, { error: 'Nada para confirmar.' }];
  if (!CATEGORIAS_KF.includes(p.categoria) || !(Number(p.valor) > 0) || Number(p.valor) > 1e7) return [400, { error: 'Proposta inválida.' }];
  const valor = Math.round(Number(p.valor) * 100) / 100;
  if (p.tipo === 'registrar_despesa') {
    const l = { data: agoraIso.slice(0, 10), valor, descricao: String(p.descricao || NOME[p.categoria]).slice(0, 120), estabelecimento: String(p.descricao || NOME[p.categoria]).slice(0, 120), tipo: 'despesa', categoria: p.categoria, moeda: 'BRL', documento: 'comando', origem: 'assistente', criado_em: agoraIso };
    const id = crypto.createHash('sha1').update(chave(l) + agoraIso).digest('hex').slice(0, 20);
    await base.collection('lancamentos').doc(id).set(l);
    return [200, { ok: true, resposta: `Pronto: despesa de ${fmt(valor)} em ${NOME[p.categoria]} registrada.` }];
  }
  if (p.tipo === 'criar_limite') {
    await base.collection('limites').doc(p.categoria).set({ categoria: p.categoria, limite: valor, atualizado_em: agoraIso });
    return [200, { ok: true, resposta: `Pronto: limite de ${fmt(valor)} por mês para ${NOME[p.categoria]} criado.` }];
  }
  return [400, { error: 'Esse tipo de ação eu não executo.' }];
}

module.exports = { agirAssistente, parseComando, responder, categoriaDe, valorDe };
