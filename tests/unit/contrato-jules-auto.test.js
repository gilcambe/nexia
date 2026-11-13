const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

// O módulo a ser testado
const julesAuto = require('../../cloudflare/jules-auto.js');

// Helper para criar issues simuladas
function criarIssue(id, createdAt, labels = [], hasPr = false) {
  return {
    number: id,
    created_at: createdAt,
    labels: labels.map(name => ({ name })),
    pull_requests: hasPr ? [{ url: `https://api.github.com/pulls/${id}` }] : [],
    // Simula a presença de PR que cita #N via campo mock
    hasCitation: hasPr,
  };
}

/**
 * Mock das funções externas que o módulo usa internamente.
 * Elas são substituídas diretamente nas propriedades exportadas do módulo
 * (assumindo que o código exporta essas referências para facilitar teste).
 */
const chamadas = {
  mandarParaJules: [],
  comentar: [],
};

function resetMocks() {
  chamadas.mandarParaJules = [];
  chamadas.comentar = [];
}

// Substitui as dependências do módulo por mocks simples
if (typeof julesAuto.__setMocks === 'function') {
  julesAuto.__setMocks({
    mandarParaJules: (issue) => chamadas.mandarParaJules.push(issue),
    comentar: (issue, msg) => chamadas.comentar.push({ issue, msg }),
  });
}

/**
 * Testes de aceitação
 */
test('reenvia a issue mais antiga que não está excluída quando há cota', async (t) => {
  resetMocks();
  const issues = [
    criarIssue(1, '2023-01-01T00:00:00Z', ['precisa-de-voce']), // mais antiga
    criarIssue(2, '2023-02-01T00:00:00Z', ['precisa-de-voce']),
    criarIssue(3, '2023-03-01T00:00:00Z', ['precisa-de-voce', 'so-humano']), // deve ser pulada
  ];

  const contexto = {
    MAX_ENVIOS: 2,
    julesSemCota: false,
    ESPERA_JULES_H: 2, // horas
    // Função que simula a busca de issues abertas com o label "precisa-de-voce"
    buscarIssues: () => Promise.resolve(issues),
    // Simula a verificação de PR aberto que cite #N
    temPrComCitacao: (issue) => false,
  };

  // Chama a rotina principal (assumindo que exista exportada como `processar`)
  await julesAuto.processar(contexto);

  // Deve ter chamado mandarParaJules apenas para a issue 1 (mais antiga) e 2 (até MAX_ENVIOS)
  assert.equal(chamadas.mandarParaJules.length, 2, 'deve chamar mandarParaJules duas vezes');
  assert.equal(chamadas.mandarParaJules[0].number, 1, 'primeira issue enviada deve ser a mais antiga');
  assert.equal(chamadas.mandarParaJules[1].number, 2, 'segunda issue enviada deve ser a próxima mais antiga');
  // Issue 3 tem label "so-humano" e não deve ser enviada
  const idsEnviados = chamadas.mandarParaJules.map(i => i.number);
  assert.ok(!idsEnviados.includes(3), 'issues com label so-humano são ignoradas');
});

test('não envia nada quando Jules está sem cota', async (t) => {
  resetMocks();
  const issues = [criarIssue(10, '2023-01-01T00:00:00Z', ['precisa-de-voce'])];
  const contexto = {
    MAX_ENVIOS: 5,
    julesSemCota: true, // sem cota
    ESPERA_JULES_H: 2,
    buscarIssues: () => Promise.resolve(issues),
    temPrComCitacao: () => false,
  };

  await julesAuto.processar(contexto);
  assert.equal(chamadas.mandarParaJules.length, 0, 'nenhuma chamada a mandarParaJules quando não há cota');
});

test('não reenvia issues que já possuem o label jules-ultima-chance ou PR citando #N', async (t) => {
  resetMocks();
  const issues = [
    criarIssue(20, '2023-01-01T00:00:00Z', ['precisa-de-voce', 'jules-ultima-chance']), // já marcada
    criarIssue(21, '2023-01-02T00:00:00Z', ['precisa-de-voce']), // tem PR que cita #N
    criarIssue(22, '2023-01-03T00:00:00Z', ['precisa-de-voce']), // válida
  ];

  const contexto = {
    MAX_ENVIOS: 3,
    julesSemCota: false,
    ESPERA_JULES_H: 2,
    buscarIssues: () => Promise.resolve(issues),
    temPrComCitacao: (issue) => issue.number === 21,
  };

  await julesAuto.processar(contexto);
  // Apenas a issue 22 deve ser enviada
  assert.equal(chamadas.mandarParaJules.length, 1, 'deve enviar somente a issue elegível');
  assert.equal(chamadas.mandarParaJules[0].number, 22, 'issue enviada deve ser a que não tem restrições');
});
