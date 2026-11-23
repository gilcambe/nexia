const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pedidoPath = path.join(__dirname, '../../nexia-ai/contrato/regua/tarefas/await/pedido.md');
const visivelPath = path.join(__dirname, '../../nexia-ai/contrato/regua/tarefas/await/visivel.test.js');
const ocultoPath = path.join(__dirname, '../../nexia-ai/contrato/regua/tarefas/await/oculto.test.js');

test('pedido.md deve conter instruções sobre validarToken e await', () => {
  const conteudo = fs.readFileSync(pedidoPath, 'utf8');
  assert.equal(conteudo.includes('validarToken'), true);
  assert.equal(conteudo.includes('await'), true);
});

test('visivel.test.js deve passar com await e falhar sem await', async () => {
  const runVisivel = require(visivelPath);

  const solucaoCorreta = {
    processarToken: async (token, validarToken) => {
      const res = await validarToken(token);
      return res;
    }
  };

  const solucaoSemAwait = {
    processarToken: (token, validarToken) => {
      const res = validarToken(token);
      return res === true;
    }
  };

  await assert.doesNotReject(async () => {
    await runVisivel(solucaoCorreta);
  });

  await assert.rejects(async () => {
    await runVisivel(solucaoSemAwait);
  });
});

test('oculto.test.js deve validar casos corretos e falhar para incorretos', async () => {
  const runOculto = require(ocultoPath);

  const solucaoCorreta = {
    processarToken: async (token, validarToken) => {
      const res = await validarToken(token);
      return res;
    }
  };

  const solucaoIncorreta = {
    processarToken: async () => true
  };

  await assert.doesNotReject(async () => {
    await runOculto(solucaoCorreta);
  });

  await assert.rejects(async () => {
    await runOculto(solucaoIncorreta);
  });
});
