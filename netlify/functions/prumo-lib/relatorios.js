'use strict';
// Fase 10 do épico #4013 (manual CFO Pessoal, seção 2): relatório anual e exportar em planilha (CSV).
const r2 = (n) => Math.round(n * 100) / 100;
const prv = require('./previsto');

/** Totais do ano por mês e por categoria (só despesas). Lançamento PJ fica de fora, como no Início. */
function relatorioAnual(lancs, ano) {
  const a = String(ano);
  const meses = Array.from({ length: 12 }, (_, i) => ({ mes: `${a}-${String(i + 1).padStart(2, '0')}`, receitas: 0, despesas: 0, saldo: 0 }));
  const porCat = {};
  for (const l of Array.isArray(lancs) ? lancs : []) {
    if (!l || l.perfil === 'pj') continue;
    const d = String(l.data || '');
    if (d.slice(0, 4) !== a) continue;
    const m = meses[Number(d.slice(5, 7)) - 1];
    const v = Number(l.valor);
    if (!m || !(v > 0)) continue;
    if (l.tipo === 'receita') m.receitas = r2(m.receitas + v);
    else if (l.tipo === 'despesa') { m.despesas = r2(m.despesas + v); const c = l.categoria || 'Outros'; porCat[c] = r2((porCat[c] || 0) + v); }
  }
  for (const m of meses) m.saldo = r2(m.receitas - m.despesas);
  const receitas = r2(meses.reduce((s, m) => s + m.receitas, 0));
  const despesas = r2(meses.reduce((s, m) => s + m.despesas, 0));
  return { ano: Number(a), meses, receitas, despesas, saldo: r2(receitas - despesas), por_categoria: porCat };
}

/** CSV brasileiro: separador ";", vírgula decimal, aspas quando precisa. */
function paraCSV(linhas) {
  const l = Array.isArray(linhas) ? linhas : [];
  if (!l.length) return '';
  const cols = Object.keys(l[0]);
  const cel = (v) => {
    const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v == null ? '' : v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(';'), ...l.map((o) => cols.map((k) => cel(o[k])).join(';'))].join('\r\n') + '\r\n';
}

async function agirRelatorios(acao, body, c) {
  if (acao !== 'relatorio_anual') return null;
  const ano = Number(body.ano) || Number(String(c.agoraIso).slice(0, 4));
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) return [400, { error: 'Diga o ano com 4 números.' }];
  const lancs = await c.listar(c.base.collection('lancamentos'));
  const r = relatorioAnual(prv.realizados(lancs, 'data', prv.hojeDe(c.agoraIso)), ano);
  return [200, { ...r, csv: paraCSV(r.meses) }];
}

module.exports = { relatorioAnual, paraCSV, agirRelatorios };
