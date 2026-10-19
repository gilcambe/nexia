'use strict';
// Placar de cota: lembra quais modelos estão sem cota e até quando.
// chave = "provider|model"; valor = { ate: epochMs, motivo }
//
// Parte 1 de #821: evita chamar de novo um modelo que já estourou a cota
// dentro de uma execução, para a próxima não gastar chamada sem sucesso.
const SEIS_H = 6 * 60 * 60 * 1000;
const VINTE_E_QUATRO_H = 24 * 60 * 60 * 1000;
const DOIS_MIN = 2 * 60 * 1000;
const SESSENTA_S = 60 * 1000;

function chaveDe(desc) {
  if (typeof desc === 'string') return desc;
  if (desc && typeof desc === 'object')
    return `${String(desc.provider || '')}|${String(desc.model || '')}`;
  return String(desc);
}

function createPlacar({ agora = () => Date.now() } = {}) {
  const placar = {}; // chave -> { ate: number, motivo: string }

  function castigo(tipo, retryAfterMs) {
    switch (tipo) {
      case 'daily':
        return retryAfterMs ? Number(retryAfterMs) : SEIS_H;
      case 'rate':
        return Math.max(Number(retryAfterMs || 0), SESSENTA_S);
      case 'fatal':
        return VINTE_E_QUATRO_H;
      case 'busy':
        return DOIS_MIN;
      default:
        return null; // não marca
    }
  }

  return {
    /** Marca um modelo como sem cota por um tempo de castigo. */
    marcar(desc, tipo, retryAfterMs) {
      const ms = castigo(tipo, retryAfterMs);
      if (ms === null) return;
      const k = chaveDe(desc);
      placar[k] = { ate: agora() + ms, motivo: tipo };
    },
    /** true se o modelo ainda está bloqueado. */
    bloqueado(desc) {
      const k = chaveDe(desc);
      const e = placar[k];
      return !!e && e.ate > agora();
    },
    /**
     * Devolve a lista sem os bloqueados. Se todos estiverem bloqueados,
     * devolve a lista inteira ordenada pelo ate mais cedo (nunca vazia).
     */
    ordenar(lista) {
      const agora_ = agora();
      const livres = [];
      const bloqueados = [];
      for (const item of lista) {
        const k = chaveDe(item);
        const e = placar[k];
        if (e && e.ate > agora_) bloqueados.push({ item, ate: e.ate });
        else livres.push(item);
      }
      if (livres.length) return livres;
      return bloqueados
        .sort((a, b) => a.ate - b.ate)
        .map(x => x.item);
    },
    /** Objeto simples para salvar no D1 (parte 3). */
    exportar() {
      const out = {};
      for (const k of Object.keys(placar)) out[k] = { ...placar[k] };
      return out;
    },
    /** Importa objeto simples; ignora entradas vencidas. */
    importar(obj) {
      if (!obj || typeof obj !== 'object') return;
      const agora_ = agora();
      for (const k of Object.keys(obj)) {
        const e = obj[k];
        if (!e || typeof e.ate !== 'number') continue;
        if (e.ate <= agora_) continue; // vencido: ignora
        placar[k] = { ate: e.ate, motivo: String(e.motivo || '') };
      }
    },
    /** Fica vazio por enquanto (parte 4). */
    registrarCabecalhos(desc, headers) {
      // intencionalmente vazio
    },
  };
}

let placarCompartilhado = null;
function getPlacar() {
  if (!placarCompartilhado) placarCompartilhado = createPlacar();
  return placarCompartilhado;
}

module.exports = { createPlacar, getPlacar };
