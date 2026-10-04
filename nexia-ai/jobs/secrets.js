'use strict';
// ADR-FREE-02: no workflow "NEXIA Jobs" cada segredo do repositório chega como variável de ambiente
// (lista no .env.example). Segredo não cadastrado chega vazio: aqui ele é removido, para o código
// ver "não configurado" como no servidor. Nada é impresso.

function loadSecrets(env) {
  for (const [k, v] of Object.entries(env)) if (v === '' && /^[A-Z][A-Z0-9_]*$/.test(k)) delete env[k];
  // Leitura de repositórios no onboarding: token próprio se houver; senão o do Actions (só leitura).
  if (!env.GITHUB_TOKEN) env.GITHUB_TOKEN = env.NEXIA_GITHUB_TOKEN || env.NEXIA_DEFAULT_GITHUB_TOKEN || '';
  delete env.NEXIA_DEFAULT_GITHUB_TOKEN;
  return env;
}

module.exports = { loadSecrets };
