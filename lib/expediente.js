/**
 * Verifica se a loja está aberta em determinado dia e horário.
 *
 * @param {number} day  Dia da semana (0 = domingo … 6 = sábado)
 * @param {string} time Horário no formato "HH:MM"
 * @returns {boolean} true se estiver aberta, false caso contrário
 */
function isOpen(day, time) {
  // Validação do dia
  if (!Number.isInteger(day) || day < 0 || day > 6) {
    return false;
  }

  // Validação e parsing do horário
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) {
    return false;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const totalMinutes = hour * 60 + minute;

  // Definir intervalos de funcionamento (em minutos desde 00:00)
  const OPEN_MORNING = 8 * 60; // 08:00
  const CLOSE_FRIDAY_EVENING = 18 * 60; // 18:00
  const CLOSE_SATURDAY_NOON = 12 * 60; // 12:00

  switch (day) {
    case 0: // domingo
      return false;

    case 1: // segunda
    case 2: // terça
    case 3: // quarta
    case 4: // quinta
    case 5: // sexta
      return totalMinutes >= OPEN_MORNING && totalMinutes < CLOSE_FRIDAY_EVENING;

    case 6: // sábado
      return totalMinutes >= OPEN_MORNING && totalMinutes < CLOSE_SATURDAY_NOON;

    default:
      return false;
  }
}

// Exporta a função (pode ser como exportação direta ou como propriedade)
module.exports = isOpen;
