'use strict';
/**
 * Kernex Finance, fase 3: contas, saldo disponível e limites de gasto por categoria.
 * Saldo disponível = só dinheiro de verdade em contas em reais. Limite de cartão NUNCA entra aqui.
 * Sem contas cadastradas o saldo é null (lacuna), nunca zero inventado.
 */
const { CATEGORIAS_KF } = require('./documentos');

const TIPOS_CONTA = { corrente: 'Conta corrente', poupanca: 'Poupança', digital: 'Conta digital', carteira_digital: 'Carteira digital', dinheiro: 'Dinheiro em espécie', pagamento: 'Conta de pagamento', internacional: 'Conta internacional', compartilhada: 'Conta compartilhada' };
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const dinheiro = (n) => Math.round(n * 100) / 100;
const numero = (v) => {
  if (typeof v === 'number') return v;
  let t = String(v == null ? '' : v).replace(/[^\d.,-]/g, '');
  if (!t || t === '-') return NaN;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  return Number(t);
};

function validarConta(o) {
  const nome = texto(o && o.nome, 60);
  if (!nome) return { ok: false, erro: 'Dê um nome para a conta.' };
  const tipo = o.tipo || 'corrente';
  if (!TIPOS_CONTA[tipo]) return { ok: false, erro: 'Tipo de conta inválido.' };
  const saldo = numero(o.saldo);
  if (!Number.isFinite(saldo)) return { ok: false, erro: 'O saldo precisa ser um número (pode ser negativo).' };
  const moeda = texto(o.moeda, 3).toUpperCase() || (tipo === 'internacional' ? 'USD' : 'BRL');
  return { ok: true, item: { nome, tipo, instituicao: texto(o.instituicao, 60) || null, saldo: dinheiro(saldo), moeda, compartilhada: tipo === 'compartilhada' } };
}
function validarLimite(o) {
  const categoria = texto(o && o.categoria, 30);
  if (!CATEGORIAS_KF.includes(categoria)) return { ok: false, erro: 'Categoria inválida.' };
  const limite = numero(o.limite);
  if (!Number.isFinite(limite) || limite <= 0) return { ok: false, erro: 'O limite precisa ser maior que zero.' };
  return { ok: true, item: { categoria, limite: dinheiro(limite) } };
}

/** Só contas em reais entram no saldo disponível; outras moedas ficam à parte (sem converter às cegas). */
function saldoDisponivel(contas) {
  const lista = contas || [];
  if (!lista.length) return { saldo: null, outras_moedas: [] };
  const brl = lista.filter((c) => (c.moeda || 'BRL') === 'BRL');
  const cent = brl.reduce((s, c) => s + Math.round(Number(c.saldo || 0) * 100), 0);
  return { saldo: cent / 100, outras_moedas: lista.filter((c) => (c.moeda || 'BRL') !== 'BRL').map((c) => ({ nome: c.nome, saldo: c.saldo, moeda: c.moeda })) };
}
/** Consumo de cada limite no mês: ok < 80%, atencao de 80% a 100%, estourado acima de 100%. */
function consumoLimites(limites, porCategoria) {
  return (limites || []).map((l) => {
    const gasto = dinheiro((porCategoria || {})[l.categoria] || 0);
    const pct = Math.round((gasto / l.limite) * 1000) / 10;
    return { categoria: l.categoria, limite: l.limite, gasto, restante: dinheiro(l.limite - gasto), pct, status: pct > 100 ? 'estourado' : pct >= 80 ? 'atencao' : 'ok' };
  }).sort((a, b) => b.pct - a.pct);
}

async function agirFin(acao, body, c) {
  if (!['conta_salvar', 'conta_listar', 'conta_apagar', 'limite_salvar', 'limite_listar', 'limite_apagar'].includes(acao)) return null;
  const { base, listar, salvar, apagar, agoraIso } = c;
  const id = texto(body.id, 60);
  switch (acao) {
    case 'conta_salvar': return salvar('contas', validarConta(body));
    case 'conta_listar': {
      const contas = (await listar(base.collection('contas'))).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
      return [200, { contas, ...saldoDisponivel(contas), tipos: TIPOS_CONTA }];
    }
    case 'conta_apagar': return apagar('contas');
    case 'limite_salvar': {
      const v = validarLimite(body);
      if (!v.ok) return [400, { error: v.erro }];
      await base.collection('limites').doc(v.item.categoria).set({ ...v.item, atualizado_em: agoraIso });
      return [200, { ok: true, id: v.item.categoria }];
    }
    case 'limite_listar': {
      const { totais } = require('./motor');
      const mes = texto(body.mes, 7) || agoraIso.slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(mes)) return [400, { error: 'O mês precisa estar no formato AAAA-MM.' }];
      const [limites, lancs] = await Promise.all([listar(base.collection('limites')), listar(base.collection('lancamentos'))]);
      const t = totais(lancs.filter((x) => String(x.data).startsWith(mes)));
      return [200, { mes, limites: consumoLimites(limites, t.por_categoria), despesas: t.despesas }];
    }
    case 'limite_apagar': {
      if (!id || !CATEGORIAS_KF.includes(id)) return [400, { error: 'Diga qual limite apagar.' }];
      await base.collection('limites').doc(id).delete();
      return [200, { ok: true }];
    }
    default: return null;
  }
}

module.exports = { agirFin, validarConta, validarLimite, saldoDisponivel, consumoLimites, TIPOS_CONTA };
