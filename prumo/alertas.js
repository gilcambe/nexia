'use strict';
/**
 * Prumo Alertas - Integração com regras de alerta e suporte a novas regras.
 */
const alertRules = require('../src/lib/alertRules');

function processarAlertasAtivo(ativo, historicoProventos, dadosPrint) {
  return alertRules.avaliarAlertas(ativo, historicoProventos, dadosPrint);
}

module.exports = {
  processarAlertasAtivo
};
