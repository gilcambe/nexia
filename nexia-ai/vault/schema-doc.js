'use strict';
// Gera VAULT-SCHEMAS.md a partir de schemas.js (fonte única).
//   node nexia-ai/vault/schema-doc.js --write
const fs = require('fs');
const path = require('path');
const { SCHEMAS, ENTITY_NAMES, SECRET_STORES } = require('./schemas');
const { DEPENDENTS, META_FIELDS, LIST_FILTERS } = require('./repository');

const DOC_FILE = path.join(__dirname, '..', '..', 'VAULT-SCHEMAS.md');

function typeOf(def) {
  switch (def.kind) {
    case 'string': return def.patternName ? `string (${def.patternName})` : 'string';
    case 'enum': return 'enum';
    case 'int': return 'int';
    case 'bool': return 'bool';
    case 'timestamp': return 'timestamp';
    case 'url': return 'url (https; http só em localhost)';
    case 'sha': return `sha (${def.lengths.join(' ou ')} hex)`;
    case 'ref': return `ref → ${def.entity}`;
    case 'array': return `array de ${typeOf(def.of)}`;
    case 'object': return 'objeto';
    default: return def.kind;
  }
}

function limits(def) {
  const out = [];
  if (def.kind === 'enum') out.push(def.values.map(v => `\`${v}\``).join(', '));
  if (def.kind === 'string') out.push(`${def.min}–${def.max} caracteres`);
  if (def.kind === 'int') out.push(`${def.min}–${def.max === Number.MAX_SAFE_INTEGER ? '∞' : def.max}`);
  if (def.kind === 'array') {
    out.push(`até ${def.max} itens${def.unique ? ', sem repetição' : ''}`);
    if (def.of.kind === 'enum') out.push(def.of.values.map(v => `\`${v}\``).join(', '));
  }
  return out.join('; ');
}

function rows(shape, prefix = '') {
  const out = [];
  for (const [k, def] of Object.entries(shape)) {
    const name = prefix + k;
    const dflt = def.default === undefined ? '' : (typeof def.default === 'function' ? JSON.stringify(def.default()) : JSON.stringify(def.default));
    out.push(`| \`${name}\` | ${typeOf(def)} | ${def.required ? 'sim' : ''} | ${def.immutable ? 'sim' : ''} | ${dflt} | ${limits(def)} |`);
    if (def.kind === 'object') out.push(...rows(def.shape, `${name}.`));
    if (def.kind === 'array' && def.of.kind === 'object') out.push(...rows(def.of.shape, `${name}[].`));
  }
  return out;
}

function render() {
  const L = [];
  L.push('# Schemas do Vault (NEXIA AI, Fase 2)', '');
  L.push('> Gerado de `nexia-ai/vault/schemas.js` por `node nexia-ai/vault/schema-doc.js --write`. Não edite à mão: o teste unitário `tests/unit/vault-schemas.test.js` falha se este arquivo divergir dos schemas.', '');
  L.push('## Regras comuns', '');
  L.push('- Firestore `nexia-c8710`, coleções de primeiro nível com prefixo `vault_` (decisão D3). Todo documento carrega `tenant_id` (slug do tenant SaaS) e só é visível ao mesmo tenant.');
  L.push(`- Metadados gravados só pelo servidor (rejeitados na entrada): ${META_FIELDS.map(f => `\`${f}\``).join(', ')}.`);
  L.push('- `id` = `{prefixo}_{32 hex}`, gerado pelo servidor, igual ao id do documento. `version` começa em 1 e sobe a cada escrita (etag). Timestamps de metadados são do servidor.');
  L.push('- Campos desconhecidos são rejeitados. `null` só em campo opcional (no update, remove o campo). Todo texto passa pela detecção de secrets (exceto campos `sha` e `ref`).');
  L.push(`- Secret stores aceitos em \`secret_refs[].store\`: ${SECRET_STORES.map(s => `\`${s}\``).join(', ')}. O schema guarda só o nome da variável; não existe campo para valor.`);
  L.push(`- Listagem: registros ativos do tenant, ordem \`updated_at\` desc, no máximo um filtro entre ${LIST_FILTERS.map(f => `\`${f}\``).join(', ')}.`);
  L.push('- Integridade referencial na escrita: o registro referenciado existe, é do mesmo tenant, não está excluído e, se pertence a um projeto, é o mesmo projeto. Com `client_id` e `project_id`, o projeto precisa ser do cliente.');
  L.push('- Soft-delete é bloqueado enquanto houver registro ativo referenciando o alvo (coluna "Referenciado por").', '');
  L.push('## Resumo', '');
  L.push('| Entidade | Coleção | Prefixo do id | schemaVersion | Únicos por tenant | Referenciado por |', '|---|---|---|---|---|---|');
  for (const e of ENTITY_NAMES) {
    const s = SCHEMAS[e];
    const uniq = (s.unique || []).map(u => u.join(' + ')).join('; ');
    const deps = DEPENDENTS[e].map(d => `${d.entity}.${d.field}${d.array ? '[]' : ''}`).join(', ');
    L.push(`| ${e} | \`${s.collection}\` | \`${s.idPrefix}_\` | ${s.schemaVersion} | ${uniq} | ${deps} |`);
  }
  L.push('');
  for (const e of ENTITY_NAMES) {
    const s = SCHEMAS[e];
    L.push(`## ${e}`, '', `Coleção \`${s.collection}\`, id \`${s.idPrefix}_…\`, schemaVersion ${s.schemaVersion}.`, '');
    L.push('| Campo | Tipo | Obrigatório | Imutável | Padrão | Restrições |', '|---|---|---|---|---|---|');
    L.push(...rows(s.fields), '');
    const extra = [];
    if (s.unique) extra.push(`Únicos por tenant: ${s.unique.map(u => u.map(f => `\`${f}\``).join(' + ')).join('; ')}.`);
    if (s.atLeastOne) extra.push(`Pelo menos um de: ${s.atLeastOne.map(g => g.map(f => `\`${f}\``).join(', ')).join('; ')}.`);
    if (s.checks) extra.push(`Regras: ${s.checks.map(([, r]) => `\`${r}\``).join(', ')}.`);
    if (extra.length) L.push(...extra, '');
  }
  return L.join('\n');
}

if (require.main === module) {
  if (process.argv.includes('--write')) { fs.writeFileSync(DOC_FILE, render()); console.log('VAULT-SCHEMAS.md atualizado'); }
  else process.stdout.write(render());
}

module.exports = { render, DOC_FILE };
