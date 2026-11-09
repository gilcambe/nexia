'use strict';
/**
 * Kernex Finance, fase 7: investimentos. Cálculo sempre do motor.
 * Cotação só vale com FONTE e DATA/HORA; passou de 3 dias vira "desatualizada". Nada de promessa de retorno.
 */
const { jurosCompostos, concentracao, rentabilidade, cotacaoStatus } = require('./motor');

const AVISO = 'Isto não é recomendação de investimento nem promessa de retorno. Rentabilidade passada não garante resultado futuro. Confira com um profissional certificado.';
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const numero = (v) => {
  if (typeof v === 'number') return v;
  let t = String(v == null ? '' : v).replace(/[^\d.,-]/g, '');
  if (!t || t === '-') return NaN;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  return Number(t);
};
const DATA = /^\d{4}-\d{2}-\d{2}$/;

function validarDividendo(o) {
  const ativo = texto(o && o.ativo, 40);
  if (!ativo) return { ok: false, erro: 'Diga de qual ativo é o provento.' };
  if (!DATA.test(texto(o.data, 10))) return { ok: false, erro: 'Diga a data do pagamento (AAAA-MM-DD).' };
  const valor = numero(o.valor);
  if (!Number.isFinite(valor) || valor <= 0) return { ok: false, erro: 'O valor do provento precisa ser maior que zero.' };
  const tipo = ['dividendo', 'jcp', 'rendimento', 'cupom'].includes(o.tipo) ? o.tipo : 'dividendo';
  return { ok: true, item: { ativo, data: o.data, valor: Math.round(valor * 100) / 100, tipo, recebido: !!o.recebido } };
}

function validarCotacao(o, agoraIso) {
  const preco = numero(o && o.preco);
  if (!Number.isFinite(preco) || preco <= 0) return { ok: false, erro: 'O preço precisa ser maior que zero.' };
  const fonte = texto(o.fonte, 80);
  if (!fonte) return { ok: false, erro: 'Diga a fonte da cotação (site, corretora, extrato). Sem fonte não registro.' };
  const dh = texto(o.data_hora, 30) || agoraIso;
  if (!Number.isFinite(Date.parse(dh))) return { ok: false, erro: 'Data/hora da cotação inválida.' };
  return { ok: true, cotacao: { preco: Math.round(preco * 100) / 100, fonte, data_hora: dh } };
}

function visao(itens, dividendos, agoraIso) {
  const lista = (itens || []).map((x) => {
    const st = cotacaoStatus(x.cotacao_info, agoraIso);
    const qtd = Number(x.quantidade); const pm = Number(x.preco_medio);
    const custo = qtd > 0 && pm > 0 ? Math.round(qtd * pm * 100) / 100 : null;
    const atualCot = st.valida && qtd > 0 ? Math.round(qtd * x.cotacao_info.preco * 100) / 100 : null;
    const rent = custo != null && atualCot != null ? rentabilidade(custo, atualCot) : null;
    return { id: x.id, nome: x.nome, tipo: x.tipo, valor: x.valor, ticker: x.ticker || null, quantidade: qtd > 0 ? qtd : null, custo, valor_cotado: atualCot, rentabilidade: rent, cotacao: x.cotacao_info ? { ...x.cotacao_info, ...st } : null };
  });
  const conc = concentracao(lista);
  const hoje = agoraIso.slice(0, 10); const em60 = new Date(Date.parse(hoje) + 60 * 86400000).toISOString().slice(0, 10);
  const venc = (itens || []).filter((x) => x.vencimento && x.vencimento >= hoje && x.vencimento <= em60).map((x) => ({ tipo: 'vencimento', nome: x.nome, data: x.vencimento, valor: x.valor }));
  const prov = (dividendos || []).filter((d) => d.data >= hoje && d.data <= em60).map((d) => ({ tipo: d.tipo, nome: d.ativo, data: d.data, valor: d.valor }));
  const calendario = [...venc, ...prov].sort((a, b) => a.data.localeCompare(b.data));
  const mes = hoje.slice(0, 7); const ano = hoje.slice(0, 4);
  const recebidoAno = (dividendos || []).filter((d) => d.recebido && String(d.data).startsWith(ano)).reduce((s, d) => s + Math.round(d.valor * 100), 0) / 100;
  const lacunas = [];
  if (!lista.length) lacunas.push('Cadastre sua carteira para ver rentabilidade e concentração.');
  if (lista.some((x) => !x.cotacao)) lacunas.push('Alguns ativos estão sem cotação com fonte e data; não calculei a rentabilidade deles.');
  return { itens: lista, concentracao: conc, calendario, proventos_recebidos_ano: recebidoAno, mes, lacunas, aviso: AVISO };
}

