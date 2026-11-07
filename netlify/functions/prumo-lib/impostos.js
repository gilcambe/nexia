'use strict';
/**
 * Kernex Finance, fase 13: impostos e documentos. Pasta anual organizada e relatório para o contador.
 * NÃO transmite declaração nenhuma e NÃO diz o que é dedutível: aponta candidatos para o contador confirmar.
 * Só entram lançamentos do ano pedido e do próprio usuário (base = prumo_users/{uid}).
 */
const { totais } = require('./motor');

const AVISO = 'Este relatório é uma organização dos seus documentos. Não transmite declaração e não é orientação tributária: confirme tudo com seu contador.';
const ANO = /^\d{4}$/;
const dinheiro = (n) => Math.round(n * 100) / 100;
const cent = (v) => Math.round(Number(v) * 100);
// Categorias que costumam interessar ao contador (candidatas, não decisão).
const CANDIDATAS = { saude: 'Saúde', educacao: 'Educação' };

function doAno(lancs, ano, perfil) {
  return (lancs || []).filter((l) => String(l.data).startsWith(ano + '-') && (perfil === 'todos' || (l.perfil === 'pj' ? 'pj' : 'pf') === perfil));
}

function pasta(lancs, ano, perfil) {
  const ls = doAno(lancs, ano, perfil);
  const meses = {};
  for (const l of ls) { const m = String(l.data).slice(5, 7); (meses[m] = meses[m] || []).push(l); }
  const porMes = Object.keys(meses).sort().map((m) => { const t = totais(meses[m]); return { mes: ano + '-' + m, documentos: meses[m].length, receitas: t.receitas, despesas: t.despesas }; });
  const t = totais(ls.filter((x) => x.tipo === 'receita' || x.tipo === 'despesa'));
  const candidatos = Object.entries(CANDIDATAS).map(([cat, nome]) => {
    const itens = ls.filter((l) => l.tipo === 'despesa' && l.categoria === cat);
    return { categoria: cat, nome, total: dinheiro(itens.reduce((s, l) => s + cent(l.valor), 0) / 100), itens: itens.length };
  });
  const porTipoDoc = {};
  for (const l of ls) porTipoDoc[l.documento || 'outro'] = (porTipoDoc[l.documento || 'outro'] || 0) + 1;
  const lacunas = [];
  if (!ls.length) lacunas.push(`Nenhum lançamento de ${ano} nos seus documentos.`);
  else if (porMes.length < 12) lacunas.push(`Há documentos em ${porMes.length} de 12 meses de ${ano}: confira se não faltam meses.`);
  return { ano, perfil, qtd: ls.length, receitas: t.receitas, despesas: t.despesas, por_mes: porMes, candidatos_dedutiveis: candidatos, por_tipo_documento: porTipoDoc, lacunas, aviso: AVISO };
}

const celula = (v) => { let s = String(v == null ? '' : v).replace(/[\r\n]+/g, ' '); if (/^[=+\-@\t]/.test(s)) s = "'" + s; return /[;"]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

function relatorio(lancs, ano, perfil) {
  const ls = doAno(lancs, ano, perfil).sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const cab = ['Data', 'Tipo', 'Categoria', 'Descrição', 'Instituição', 'Documento', 'Valor (R$)'];
  const linhas = ls.map((l) => [l.data, l.tipo, l.categoria, l.descricao, l.instituicao || '', l.documento || '', String(l.valor).replace('.', ',')]);
  const csv = [cab, ...linhas].map((r) => r.map(celula).join(';')).join('\r\n');
  return { resumo: pasta(lancs, ano, perfil), csv, nome_arquivo: `kernex-contador-${ano}-${perfil}.csv`, linhas: ls.length };
}

async function agirImpostos(acao, body, c) {
  if (!['imp_pasta', 'imp_relatorio'].includes(acao)) return null;
  const { base, listar, agoraIso } = c;
  const ano = String(body.ano || agoraIso.slice(0, 4));
  if (!ANO.test(ano)) return [400, { error: 'O ano precisa ter 4 números.' }];
  const perfil = ['pf', 'pj', 'todos'].includes(body.perfil) ? body.perfil : 'pf';
  const lancs = await listar(base.collection('lancamentos'));
  return [200, acao === 'imp_pasta' ? pasta(lancs, ano, perfil) : relatorio(lancs, ano, perfil)];
}

module.exports = { agirImpostos, pasta, relatorio, AVISO };
