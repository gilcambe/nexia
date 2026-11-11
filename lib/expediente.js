/**
 * Verifica se a loja está aberta no horário informado.
 *
 * @param {number} diaDaSemana - 0 (domingo) a 6 (sábado)
 * @param {string} hora - string no formato "HH:MM"
 * @returns {boolean} true se estiver aberto, false caso contrário ou se a entrada for inválida
 */
function estaAberta(diaDaSemana, hora) {
  // validação básica do formato HH:MM
  if (typeof hora !== 'string' || !/^\d{2}:\d{2}$/.test(hora)) {
    return false;
  }

  const [horasStr, minutosStr] = hora.split(':');
  const horas = Number(horasStr);
  const minutos = Number(minutosStr);

  // validação dos limites numéricos
  if (
    Number.isNaN(horas) ||
    Number.isNaN(minutos) ||
    horas < 0 ||
    horas > 23 ||
    minutos < 0 ||
    minutos > 59
  ) {
    return false;
  }

  // converte para minutos desde 00:00 para facilitar comparações
  const totalMinutos = horas * 60 + minutos;

  // domingo fechado
  if (diaDaSemana === 0) {
    return false;
  }

  // segunda a sexta
  if (diaDaSemana >= 1 && diaDaSemana <= 5) {
    const abre = 8 * 60;   // 08:00
    const fecha = 18 * 60; // 18:00 (exclusivo)
    return totalMinutos >= abre && totalMinutos < fecha;
  }

  // sábado
  if (diaDaSemana === 6) {
    const abre = 8 * 60;   // 08:00
    const fecha = 12 * 60; // 12:00 (exclusivo)
    return totalMinutos >= abre && totalMinutos < fecha;
  }

  // qualquer outro valor de dia (fora do intervalo 0‑6) é considerado fechado
  return false;
}

// Exporta a função como módulo principal
module.exports = estaAberta;
