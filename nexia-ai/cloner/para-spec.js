'use strict';

const fs = require('fs');
const path = require('path');

const { normalizeSpec } = require('./spec.js');

/**
 * Lê um JSON com tolerância a comentários/BOM e retorna o objeto ou {} em caso de erro.
 */
function _lerJson(caminho) {
  try {
    const texto = fs.readFileSync(caminho, 'utf8');
    const limpo = texto
      .replace(/^\uFEFF/, '')        // remove BOM
      .replace(/\/\/[^\n]*\n/g, '\n') // remove // comentário
      .replace(/\/\*[\s\S]*?\*\//g, ''); // remove /* comentário */
    const obj = JSON.parse(limpo);
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

/**
 * Combina dados de clientes/<slug>/design.json, molde de nicho e briefing
 * em um objeto spec e o normaliza com normalizeSpec.
 *
 * @param {{ slug: string }} params
 * @returns {object} spec normalizado (lança se normalizeSpec retornar erros)
 */
async function montarSpec({ slug } = {}) {
  if (!slug || typeof slug !== 'string') {
    throw new Error('slug é obrigatório');
  }

  const base = path.resolve(__dirname, '..', '..');
  const designPath = path.join(base, 'clientes', String(slug), 'design.json');
  const moldePath = path.join(__dirname, 'nicheTemplate.json');
  const briefingPath = path.join(__dirname, 'briefing.json');

  const design = _lerJson(designPath);
  const molde = _lerJson(moldePath);
  const briefing = _lerJson(briefingPath);

  // Combina: briefing > design > molde (campos do briefing prevalecem)
  const raw = {
    ...molde,
    ...design,
    ...briefing,
    name: briefing.name || design.name || molde.name || String(slug),
    slug,
    folder: briefing.folder || design.folder || molde.folder || `clientes/${slug}`,
    leads_origem: briefing.leads_origem || design.leads_origem || molde.leads_origem || slug,
  };

  const resultado = normalizeSpec(raw, { kind: raw.kind || 'site', request: '' });

  if (resultado.errors && resultado.errors.length > 0) {
    throw new Error(`spec inválido: ${resultado.errors.join('; ')}`);
  }

  return resultado.spec;
}

module.exports = { montarSpec };
