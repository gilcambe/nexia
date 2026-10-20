'use strict';
// #832 (Melhoria C14): placar de qualidade por modelo e por tipo de tarefa (coding, reasoning, fast).
// Cada tentativa conta sucesso ou falha (falta de cota NÃO conta: não é culpa do modelo). A cadeia grátis
// é reordenada pelo que funciona de fato, mas só depois de MIN_AMOSTRAS tentativas: comprovado bom sobe,
// comprovado ruim desce, o resto mantém a ordem escolhida à mão (que espalha a carga entre provedores).
const MIN_AMOSTRAS = 3;
const BOM = 0.6;
const RUIM = 0.3;
const MAX_CONTAGEM = 50;   // janela: valores antigos pesam menos (divide por 2 ao passar disso)

const chave = (desc, classe) => `${String(classe || 'geral')}|${String((desc && desc.provider) || '')}|${String((desc && desc.model) || '')}`;

function createQualidade() {
  const tab = {};   // chave -> { s: sucessos, n: tentativas }
  const api = {
    registrar(desc, classe, ok) {
      const k = chave(desc, classe);
      const e = tab[k] || (tab[k] = { s: 0, n: 0 });
      e.n++; if (ok) e.s++;
      if (e.n > MAX_CONTAGEM) { e.n = Math.round(e.n / 2); e.s = Math.round(e.s / 2); }
    },
    /** Taxa suavizada (s+1)/(n+2); null antes de MIN_AMOSTRAS. */
    taxa(desc, classe) {
      const e = tab[chave(desc, classe)];
      return e && e.n >= MIN_AMOSTRAS ? (e.s + 1) / (e.n + 2) : null;
    },
    /** Ordem estável em 3 faixas: comprovados bons, sem dados/medianos (ordem original), comprovados ruins. */
    ordenar(lista, classe) {
      const faixa = d => { const t = api.taxa(d, classe); return t === null ? 1 : t >= BOM ? 0 : t <= RUIM ? 2 : 1; };
      return lista.map((d, i) => ({ d, i, f: faixa(d) })).sort((a, b) => a.f - b.f || a.i - b.i).map(x => x.d);
    },
    /** Linhas para mostrar (Central/diagnóstico): melhor taxa primeiro. */
    placar() {
      return Object.entries(tab).map(([k, e]) => { const [classe, provider, model] = k.split('|'); return { classe, provider, model, sucessos: e.s, tentativas: e.n, taxa: e.n ? e.s / e.n : 0 }; })
        .sort((a, b) => b.taxa - a.taxa || b.tentativas - a.tentativas);
    },
    exportar() { const o = {}; for (const k of Object.keys(tab)) o[k] = { ...tab[k] }; return o; },
    /** Junta com o que outra execução salvou: fica a contagem maior (as duas vêm do mesmo histórico). */
    importar(obj) {
      if (!obj || typeof obj !== 'object') return;
      for (const [k, e] of Object.entries(obj)) {
        if (!e || !Number.isFinite(e.n) || !Number.isFinite(e.s) || e.s > e.n || e.n < 0) continue;
        if (!tab[k] || tab[k].n < e.n) tab[k] = { s: e.s, n: e.n };
      }
    },
    limpar() { for (const k of Object.keys(tab)) delete tab[k]; },
  };
  return api;
}

let compartilhada = null;
const getQualidade = () => compartilhada || (compartilhada = createQualidade());

module.exports = { createQualidade, getQualidade, MIN_AMOSTRAS };
