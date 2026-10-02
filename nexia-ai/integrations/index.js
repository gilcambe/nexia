'use strict';
// Integrações por projeto (spec §10, §11): qual Integration do Vault usar e qual
// credencial do servidor ela pode ler.
//
// O Vault guarda só a referência (nome da variável de ambiente, spec §15). Para um
// tenant não conseguir apontar para a credencial de outro, o nome tem que ser
//   NEXIA_<PROVEDOR>_<TENANT>_<SUFIXO>     ex.: NEXIA_FIREBASE_NEXIA_SA, NEXIA_CLOUDFLARE_ALFA_TOKEN
// com <TENANT> = slug do tenant em maiúsculas ("-" vira "_"). Quem cria a variável no
// Render é o dono; o valor nunca passa pelo Vault, pelo log ou pela resposta.
const { GatewayError, CODES } = require('../tool-gateway/errors');

const tenantTag = tenantId => String(tenantId).toUpperCase().replace(/[^A-Z0-9]/g, '_');
const allowedPrefix = (provider, tenantId) => `NEXIA_${provider.toUpperCase()}_${tenantTag(tenantId)}_`;

/** Integration ativa do provedor para o projeto (a indicada ou a única). */
async function integrationFor({ vault, ctx, project }, provider, integrationId) {
  let it;
  if (integrationId) {
    it = await vault.Integration.get(ctx, integrationId);
    if (it.project_id !== project.id) throw new GatewayError(CODES.SCOPE, 'Integração fora do projeto desta chamada.');
    if (it.provider !== provider) throw new GatewayError(CODES.INVALID_INPUT, `A integração não é do ${provider}.`);
  } else {
    const all = (await vault.Integration.list(ctx, { where: { project_id: project.id }, limit: 50 })).filter(i => i.provider === provider);
    if (all.length > 1) throw new GatewayError(CODES.INVALID_INPUT, `O projeto tem ${all.length} integrações ${provider}; informe integration_id.`);
    it = all[0];
  }
  if (!it) throw new GatewayError(CODES.INVALID_INPUT, `O projeto não usa ${provider} (nenhuma integração cadastrada no Vault).`);
  if (it.status !== 'active') throw new GatewayError(CODES.INVALID_INPUT, `A integração ${provider} está ${it.status}.`);
  if (!it.external_ref) throw new GatewayError(CODES.INVALID_INPUT, `A integração ${provider} não tem external_ref.`);
  return it;
}

/** Valor da credencial referenciada pela Integration, se o nome for do próprio tenant. */
function credentialFor({ env, ctx }, integration) {
  const prefix = allowedPrefix(integration.provider, ctx.tenantId);
  const ref = (integration.secret_refs || []).find(r => r.store === 'env' || r.store === 'render');
  if (!ref) throw new GatewayError(CODES.INVALID_INPUT, `A integração não referencia credencial (secret_refs com store "env" e nome ${prefix}...).`);
  if (!ref.name.startsWith(prefix) || ref.name.length === prefix.length) {
    throw new GatewayError(CODES.SCOPE, `A credencial desta integração tem que se chamar ${prefix}<NOME>.`);
  }
  const value = env[ref.name];
  if (!value) throw new GatewayError(CODES.CREDENTIAL_MISSING, `A variável ${ref.name} não está configurada no servidor.`);
  return value;
}

module.exports = { integrationFor, credentialFor, allowedPrefix, tenantTag };
