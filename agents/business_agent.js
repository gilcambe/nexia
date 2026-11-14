const { RESERVA } = require('../lib/groq-modelo');

function createBusinessAgent(options = {}) {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('Options must be an object');
  }

  return {
    ...options,
    modelo: RESERVA
  };
}

module.exports = {
  createBusinessAgent
};
