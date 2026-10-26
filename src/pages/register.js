'use strict';

const { siteKey, verifyTurnstileToken } = require('../config/turnstile');

// Memória local / mock de banco de dados para instâncias em memória em testes
const registeredUsersDB = [];

/**
 * Retorna o HTML ou as propriedades de configuração para renderização do Widget Turnstile.
 * @param {object} [options]
 * @returns {object}
 */
function renderTurnstileWidget(options = {}) {
  return {
    siteKey,
    theme: options.theme || 'auto',
    scriptUrl: 'https://challenges.cloudflare.com/turnstile/v0/api.js',
    html: `<div class="cf-turnstile" data-sitekey="${siteKey}"></div>`,
  };
}

/**
 * Processa a requisição de registro de usuário com verificação do Turnstile token.
 * @param {object} reqData - Dados do cadastro { email, password, name, turnstileToken }
 * @param {Array} [customDb] - Banco opcional para testes
 * @returns {Promise<{status: number, body: object}>}
 */
async function handleRegister(reqData = {}, customDb = registeredUsersDB) {
  const { email, password, name, turnstileToken } = reqData;

  if (!email || !password) {
    return {
      status: 400,
      body: { ok: false, error: 'E-mail e senha são obrigatórios' },
    };
  }

  // Validação do token Turnstile server-side
  const verification = await verifyTurnstileToken(turnstileToken);
  if (!verification.success) {
    return {
      status: 400,
      body: { ok: false, error: 'Validação Turnstile falhou. Token inválido ou ausente.' },
    };
  }

  // Com o token aceito, realiza o registro no banco de dados
  const newUser = {
    id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    email,
    name: name || '',
    createdAt: new Date().toISOString(),
  };

  customDb.push(newUser);

  return {
    status: 200,
    body: { ok: true, user: newUser },
  };
}

module.exports = {
  renderTurnstileWidget,
  handleRegister,
  registeredUsersDB,
};
