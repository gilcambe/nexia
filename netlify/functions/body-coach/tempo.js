'use strict';
// Segunda-feira da semana, no horário de Brasília (o ranking zera toda segunda).
function inicioSemanaBR(agora = Date.now()) {
  const d = new Date(agora - 3 * 3600000);
  const dia = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - dia * 86400000).toISOString().slice(0, 10);
}
module.exports = { inicioSemanaBR };
