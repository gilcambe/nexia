'use strict';
/**
 * Kernex Finance, fase 11: metas e patrimônio futuro. Cálculo do motor; a pessoa informa as premissas (taxa, inflação, imposto).
 * Cofres: reservas separadas por objetivo (movimentos de entrada e saída), somadas aos ativos da carteira ligados ao objetivo.
 */
const { projecaoReal, mesesParaMeta, independenciaFinanceira, patrimonio, totais } = require('./motor');
const cartoes = require('./cartoes');

const AVISO = 'Projeção com as premissas que VOCÊ informou (taxa, inflação e imposto constantes). A realidade varia; não é promessa nem recomendação de investimento.';
const MARCOS = [10000, 100000, 500000, 1000000];
const numero = (v) => {
  if (typeof v === 'number') return v;
  let t = String(v == null ? '' : v).replace(/[^\d.,-]/g, '');
  if (!t || t === '-') return NaN;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  return Number(t);
};
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const dinheiro = (n) => Math.round(n * 100) / 100;
const opt = (v, padrao) => (v === undefined || v === null || v === '' ? padrao : numero(v));

function premissas(b) {
  const p = { taxa_ano: opt(b.taxa_ano, 0), inflacao_ano: opt(b.inflacao_ano, 0), imposto_pct: opt(b.imposto_pct, 0) };
  if (![p.taxa_ano, p.inflacao_ano, p.imposto_pct].every(Number.isFinite)) return { erro: 'Taxa, inflação e imposto precisam ser números.' };
  if (p.taxa_ano < 0 || p.taxa_ano > 100 || p.inflacao_ano < 0 || p.inflacao_ano > 100 || p.imposto_pct < 0 || p.imposto_pct > 100) return { erro: 'Taxa, inflação e imposto vão de 0 a 100 (%).' };
  return p;
}

