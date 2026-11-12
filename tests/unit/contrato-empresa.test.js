// tests/unit/contrato-empresa.test.js
// Testes de aceitação para a atualização da situação da vaga em netlify/functions/central/empresa.js
// Utiliza mocks estáticos para ia-vagas.js e fixa a data atual para garantir determinismo.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Caminhos absolutos dos módulos que serão testados/mocked
const empresaPath = path.join(__dirname, '../../netlify/functions/central/empresa.js');
const iaVagasPath = path.join(__dirname, '../../netlify/functions/central/ia-vagas.js');

/**
 * Carrega o handler da função "empresa" substituindo o módulo ia-vagas.js pelo mock fornecido.
 * @param {object} mockIaVagas - objeto que será exportado por ia-vagas.js
 * @returns {function} - handler exportado por empresa.js
 */
function loadHandlerComMock(mockIaVagas) {
  // Remove possíveis versões já carregadas
  delete require.cache[iaVagasPath];
  delete require.cache[empresaPath];

  // Injeta o mock no cache do require
  require.cache[iaVagasPath] = {
    id: iaVagasPath,
    filename: iaVagasPath,
    loaded: true,
    exports: mockIaVagas,
  };

  // Carrega novamente o handler, que agora usará o mock acima
  return require(empresaPath);
}

// Fixamos a data “atual” usada pela lógica da aplicação para evitar dependência de tempo real.
const FIXED_NOW = new Date('2023-01-02T12:00:00Z').getTime();
const OriginalDateNow = Date.now;
Date.now = () => FIXED_NOW;

// Restaurar Date.now ao final dos testes para não interferir em outros testes.
test.after(() => {
  Date.now = OriginalDateNow;
});

// ---------------------------------------------------------------------------
// Caso comum: último teste dentro das últimas 24 horas → situação "ok"
// ---------------------------------------------------------------------------
test('situacao deve ser "ok" quando há teste recente', async (t) => {
  const mockIaVagas = {
    // Simula retorno de um teste realizado há 12 horas
    obterUltimoTesteVaga: async (vagaId) => ({
      data: '2023-01-02T00:00:00Z', // 12h antes de FIXED_NOW
    }),
  };

  const handler = loadHandlerComMock(mockIaVagas);

  // Simulação de request típica da Netlify Functions
  const event = {
    httpMethod: 'GET',
    queryStringParameters: { vagaId: '123' },
  };

  const response = await handler(event);
  const corpo = JSON.parse(response.body);

  assert.strictEqual(response.statusCode, 200, 'deve responder com status 200');
  assert.strictEqual(corpo.situacao, 'ok', 'situacao deve ser "ok" quando o teste foi recente');
});

// ---------------------------------------------------------------------------
// Caso de borda: nenhum teste nas últimas 24h → situação "não testado"
// ---------------------------------------------------------------------------
test('situacao deve ser "não testado" quando não há teste nas últimas 24h', async (t) => {
  const mockIaVagas = {
    // Simula retorno de um teste realizado há 48 horas
    obterUltimoTesteVaga: async (vagaId) => ({
      data: '2022-12-31T12:00:00Z', // 48h antes de FIXED_NOW
    }),
  };

  const handler = loadHandlerComMock(mockIaVagas);

  const event = {
    httpMethod: 'GET',
    queryStringParameters: { vagaId: '456' },
  };

  const response = await handler(event);
  const corpo = JSON.parse(response.body);

  assert.strictEqual(response.statusCode, 200, 'deve responder com status 200');
  assert.strictEqual(corpo.situacao, 'não testado', 'situacao deve ser "não testado" quando não há teste recente');
});

// ---------------------------------------------------------------------------
// Entrada inválida: parâmetro vagaId ausente → erro de requisição (400)
// ---------------------------------------------------------------------------
test('deve retornar erro 400 quando vagaId está ausente', async (t) => {
  const mockIaVagas = {
    // O mock não será chamado, mas ainda assim o fornecemos para evitar falhas de importação
    obterUltimoTesteVaga: async () => ({ data: null }),
  };

  const handler = loadHandlerComMock(mockIaVagas);

  const event = {
    httpMethod: 'GET',
    queryStringParameters: {}, // vagaId faltando
  };

  const response = await handler(event);
  const corpo = JSON.parse(response.body);

  // Espera‑se que a função indique erro de parâmetro – implementação típica retorna 400
  assert.strictEqual(response.statusCode, 400, 'deve responder com status 400 para requisição inválida');
  assert.ok(corpo.erro, 'deve conter campo "erro" explicando a falha');
});
