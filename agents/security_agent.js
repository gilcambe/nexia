const { RESERVA, comGroq } = require('../lib/groq-modelo');

const securityAgent = {
  modelo: RESERVA,
  model: RESERVA,
  comGroq
};

module.exports = securityAgent;
