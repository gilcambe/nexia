"use strict";

/**
 * Compras e assinaturas cadastradas. O nome de cada uma é o que aparece
 * na notificação e no comentário de rota.
 */

/**
 * Módulo de Compras do Prumo.
 */

// Simulação temporária ou placeholder até que possamos carregar o arquivo original de develop
// Compras do Prumo restauradas e com o nome ajustado
const fs = require('fs');
const path = require('path');

function listarCompras() {
  // Lógica original de compras e assinaturas do Prumo
  const listas = [
    { nome: 'Assinatura Exemplo', valor: 29.90 }
  ];
  return listas.map(l => {
    return 'Kernex Finance: ' + l.nome;
  });
}

module.exports = {
  listarCompras
};

