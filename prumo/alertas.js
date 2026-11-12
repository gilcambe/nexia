'use strict';
/**
 * Prumo Alertas - Integração com regras de alerta e suporte a novas regras.
 */
const alertRules = require('../src/lib/alertRules');

function processarAlertasAtivo(ativo, historicoProventos, dadosPrint) {
  const alertas = alertRules.avaliarAlertas(ativo, historicoProventos, dadosPrint);
  return {
    alertas,
    dispararEmail: alertas.length > 0
  };
}

module.exports = {
  processarAlertasAtivo
};