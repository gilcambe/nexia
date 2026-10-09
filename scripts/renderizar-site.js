#!/usr/bin/env node
'use strict';
// Modelo reutilizável de site de cliente: um JSON (spec) vira o site pronto, com a qualidade fixa do Site Kit.
//   node scripts/renderizar-site.js clientes/<slug>/site.json <pasta-de-saida> [clientes/<slug>/midia.json]
//   (midia.json é opcional: { "<espaço>": { url, width, height, alt, credit, provider } }, o mesmo formato que o Cortex monta)
//   node scripts/renderizar-site.js --exemplo      (imprime um spec de exemplo para copiar e editar)
// Sem fotos: o kit usa os espaços padrão; as fotos entram quando o Cortex resolve a mídia.
const fs = require('fs');
const path = require('path');
const kit = require('../nexia-ai/site-kit');
const { SITE_EXAMPLE } = require('../nexia-ai/site-kit/prompt');

function renderizar(raw, saida, media = {}) {
  const { spec, errors } = kit.normalizeSpec(raw, { kind: 'site' });
  if (!spec) throw new Error(`spec inválido: ${errors.join('; ')}`);
  const arquivos = kit.render(spec, media);
  const prefixo = `${spec.folder}/`;
  const escritos = [];
  for (const [caminho, conteudo] of Object.entries(arquivos)) {
    const rel = caminho.startsWith(prefixo) ? caminho.slice(prefixo.length) : caminho;
    if (rel.includes('..') || path.isAbsolute(rel)) throw new Error(`caminho inseguro: ${rel}`);
    const destino = path.join(saida, rel);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, conteudo);
    escritos.push(rel);
  }
  return { spec, escritos };
}

if (require.main === module) {
  const [a, b, m] = process.argv.slice(2);
  if (a === '--exemplo') { console.log(JSON.stringify(SITE_EXAMPLE, null, 2)); process.exit(0); }
  if (!a || !b) { console.error('uso: node scripts/renderizar-site.js <spec.json> <pasta-de-saida>'); process.exit(2); }
  try {
    const { spec, escritos } = renderizar(JSON.parse(fs.readFileSync(a, 'utf8')), b, m && fs.existsSync(m) ? JSON.parse(fs.readFileSync(m, 'utf8')) : {});
    console.log(`site "${spec.name}": ${escritos.length} arquivo(s) em ${b}`);
  } catch (e) { console.error(e.message); process.exit(1); }
}

module.exports = { renderizar };
