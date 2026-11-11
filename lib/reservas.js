'use strict';

/**
 * Converte horário no formato "HH:MM" para minutos desde 00:00.
 * @param {string} t
 * @returns {number}
 */
function toMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Converte minutos para string no formato "HH:MM" com zero à esquerda.
 * @param {number} mins
 * @returns {string}
 */
function toString(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Verifica se dois intervalos se sobrepõem.
 * Cada intervalo tem {inicio: "HH:MM", fim: "HH:MM"}.
 * Sobreposição só conta quando há interseção estrita (encostar não conta).
 *
 * @param {{inicio:string,fim:string}} a
 * @param {{inicio:string,fim:string}} b
 * @returns {boolean}
 */
function conflita(a, b) {
  const ai = toMinutes(a.inicio);
  const af = toMinutes(a.fim);
  const bi = toMinutes(b.inicio);
  const bf = toMinutes(b.fim);
  // sobreposição estrita
  return ai < bf && bi < af;
}

/**
 * Gera lista de horários de início de blocos de 1 hora que cabem entre abertura e fechamento
 * e não conflitam com nenhuma reserva. Quando um bloco encontraria conflito, o próximo
 * bloco começa exatamente no fim da reserva que causou o conflito.
 *
 * @param {string} abertura   - horário de abertura "HH:MM"
 * @param {string} fechamento - horário de fechamento "HH:MM"
 * @param {Array<{inicio:string,fim:string}>} reservas
 * @returns {string[]} lista de horários "HH:MM"
 */
function livres(abertura, fechamento, reservas) {
  // ordenar reservas por horário de início para facilitar a varredura
  const sorted = reservas
    .map(r => ({ inicio: toMinutes(r.inicio), fim: toMinutes(r.fim) }))
    .sort((x, y) => x.inicio - y.inicio);

  const fimFechamento = toMinutes(fechamento);
  let cursor = toMinutes(abertura);
  const resultado = [];

  while (cursor + 60 <= fimFechamento) {
    // bloco candidato
    const bloco = { inicio: cursor, fim: cursor + 60 };

    // encontrar primeira reserva que conflita com o bloco
    let conflito = null;
    for (const r of sorted) {
      if (r.fim <= bloco.inicio) continue; // reserva já passou
      if (r.inicio >= bloco.fim) break; // reserva começa depois do bloco, sem conflito
      // há interseção
      if (bloco.inicio < r.fim && r.inicio < bloco.fim) {
        conflito = r;
        break;
      }
    }

    if (conflito) {
      // avançar o cursor para o fim da reserva conflituosa
      cursor = conflito.fim;
    } else {
      // bloco válido
      resultado.push(toString(bloco.inicio));
      cursor += 60;
    }
  }

  return resultado;
}

module.exports = { conflita, livres };
