// Testes E2E para o painel da Viajante Pro
const assert = require('assert');
const { test, before, after } = require('node:test');
const { JSDOM } = require('jsdom');

let dom;
let window;
let document;

before(() => {
  dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <head>
        <script src="../../sites/viajantepro/painel/painel.js"></script>
      </head>
      <body>
        <div id="area-deslogada"></div>
        <div id="area-logada" class="oculto"></div>
      </body>
    </html>
  `, { runScripts: 'dangerously' });
  window = dom.window;
  document = window.document;
  global.fetch = require('node-fetch');
});

after(() => {
  dom.window.close();
});

test('Login e criação de cliente', async () => {
  // Simular API falsa
  global.fetch = async (url, options) => {
    if (url.includes('/login')) {
      return {
        ok: true,
        json: async () => ({ token: 'fake-token' })
      };
    }
    if (url.includes('/clientes')) {
      return {
        ok: true,
        json: async () => ({ id: '1', nome: 'Cliente Teste' })
      };
    }
    throw new Error('Endpoint não implementado');
  };

  // Simular formulário de login
  const emailInput = document.createElement('input');
  emailInput.id = 'input-email';
  emailInput.value = 'teste@example.com';
  document.body.appendChild(emailInput);

  const senhaInput = document.createElement('input');
  senhaInput.id = 'input-senha';
  senhaInput.value = 'senha123';
  document.body.appendChild(senhaInput);

  const loginForm = document.createElement('form');
  loginForm.onsubmit = window.executarLogin;
  document.body.appendChild(loginForm);

  // Submeter formulário
  await loginForm.dispatchEvent(new window.Event('submit'));

  // Verificar se a área logada foi exibida
  assert.strictEqual(document.getElementById('area-logada').classList.contains('oculto'), false);

  // Criar cliente
  const cliente = await window.apiRequest('/clientes', 'POST', { nome: 'Cliente Teste' });
  assert.strictEqual(cliente.nome, 'Cliente Teste');
});

// Adicione mais testes conforme necessário
