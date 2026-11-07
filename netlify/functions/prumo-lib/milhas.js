'use strict';
/**
 * Kernex Finance, fase 8: milhas e pontos. Custo e valor por milheiro vêm do motor.
 * Promoções só entram com FONTE e VALIDADE (nada inventado); vencida some da lista.
 */
const { custoMilheiro, resgateMilhas } = require('./motor');
const { retornoPct } = require('./cartoes');

const AVISO = 'Valores de pontos e milhas mudam; confira no programa antes de decidir. Não é recomendação financeira.';
const PROGRAMAS_SUGERIDOS = ['Livelo', 'Esfera', 'LATAM Pass', 'Smiles', 'Azul Fidelidade', 'TAP Miles&Go'];
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const numero = (v) => {
  if (typeof v === 'number') return v;
  let t = String(v == null ? '' : v).replace(/[^\d.,-]/g, '');
  if (!t || t === '-') return NaN;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  return Number(t);
};
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function validarCompra(o) {
  const programa = texto(o && o.programa, 60);
  if (!programa) return { ok: false, erro: 'Diga o programa.' };
  const milhas = numero(o.milhas); const preco = numero(o.preco);
  if (!Number.isFinite(milhas) || milhas <= 0 || !Number.isInteger(milhas)) return { ok: false, erro: 'As milhas precisam ser um número inteiro maior que zero.' };
  if (!Number.isFinite(preco) || preco < 0) return { ok: false, erro: 'O preço pago precisa ser zero ou mais.' };
  const data = texto(o.data, 10);
  if (data && !DATA.test(data)) return { ok: false, erro: 'Data inválida.' };
  return { ok: true, item: { programa, milhas, preco: Math.round(preco * 100) / 100, data: data || null } };
}
function validarPromo(o) {
  const titulo = texto(o && o.titulo, 100);
  if (!titulo) return { ok: false, erro: 'Diga qual é a promoção.' };
  const fonte = texto(o.fonte, 120);
  if (!fonte) return { ok: false, erro: 'Sem fonte (site, e-mail do programa) não registro promoção.' };
  const validade = texto(o.validade, 10);
  if (!DATA.test(validade)) return { ok: false, erro: 'Diga até quando vale a promoção (AAAA-MM-DD).' };
  const bonus = o.bonus_pct === undefined || o.bonus_pct === '' ? null : numero(o.bonus_pct);
  if (bonus !== null && (!Number.isFinite(bonus) || bonus < 0 || bonus > 1000)) return { ok: false, erro: 'Bônus inválido.' };
  return { ok: true, item: { titulo, programa: texto(o.programa, 60) || null, fonte, url: texto(o.url, 300) || null, validade, bonus_pct: bonus } };
}

function visao(pontos, compras, promos, hoje) {
  const programas = (pontos || []).map((p) => {
    const cs = (compras || []).filter((c) => norm(c.programa) === norm(p.programa));
    const milhasC = cs.reduce((s, c) => s + c.milhas, 0);
    const pagoC = cs.reduce((s, c) => s + Math.round(c.preco * 100), 0) / 100;
    const custo = milhasC > 0 ? custoMilheiro({ preco: pagoC, milhas: milhasC }) : null;
    const dias = p.validade ? Math.round((Date.parse(p.validade) - Date.parse(hoje)) / 86400000) : null;
    return { id: p.id, programa: p.programa, saldo: p.saldo, validade: p.validade || null, dias_para_vencer: dias, a_vencer_30d: dias !== null && dias >= 0 && dias <= 30 ? p.saldo : 0,
      valor_milheiro: p.valor_milheiro || null, valor_estimado: Math.round((p.saldo / 1000) * (p.valor_milheiro || 0) * 100) / 100,
      custo_aquisicao: milhasC > 0 ? pagoC : null, custo_milheiro: custo };
  });
  const sem = (compras || []).filter((c) => !programas.some((p) => norm(p.programa) === norm(c.programa)));
  const lacunas = [];
  if (!programas.length) lacunas.push('Cadastre seus programas de pontos para ver saldo e vencimentos.');
  if (programas.some((p) => p.custo_milheiro === null)) lacunas.push('Sem compras registradas em alguns programas: não calculei o custo do milheiro deles.');
  if (sem.length) lacunas.push('Há compras de programas que ainda não estão cadastrados com saldo.');
  const vigentes = (promos || []).filter((x) => x.validade >= hoje).sort((a, b) => a.validade.localeCompare(b.validade));
  return { programas, promocoes: vigentes, lacunas, sugeridos: PROGRAMAS_SUGERIDOS, aviso: AVISO };
}

