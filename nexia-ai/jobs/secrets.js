'use strict';
// ADR-FREE-02: no workflow "NEXIA Jobs" os segredos chegam juntos em NEXIA_SECRETS_JSON
// (toJSON(secrets)); aqui entram em process.env só os nomes que o código do NEXIA usa.
// Nada é impresso. Variável já definida não é sobrescrita.

const ALLOWED = /^(FIREBASE_[A-Z0-9_]+|MASTER_EMAIL|GITHUB_APP_[A-Z_]+|GITHUB_TOKEN|NEXIA_GITHUB_TOKEN|NEXIA_(FIREBASE|CLOUDFLARE)_[A-Z0-9_]+|[A-Z]+_API_KEY|CLOUDFLARE_AI_TOKEN|CLOUDFLARE_ACCOUNT_ID|NEXIA_MODELS_[A-Z]+)$/;

function loadSecrets(env) {
  let all = {};
  try { all = JSON.parse(env.NEXIA_SECRETS_JSON || '{}') || {}; } catch { all = {}; }
  delete env.NEXIA_SECRETS_JSON;
  for (const [k, v] of Object.entries(all)) {
    if (typeof v === 'string' && v && ALLOWED.test(k) && env[k] === undefined) env[k] = v;
  }
  // Leitura de repositórios no onboarding: token próprio se houver; senão o do Actions (só leitura).
  if (!env.GITHUB_TOKEN) env.GITHUB_TOKEN = env.NEXIA_GITHUB_TOKEN || env.NEXIA_DEFAULT_GITHUB_TOKEN || '';
  delete env.NEXIA_DEFAULT_GITHUB_TOKEN;
  return env;
}

module.exports = { loadSecrets, ALLOWED };
