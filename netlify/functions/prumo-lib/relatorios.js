'use strict';
/**
 * Kernex Finance: relatório anual e exportar CSV (épico #4013, fase 10; manual seção 2).
 * Exporta relatorioAnual(lancs, ano) e paraCSV(linhas).
 * Chamado por agirExtra (extra.js) via agirRelatorios(acao, body, c).
 * Devolve null se a ação não for daqui.
 */
const ANO = /^\d{4}$/;

function anoDe(data) {
  if (typeof data !== 'string') return null;
  const m = /^(\d{4})-\d{2}-\d{2}$/.exec(data);
  return m ? Number(m[1]) : null;
}

function relatorioAnual(lancs, ano) {
  const meses = [];
  let receitas = 0, despesas = 0;
  const por_categoria = {};
  for (let i = 1; i <= 12; i++) {
    const mes = String(ano) + '-' + String(i).padStart(2, '0');
    let r = 0, d = 0;
    for (const l of (lancs || [])) {
      if (!l || typeof l !== 'object') continue;
      if (l.perfil === 'pj') continue; // PJ de fora
      const y = anoDe(l.data);
      if (y !== ano) continue;
      if (String(l.data).slice(0, 7) !== mes) continue;
      const v = Number(l.valor) || 0;
      if (l.tipo === 'receita') { r += v; }
      else if (l.tipo === 'despesa') {
        d += v;
        const cat = (l.categoria || 'outros').toString();
        por_categoria[cat] = (por_categoria[cat] || 0) + v;
      }
    }
    meses.push({ mes, receitas: r, despesas: d, saldo: r - d });
    receitas += r;
    despesas += d;
  }
  return { ano, meses, receitas, despesas, saldo: receitas - despesas, por_categoria };
}

function paraCSV(linhas) {
  if (!Array.isArray(linhas) || linhas.length === 0) return '';
  const chaves = Object.keys(linhas[0]);
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return String(v).replace('.', ',');
    const s = String(v);
    if (s.includes(';') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const out = [chaves.join(';')];
  for (const l of linhas) out.push(chaves.map((k) => esc(l[k])).join(';'));
  return out.join('\n');
}

async function agirRelatorios(acao, body, c) {
  if (acao !== 'relatorio_anual') return null;
  const a = body && body.ano;
  if (!ANO.test(String(a))) return [400, { error: 'Informe o ano (AAAA).' }];
  const ano = Number(a);
  const lancs = c.listar ? await c.listar(c.base.collection('lancamentos')) : [];
  return [200, relatorioAnual(lancs, ano)];
}

module.exports = { agirRelatorios, relatorioAnual, paraCSV };
