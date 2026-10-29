'use strict';
// Teste de validação de caminho inexistente e regras de plano do Cortex (Issue #2114 / #2106)
const test = require('node:test');
const assert = require('node:assert');
const {
  decidir,
  caminhosDoPedido,
  mexeEmWorkflow,
  precisaDividir,
  MAX_TENTATIVAS
} = require('../scripts/cortex-fila');
const P = require('../scripts/cortex-plano');

test('Validação de caminho inexistente e regras do plano do Cortex', async (t) => {
  await t.test('caminhosDoPedido extrai o caminho inexistente src/middleware/rateLimiter.js', () => {
    const corpo = 'Implementar controle de taxa de requisições em `src/middleware/rateLimiter.js`.';
    const caminhos = caminhosDoPedido(corpo);
    assert.deepStrictEqual(caminhos, ['src/middleware/rateLimiter.js']);
  });

  await t.test('P.classificar processa pedido com arquivo inexistente src/middleware/rateLimiter.js', () => {
    const corpo = 'Criar middleware em `src/middleware/rateLimiter.js`.';
    const res = P.classificar({ corpo, tamanhos: {} });
    assert.strictEqual(res.tamanho, 'pequeno');
    assert.deepStrictEqual(res.arquivos, ['src/middleware/rateLimiter.js']);
    assert.strictEqual(res.grandes.length, 0);
  });

  await t.test('P.validarPlano valida estrutura de plano com src/middleware/rateLimiter.js e recusa caminhos inválidos', () => {
    const planoValido = [
      {
        titulo: 'Criar rateLimiter',
        tarefa: 'Implementar a lógica de limitação em `src/middleware/rateLimiter.js`.',
        arquivos: ['src/middleware/rateLimiter.js'],
        depende: [],
        pronto: 'Testes de unidade do rateLimiter passando.'
      },
      {
        titulo: 'Aplicar no servidor',
        tarefa: 'Importar e registrar o rateLimiter no servidor principal.',
        arquivos: ['server.js'],
        depende: [1],
        pronto: 'Servidor inicia normalmente com o middleware.'
      }
    ];

    const resultadoValido = P.validarPlano(planoValido);
    assert.ok(resultadoValido, 'Plano bem formatado deve ser validado');
    assert.strictEqual(resultadoValido.length, 2);
    assert.deepStrictEqual(resultadoValido[0].arquivos, ['src/middleware/rateLimiter.js']);

    const planoCaminhoInvalido = [
      {
        titulo: 'Invalido',
        tarefa: 'Tentativa de acessar caminho fora do repositório.',
        arquivos: ['../src/middleware/rateLimiter.js'],
        depende: [],
        pronto: 'Teste de falha de validação.'
      },
      {
        titulo: 'Invalido 2',
        tarefa: 'Outra tarefa associada no repositório.',
        arquivos: ['server.js'],
        depende: [],
        pronto: 'Teste de falha 2'
      }
    ];
    assert.strictEqual(P.validarPlano(planoCaminhoInvalido), null, 'Plano com caminhos contendo ../ deve ser recusado');
  });

  await t.test('decidir trava tarefa com caminho inexistente após atingir MAX_TENTATIVAS', () => {
    const AGORA = Date.parse('2026-10-29T12:00:00Z');
    const issueInexistente = {
      number: 2114,
      author_association: 'OWNER',
      title: 'Ajustar rateLimiter em src/middleware/rateLimiter.js',
      body: 'Modificar `src/middleware/rateLimiter.js` para limitar requisições.',
      labels: [
        { name: 'cortex-fila' },
        { name: 'cortex-rodando' },
        { name: 'pista-1' },
        { name: `tentativa-${MAX_TENTATIVAS}` }
      ],
      created_at: '2026-10-29T10:00:00Z',
      updated_at: '2026-10-29T11:55:00Z',
      state: 'open'
    };

    const runFalha = {
      id: 999,
      name: 'Cortex #2114',
      status: 'completed',
      conclusion: 'failure'
    };

    const acoes = decidir({
      issues: [issueInexistente],
      runs: [runFalha],
      agora: AGORA
    });

    assert.strictEqual(acoes.length, 1);
    assert.strictEqual(acoes[0].tipo, 'travar', 'Ao atingir MAX_TENTATIVAS com falha, a fila deve travar a tarefa');
    assert.strictEqual(acoes[0].numero, 2114);
  });

  await t.test('mexeEmWorkflow detecta alterações em workflows do GitHub', () => {
    const issueWorkflow = {
      number: 2114,
      body: 'Ajustar `.github/workflows/cortex-fila.yml` para novas validações.'
    };
    assert.strictEqual(mexeEmWorkflow(issueWorkflow), true);

    const issueNormal = {
      number: 2114,
      body: 'Modificar `src/middleware/rateLimiter.js` para limitar acessos.'
    };
    assert.strictEqual(mexeEmWorkflow(issueNormal), false);
  });

  await t.test('P.revisarDiff acusa quando a alteração em PR não inclui o arquivo previsto no plano (src/middleware/rateLimiter.js)', () => {
    const meta = {
      arquivos: ['src/middleware/rateLimiter.js'],
      limite: 400
    };
    const filesPRIncorreto = [
      { filename: 'server.js', additions: 15, deletions: 2 }
    ];

    const problemas = P.revisarDiff(meta, filesPRIncorreto);
    assert.ok(
      problemas.some(p => p.includes('mexeu fora do plano') || p.includes('não mexeu em nenhum arquivo do plano')),
      'Deve identificar que o PR não alterou o arquivo previsto no plano'
    );
  });
});