async function agirMetas(acao, body, c) {
  if (!['meta_simular', 'meta_independencia', 'cofre_mover', 'cofre_listar', 'meta_visao'].includes(acao)) return null;
  const { base, listar, agoraIso, salvar } = c;
  switch (acao) {
    case 'meta_simular': {
      const p = premissas(body); if (p.erro) return [400, { error: p.erro }];
      const inicial = opt(body.inicial, 0); const aporte = opt(body.aporte, 0); const anos = numero(body.anos);
      if (![inicial, aporte].every((v) => Number.isFinite(v) && v >= 0 && v <= 1e9) || !Number.isFinite(anos) || anos <= 0 || anos > 60) return [400, { error: 'Valor inicial e aporte precisam ser zero ou mais, e o prazo vai de 1 a 60 anos.' }];
      const r = projecaoReal({ inicial, aporte, ...p, anos });
      const alvo = body.meta === undefined || body.meta === '' ? null : numero(body.meta);
      return [200, { ...r, premissas: { inicial, aporte, anos, ...p }, atinge_meta: alvo > 0 ? r.real >= alvo : null, aviso: AVISO }];
    }
    case 'meta_independencia': {
      const p = premissas(body); if (p.erro) return [400, { error: p.erro }];
      const gasto = numero(body.gasto_mensal); const retirada = opt(body.retirada_pct, 4);
      if (!(gasto > 0) || !Number.isFinite(retirada) || retirada <= 0 || retirada > 20) return [400, { error: 'Diga seu gasto mensal e uma taxa de retirada entre 0 e 20% ao ano.' }];
      const atual = opt(body.atual, 0); const aporte = opt(body.aporte, 0);
      if (![atual, aporte].every((v) => Number.isFinite(v) && v >= 0)) return [400, { error: 'Patrimônio atual e aporte precisam ser zero ou mais.' }];
      const r = independenciaFinanceira({ gasto_mensal: gasto, retirada_pct: retirada, atual, aporte, taxa_ano: p.taxa_ano, inflacao_ano: p.inflacao_ano });
      return [200, { ...r, retirada_pct: retirada, aviso: AVISO, nota: r.meses === null ? 'Com esses números a meta não é atingida em 100 anos: aumente o aporte ou a taxa.' : null }];
    }
    case 'cofre_mover': {
      const id = texto(body.objetivo_id, 60); const valor = numero(body.valor);
      if (!id) return [400, { error: 'Diga em qual objetivo guardar.' }];
      if (!Number.isFinite(valor) || valor === 0 || Math.abs(valor) > 1e9) return [400, { error: 'O valor precisa ser diferente de zero (negativo = retirada).' }];
      const obj = await base.collection('objetivos').doc(id).get();
      if (!obj || !obj.exists) return [404, { error: 'Objetivo não encontrado.' }];
      const movs = (await listar(base.collection('cofres'))).filter((m) => m.objetivo_id === id);
      const saldo = Math.round(movs.reduce((s, m) => s + Math.round(m.valor * 100), 0));
      if (valor < 0 && saldo + Math.round(valor * 100) < 0) return [400, { error: 'O cofre não tem esse valor para retirar.' }];
      return salvar('cofres', { ok: true, item: { objetivo_id: id, valor: dinheiro(valor), nota: texto(body.nota, 80), data: agoraIso.slice(0, 10) } });
    }
    case 'cofre_listar': {
      const movs = (await listar(base.collection('cofres'))).sort((a, b) => String(b.data).localeCompare(String(a.data)));
      return [200, { movimentos: movs.slice(0, 100) }];
    }
    case 'meta_visao': {
      const taxa_real = opt(body.taxa_real_ano, 0);
      if (!Number.isFinite(taxa_real) || taxa_real < -50 || taxa_real > 50) return [400, { error: 'A taxa real vai de -50 a 50 (% ao ano).' }];
      const [objs, carteira, movs, contas, dividas, lancs] = await Promise.all(['objetivos', 'carteira', 'cofres', 'contas', 'dividas', 'lancamentos'].map((k) => listar(base.collection(k))));
      const objetivos = objs.map((o) => {
        const daCarteira = Math.round(carteira.filter((i) => i.objetivo_id === o.id).reduce((s, i) => s + Math.round((Number(i.valor) || 0) * 100), 0)) / 100;
        const cofre = Math.round(movs.filter((m) => m.objetivo_id === o.id).reduce((s, m) => s + Math.round(m.valor * 100), 0)) / 100;
        const atual = dinheiro(daCarteira + cofre);
        const meses = o.aporte_mensal != null ? mesesParaMeta({ atual, meta: o.meta, aporte: o.aporte_mensal, taxa_real_ano: taxa_real }) : undefined;
        return { id: o.id, nome: o.nome, meta: o.meta, prazo: o.prazo, aporte_mensal: o.aporte_mensal, da_carteira: daCarteira, cofre, atual, percentual: o.meta > 0 ? Math.round((atual / o.meta) * 1000) / 10 : 0,
          meses_para_meta: meses === undefined ? null : meses, sem_aporte: o.aporte_mensal == null };
      });
      const pat = patrimonio({ contas: contas.filter((k) => (k.moeda || 'BRL') === 'BRL').map((k) => ({ valor: k.saldo })), investimentos: carteira, dividas: dividas.map((d) => ({ valor: d.saldo })) });
      const marcos = MARCOS.map((m) => ({ marco: m, pct: Math.max(0, Math.min(100, Math.round((pat.liquido / m) * 1000) / 10)), atingido: pat.liquido >= m }));
      const mes = agoraIso.slice(0, 7); const desp = [];
      for (let i = 1; i <= 3; i++) { const d = totais(lancs.filter((x) => String(x.data).startsWith(cartoes.somarMes(mes, -i)))).despesas; if (d > 0) desp.push(d); }
      const media = desp.length ? dinheiro(desp.reduce((s, v) => s + v, 0) / desp.length) : null;
      const liquidez = contas.filter((k) => (k.moeda || 'BRL') === 'BRL').reduce((s, k) => s + Math.round(k.saldo * 100), 0) / 100;
      const reserva = media === null ? { lacuna: 'Preciso de despesas de meses anteriores nos seus documentos para calcular a reserva de emergência.' } : { meta_6_meses: dinheiro(media * 6), despesa_media: media, em_contas: liquidez, meses_cobertos: Math.round((liquidez / media) * 10) / 10 };
      return [200, { objetivos, patrimonio: pat, marcos, reserva, premissa: { taxa_real_ano: taxa_real }, aviso: AVISO }];
    }
    default: return null;
  }
}

module.exports = { agirMetas, premissas, AVISO };
