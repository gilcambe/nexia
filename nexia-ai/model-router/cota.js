'use strict';
// Placar de castigos de cota (ADR-FREE-05). Modelos punidos (ex.: cota do dia esgotada)
// somem da lista de candidatos até o tempo do castigo vencer. Tudo na memória do
// Worker; se o Worker reiniciar, os castigos somam (planos grátis reabrem sozinho).

const punicoes = new Map(); // chave: "provedor/modelo" → { kind, until }

function chave(desc) { return `${desc.provider}/${desc.model}`; }

function getPlacar() {
  return {
    /** Registra um castigo: desc fica fora da lista por ms ms (tipo 'daily', etc.). */
    marcar(desc, kind, ms) {
      if (!desc || !kind || !ms) return;
      punicoes.set(chave(desc), { kind, until: Date.now() + Math.max(0, ms) });
    },
    /** Devolve lista sem os modelos cujo castigo ainda está ativo. */
    ordenar(lista) {
      const agora = Date.now();
      const out = [];
      for (const d of lista || []) {
        const p = punicoes.get(chave(d));
        if (p && agora < p.until) continue; // castigo ativo: fica de fora
        if (p) punicoes.delete(chave(d));   // castigo venceu: volta
        out.push(d);
      }
      return out;
    },
  };
}

module.exports = { getPlacar };
