'use strict';
// Ferramentas de Firebase e Cloudflare (spec §10, §11, §13; Fase 9). Somente leitura
// (LOW) e só para projetos que têm a integração cadastrada e ativa no Vault.
const { createFirebaseAdapter } = require('../../firebase-adapter');
const { createCloudflareAdapter } = require('../../cloudflare-adapter');
const { integrationFor, credentialFor } = require('../../integrations');

const INTEGRATION_ID = { type: 'string' };

async function firebase(deps, i) {
  const it = await integrationFor(deps, 'firebase', i.integration_id);
  return createFirebaseAdapter({ projectId: it.external_ref, credential: credentialFor(deps, it), fetchImpl: deps.fetchImpl });
}
async function cloudflare(deps, i) {
  const it = await integrationFor(deps, 'cloudflare', i.integration_id);
  return createCloudflareAdapter({ externalRef: it.external_ref, token: credentialFor(deps, it), fetchImpl: deps.fetchImpl });
}
const used = s => Object.entries(s).filter(([k, v]) => v && typeof v === 'object' && v.used).map(([k]) => k);

module.exports = [
  {
    name: 'firebase.get_project', risk: 'LOW',
    description: 'Dados do projeto Firebase do projeto (id, nome, site do Hosting, bucket, região).',
    input_schema: { type: 'object', properties: { integration_id: INTEGRATION_ID } },
    summarizeInput: () => 'projeto Firebase',
    async run(deps, i) { return (await firebase(deps, i)).getProject(); },
    summarizeOutput: r => `${r.project_id} (${r.state || 'estado desconhecido'})`,
  },
  {
    name: 'firebase.get_status', risk: 'LOW',
    description: 'Estado de Hosting (último release), regras publicadas, bancos Firestore e Cloud Functions do projeto Firebase.',
    input_schema: { type: 'object', properties: { integration_id: INTEGRATION_ID } },
    summarizeInput: () => 'estado do Firebase',
    async run(deps, i) { return (await firebase(deps, i)).getStatus(); },
    summarizeOutput: r => `${r.project_id}: usa ${used(r).join(', ') || 'nenhum produto visível'}`,
  },
  {
    name: 'cloudflare.get_deployment_status', risk: 'LOW',
    description: 'Últimos deploys do Cloudflare Pages ou Workers do projeto (e domínios customizados do Pages).',
    input_schema: { type: 'object', properties: { integration_id: INTEGRATION_ID, limit: { type: 'integer', minimum: 1, maximum: 20 } } },
    summarizeInput: i => `deploys Cloudflare${i.limit ? ` (${i.limit})` : ''}`,
    async run(deps, i) { return (await cloudflare(deps, i)).deploymentStatus(i); },
    summarizeOutput: r => `${r.kind} ${r.name}: ${r.deployments.length} deploy(s)`,
  },
  {
    name: 'cloudflare.list_dns', risk: 'LOW',
    description: 'Registros DNS da zona Cloudflare do projeto (conteúdo de TXT omitido).',
    input_schema: { type: 'object', properties: { integration_id: INTEGRATION_ID, limit: { type: 'integer', minimum: 1, maximum: 100 } } },
    summarizeInput: () => 'DNS Cloudflare',
    async run(deps, i) { return (await cloudflare(deps, i)).listDns(i); },
    summarizeOutput: r => `${r.records.length} registro(s)`,
  },
];