async function agirMilhas(acao, body, c) {
  if (!['milhas_visao', 'milhas_compra_salvar', 'milhas_compra_apagar', 'milhas_resgate', 'milhas_cartao_ideal', 'milhas_promo_salvar', 'milhas_promo_apagar'].includes(acao)) return null;
  const { base, listar, salvar, apagar, agoraIso } = c;
  const hoje = agoraIso.slice(0, 10);
  switch (acao) {
    case 'milhas_compra_salvar': return salvar('milhas_compras', validarCompra(body));
    case 'milhas_compra_apagar': return apagar('milhas_compras');
    case 'milhas_promo_salvar': return salvar('milhas_promos', validarPromo(body));
    case 'milhas_promo_apagar': return apagar('milhas_promos');
    case 'milhas_visao': {
      const [pontos, compras, promos] = await Promise.all([listar(base.collection('pontos')), listar(base.collection('milhas_compras')), listar(base.collection('milhas_promos'))]);
      return [200, { ...visao(pontos, compras, promos, hoje), compras }];
    }
    case 'milhas_resgate': {
      const milhas = numero(body.milhas); const preco = numero(body.preco_dinheiro); const taxas = body.taxas === undefined || body.taxas === '' ? 0 : numero(body.taxas);
      if (!(milhas > 0) || !(preco > 0) || !Number.isFinite(taxas) || taxas < 0 || taxas >= preco) return [400, { error: 'Informe as milhas, o preço em dinheiro da passagem e as taxas (menores que o preço).' }];
      const programa = texto(body.programa, 60);
      const [pontos, compras] = await Promise.all([listar(base.collection('pontos')), listar(base.collection('milhas_compras'))]);
      const v = visao(pontos, compras, [], hoje).programas.find((p) => norm(p.programa) === norm(programa));
      const referencia = v ? (v.custo_milheiro || v.valor_milheiro) : null;
      const r = resgateMilhas({ milhas, preco_dinheiro: preco, taxas, referencia });
      return [200, { ...r, referencia_tipo: v && v.custo_milheiro ? 'custo médio pago' : v && v.valor_milheiro ? 'valor que você informou' : null, aviso: AVISO }];
    }
    case 'milhas_cartao_ideal': {
      const gasto = numero(body.gasto_mensal);
      if (!(gasto > 0) || gasto > 1e7) return [400, { error: 'Diga quanto você gasta por mês no cartão.' }];
      const cartoes = await listar(base.collection('cartoes'));
      const lista = cartoes.map((k) => ({ cartao_id: k.id, nome: k.nome, retorno: retornoPct(k), anuidade: Number(k.anuidade) || 0 }));
      const ranking = lista.filter((x) => x.retorno).map((x) => {
        const bruto = Math.round(gasto * 12 * x.retorno.pct) / 100;
        return { cartao_id: x.cartao_id, nome: x.nome, retorno_pct: x.retorno.pct, parcial: !!x.retorno.parcial, retorno_anual: bruto, anuidade: x.anuidade, liquido_anual: Math.round((bruto - x.anuidade) * 100) / 100 };
      }).sort((a, b) => b.liquido_anual - a.liquido_anual);
      const sem_dados = lista.filter((x) => !x.retorno).map((x) => ({ cartao_id: x.cartao_id, nome: x.nome, falta: 'pontos por real e valor do milheiro (ou cashback)' }));
      return [200, { ranking, sem_dados, melhor: ranking[0] || null, aviso: AVISO }];
    }
    default: return null;
  }
}

module.exports = { agirMilhas, validarCompra, validarPromo, visao, AVISO };
