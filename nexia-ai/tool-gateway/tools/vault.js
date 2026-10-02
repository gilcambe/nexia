'use strict';
// Ferramentas de leitura do Vault (risco LOW). Sempre restritas ao projeto da chamada:
// o projeto, o cliente dele e os registros com project_id (ou client_id) correspondente.
const { SCHEMAS } = require('../../vault/schemas');
const { buildContext } = require('../../context-engine');
const { GatewayError, CODES } = require('../errors');

const PROJECT_SCOPED = Object.keys(SCHEMAS).filter(e => SCHEMAS[e].fields.project_id && !['ToolCall', 'ToolPolicy'].includes(e));
const READABLE = ['Project', 'Client', ...PROJECT_SCOPED];
const ID = { type: 'string' };

function inScope(entity, record, project) {
  if (entity === 'Project') return record.id === project.id;
  if (entity === 'Client') return record.id === project.client_id;
  if (record.project_id) return record.project_id === project.id;
  return !!record.client_id && record.client_id === project.client_id; // ex.: Memory do cliente
}

async function getScoped({ vault, ctx, project }, entity, id) {
  if (!READABLE.includes(entity)) throw new GatewayError(CODES.INVALID_INPUT, `Entidade não legível por esta ferramenta: ${entity}`);
  const record = await vault[entity].get(ctx, id);
  if (!inScope(entity, record, project)) throw new GatewayError(CODES.SCOPE, 'Registro fora do projeto desta chamada.');
  return record;
}

const short = id => String(id).replace(/_([0-9a-f]{6})[0-9a-f]+$/, '_$1…');

module.exports = [
  {
    name: 'vault.get', risk: 'LOW',
    description: 'Lê um registro do Vault do projeto (o projeto, o cliente ou um registro com project_id do projeto).',
    input_schema: { type: 'object', required: ['entity', 'id'], properties: { entity: { type: 'string', enum: READABLE }, id: ID } },
    summarizeInput: i => `${i.entity} ${short(i.id)}`,
    run: (deps, i) => getScoped(deps, i.entity, i.id),
    summarizeOutput: (r, i) => `${i.entity} ${short(r.id)} v${r.version}`,
  },
  {
    name: 'vault.list', risk: 'LOW',
    description: 'Lista registros do projeto de uma entidade (mais recentes primeiro), com filtro opcional de status.',
    input_schema: { type: 'object', required: ['entity'], properties: { entity: { type: 'string', enum: PROJECT_SCOPED }, status: { type: 'string' }, limit: { type: 'integer' } } },
    summarizeInput: i => `${i.entity}${i.status ? ` status=${i.status}` : ''}`,
    async run({ vault, ctx, project }, i) {
      const limit = i.limit === undefined ? 50 : i.limit;
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new GatewayError(CODES.INVALID_INPUT, 'limit deve estar entre 1 e 100.');
      const items = await vault[i.entity].list(ctx, { where: { project_id: project.id }, limit: i.status ? 200 : limit });
      return { items: (i.status ? items.filter(x => x.status === i.status) : items).slice(0, limit) };
    },
    summarizeOutput: (r, i) => `${i.entity}: ${r.items.length} registro(s)`,
  },
  {
    name: 'vault.history', risk: 'LOW',
    description: 'Histórico de auditoria de um registro do projeto (sem valores de campo).',
    input_schema: { type: 'object', required: ['entity', 'id'], properties: { entity: { type: 'string', enum: READABLE }, id: ID } },
    summarizeInput: i => `${i.entity} ${short(i.id)}`,
    async run(deps, i) {
      await getScoped(deps, i.entity, i.id);
      return { items: await deps.vault[i.entity].history(deps.ctx, i.id) };
    },
    summarizeOutput: (r, i) => `${i.entity}: ${r.items.length} evento(s) de auditoria`,
  },
  {
    name: 'vault.context', risk: 'LOW',
    description: 'Contexto compacto do projeto (Context Engine) para uma mensagem, dentro de um orçamento de tokens.',
    input_schema: { type: 'object', properties: { message: { type: 'string' }, budget: { type: 'integer' } } },
    summarizeInput: i => `budget=${i.budget || 1200}`,
    async run({ vault, ctx, project }, i) {
      if (i.budget !== undefined && (i.budget < 200 || i.budget > 8000)) throw new GatewayError(CODES.INVALID_INPUT, 'budget fora da faixa (200–8000).');
      return buildContext({ vault, ctx, projectId: project.id, message: (i.message || '').slice(0, 4000), budgetTokens: i.budget });
    },
    summarizeOutput: r => `${r.items} item(ns), ~${r.tokens_estimated} tokens`,
  },
];
module.exports.READABLE = READABLE;
module.exports.PROJECT_SCOPED = PROJECT_SCOPED;
