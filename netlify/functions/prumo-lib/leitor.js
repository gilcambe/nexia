'use strict';
/**
 * Kernex Finance: leitura de print/PDF por IA grátis, comum a Contas, Cartões, Dívidas e Score.
 * Uma chamada de IA por imagem, todas ao mesmo tempo. Nada é salvo aqui: o usuário confere e salva pela ação de sempre.
 */
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const numero = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(/[R$\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')) : NaN);
const dinheiro = (n) => Math.round(n * 100) / 100;
const MSG_NAO_LEU = 'Não consegui ler esta imagem. Tente de novo com uma imagem mais nítida ou digite os valores.';

/**
 * Lê cada imagem de body.imagens com a IA. `validar(json)` devolve { ok, item } ou { ok:false, erro }.
 * Devolve [200, { lidos: [{ ok, [chave]: item } | { ok:false, erro }] }] na mesma ordem das imagens.
 */
async function lerPorImagens(c, body, sistema, validar, chave) {
  const im = c.lerImagens(body && body.imagens);
  if (!im.ok) return [400, { error: im.erro }];
  const perguntar = c.deps.perguntarVisao || ((img, s) => require('./salario').perguntarVisaoGratis(c.deps, img, s));
  const lidos = await Promise.all(im.imagens.map(async (img) => {
    try {
      const t = await perguntar(img, sistema);
      const j = t && c.extrairJson(t);
      if (!j) return { ok: false, erro: MSG_NAO_LEU };
      const v = validar(j);
      return v.ok ? { ok: true, [chave]: v.item } : { ok: false, erro: v.erro };
    } catch {
      return { ok: false, erro: 'Não consegui ler esta imagem agora.' };
    }
  }));
  return [200, { lidos }];
}

const LER_CONTA = `Você lê UM print do app ou extrato de um banco brasileiro. Responda SÓ com JSON:
{"nome":"","tipo":"corrente|poupanca|digital|dinheiro|pagamento","instituicao":"","saldo":0}
saldo = saldo disponível da conta em reais, número (R$ 1.234,56 vira 1234.56; negativo se estiver no vermelho). instituicao = nome do banco.
Não copie CPF, número de agência, número da conta nem o nome da pessoa.`;
const LER_CARTAO = `Você lê UM print ou PDF de fatura (ou tela de limite) de cartão de crédito brasileiro. Responda SÓ com JSON:
{"nome":"","bandeira":"","limite":0,"fatura_atual":0,"dia_vencimento":0,"dia_fechamento":0}
limite = limite total do cartão; fatura_atual = valor da fatura; dia_vencimento e dia_fechamento = só o dia do mês (1 a 31), 0 se não aparecer.
Valores em número (R$ 1.234,56 vira 1234.56). Não copie o número do cartão, CPF nem o nome da pessoa.`;
const LER_DIVIDA = `Você lê UM contrato, boleto ou print de dívida brasileiro. Responda SÓ com JSON:
{"credor":"","tipo":"cartao|emprestimo|financiamento|cheque_especial|parcelamento|outro","saldo":0,"parcela":0,"juros_mes":0,"cet_ano":0,"dia_vencimento":0}
saldo = quanto falta pagar; parcela = valor da parcela mensal; juros_mes e cet_ano em % (número); dia_vencimento = dia do mês (1 a 31). Use 0 para o que não aparecer.
Não copie CPF, nome da pessoa nem número de documento.`;

const TIPOS_CONTA = ['corrente', 'poupanca', 'digital', 'dinheiro', 'pagamento'];
function lidoConta(j) {
  const saldo = numero(j.saldo);
  if (!Number.isFinite(saldo)) return { ok: false, erro: 'Não achei o saldo neste print.' };
  const tipo = texto(j.tipo, 20);
  const inst = texto(j.instituicao, 60);
  return { ok: true, item: { nome: texto(j.nome, 60) || inst || 'Conta', tipo: TIPOS_CONTA.includes(tipo) ? tipo : 'corrente', instituicao: inst, saldo: dinheiro(saldo), moeda: 'BRL' } };
}
const diaOuVazio = (v) => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null; };
const positivo = (v) => { const n = numero(v); return Number.isFinite(n) && n > 0 ? dinheiro(n) : null; };
function lidoCartao(j) {
  const limite = positivo(j.limite); const fatura = positivo(j.fatura_atual);
  if (limite === null && fatura === null) return { ok: false, erro: 'Não achei limite nem fatura neste print.' };
  const item = { nome: texto(j.nome, 60) || 'Cartão', bandeira: texto(j.bandeira, 30), limite: limite || 0, fatura_atual: fatura || 0, dia_vencimento: diaOuVazio(j.dia_vencimento), dia_fechamento: diaOuVazio(j.dia_fechamento) };
  return { ok: true, item };
}
const TIPOS_DIVIDA = ['cartao', 'emprestimo', 'financiamento', 'cheque_especial', 'parcelamento', 'outro'];
function lidoDivida(j) {
  const saldo = positivo(j.saldo);
  if (saldo === null) return { ok: false, erro: 'Não achei o saldo devedor neste documento.' };
  const tipo = texto(j.tipo, 20);
  const juros = numero(j.juros_mes); const cet = positivo(j.cet_ano);
  const item = { credor: texto(j.credor, 60), tipo: TIPOS_DIVIDA.includes(tipo) ? tipo : 'outro', saldo, parcela: positivo(j.parcela) || 0, juros_mes: Number.isFinite(juros) && juros >= 0 && juros <= 30 ? dinheiro(juros) : 0, dia_vencimento: diaOuVazio(j.dia_vencimento) };
  if (cet !== null) item.cet_ano = cet;
  return { ok: true, item };
}

async function agirLeitor(acao, body, c) {
  switch (acao) {
    case 'conta_print_ler': return lerPorImagens(c, body, LER_CONTA, lidoConta, 'conta');
    case 'cartao_print_ler': return lerPorImagens(c, body, LER_CARTAO, lidoCartao, 'cartao');
    case 'divida_print_ler': return lerPorImagens(c, body, LER_DIVIDA, lidoDivida, 'divida');
    default: return null;
  }
}

module.exports = { agirLeitor, lerPorImagens, numero, dinheiro, texto, lidoConta, lidoCartao, lidoDivida };