async function agirInvestimentos(acao, body, c) {
  if (!['invest_visao', 'invest_simular', 'invest_cotacao', 'invest_dividendo_salvar', 'invest_dividendo_apagar', 'invest_dividendo_listar', 'invest_analise'].includes(acao)) return null;
  const { base, listar, salvar, apagar, agoraIso } = c;
  switch (acao) {
    case 'invest_visao': {
      const [itens, divs] = await Promise.all([c.listarCarteira(), listar(base.collection('dividendos'))]);
      return [200, visao(itens, divs, agoraIso)];
    }
    case 'invest_simular': {
      const inicial = body.inicial === undefined || body.inicial === '' ? 0 : numero(body.inicial);
      const aporte = body.aporte === undefined || body.aporte === '' ? 0 : numero(body.aporte);
      const taxa = numero(body.taxa_mes);
      const anos = numero(body.anos);
      if (![inicial, aporte].every((v) => Number.isFinite(v) && v >= 0 && v <= 1e9)) return [400, { error: 'Valor inicial e aporte precisam ser zero ou mais.' }];
      if (!Number.isFinite(taxa) || taxa < 0 || taxa > 10) return [400, { error: 'A taxa ao mês vai de 0 a 10 (%).' }];
      if (!Number.isFinite(anos) || anos <= 0 || anos > 60) return [400, { error: 'O prazo vai de 1 a 60 anos.' }];
      const r = jurosCompostos({ inicial, aporte, taxa_mes: taxa, meses: Math.round(anos * 12) });
      return [200, { ...r, premissas: { inicial, aporte, taxa_mes: taxa, anos }, aviso: 'Simulação com a taxa que VOCÊ informou, constante, sem imposto nem inflação. ' + AVISO }];
    }
    case 'invest_cotacao': {
      if (!body.id) return [400, { error: 'Diga qual ativo atualizar.' }];
      const ref = base.collection('carteira').doc(body.id);
      const snap = await ref.get();
      if (!snap || !snap.exists) return [404, { error: 'Ativo não encontrado.' }];
      const v = validarCotacao(body, agoraIso);
      if (!v.ok) return [400, { error: v.erro }];
      await ref.set({ ...snap.data(), cotacao_info: v.cotacao, atualizado_em: agoraIso });
      return [200, { ok: true, cotacao: { ...v.cotacao, ...cotacaoStatus(v.cotacao, agoraIso) } }];
    }
    case 'invest_dividendo_salvar': return salvar('dividendos', validarDividendo(body));
    case 'invest_dividendo_apagar': return apagar('dividendos');
    case 'invest_dividendo_listar': return [200, { dividendos: (await listar(base.collection('dividendos'))).sort((a, b) => String(b.data).localeCompare(String(a.data))) }];
    case 'invest_analise': {
      // Só observações sobre a carteira do próprio usuário e sobre dados com fonte. Nada de "compre/venda".
      const itens = await c.listarCarteira();
      const v = visao(itens, [], agoraIso);
      const obs = [...v.concentracao.alertas];
      for (const x of v.itens) if (x.cotacao && x.cotacao.desatualizada) obs.push(`A cotação de ${x.nome} está desatualizada (fonte: ${x.cotacao.fonte || 'sem fonte'}).`);
      return [200, { observacoes: obs, lacunas: v.lacunas, fonte: 'Dados cadastrados por você', aviso: AVISO }];
    }
    default: return null;
  }
}

module.exports = { agirInvestimentos, validarDividendo, validarCotacao, visao, AVISO };
