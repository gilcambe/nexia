'use strict';
// Configuração de planos do Cortex.
// Limites de uso por janela e pesos de prioridade para a fila.
// Ordem de prioridade da fila: Pro > Plus > Essencial > Grátis.

// Limite por janela = quantas requisições cada plano pode fazer na janela.
// Janela 'dia' = contagem reiniciada a cada 24h.
const LIMITE_JANELA = {
  gratis: 30,   // Grátis: 30 por dia
  essencial: 100,
  plus: 500,
  pro: 2000,
};

// Peso de prioridade para a fila (quanto maior, mais rápido passa na frente).
// Pro > Plus > Essencial > Grátis.
const PESO_FILA = {
  pro: 4,
  plus: 3,
  essencial: 2,
  gratis: 1,
};

// Nome amigável de cada plano.
const NOME_PLANO = {
  gratis: 'Grátis',
  essencial: 'Essencial',
  plus: 'Plus',
  pro: 'Pro',
};

// Ordem da fila, da maior para a menor prioridade.
const ORDEM_FILA = ['pro', 'plus', 'essencial', 'gratis'];

// Janela de contagem usada por todos os planos.
const JANELA = 'dia';

// Devolve o objeto de configuração de um plano pelo id.
// Retorna null se o id não existir.
function planoPorId(id) {
  const ids = ['gratis', 'essencial', 'plus', 'pro'];
  if (!ids.includes(String(id || '').toLowerCase())) return null;
  const chave = String(id).toLowerCase();
  return {
    id: chave,
    nome: NOME_PLANO[chave],
    limiteJanela: LIMITE_JANELA[chave],
    janela: JANELA,
    pesoFila: PESO_FILA[chave],
  };
}

// Devolve o peso de fila de um plano (1 a 4).
function pesoFila(id) {
  const plano = planoPorId(id);
  return plano ? plano.pesoFila : PESO_FILA.gratis;
}

// Devolve o limite de janela de um plano.
function limiteJanela(id) {
  const plano = planoPorId(id);
  return plano ? plano.limiteJanela : LIMITE_JANELA.gratis;
}

// Devolve true se o planoA tem prioridade maior ou igual ao planoB na fila.
function prioridadeMaiorOuIgual(planoA, planoB) {
  return pesoFila(planoA) >= pesoFila(planoB);
}

module.exports = {
  LIMITE_JANELA,
  PESO_FILA,
  NOME_PLANO,
  ORDEM_FILA,
  JANELA,
  planoPorId,
  pesoFila,
  limiteJanela,
  prioridadeMaiorOuIgual,
};
