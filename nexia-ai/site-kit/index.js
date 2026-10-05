'use strict';
// NEXIA Site Kit (ADR-Q-04): a IA descreve o site/sistema em JSON; o kit gera o código com qualidade fixa.
const { normalizeSpec, extractJson, mediaQueries, slugify, SECTION_TYPES, FIELD_TYPES } = require('./spec');
const { renderSite } = require('./site');
const { renderApp } = require('./app');
const { SPEC_SYSTEM, specPrompt } = require('./prompt');

/** Arquivos prontos (caminho completo dentro do repositório → conteúdo). */
function render(spec, media = {}) {
  const files = spec.kind === 'system' ? renderApp(spec) : renderSite(spec, media);
  return Object.fromEntries(Object.entries(files).map(([name, content]) => [`${spec.folder}/${name}`, content]));
}

module.exports = { SPEC_SYSTEM, specPrompt, render, renderSite, renderApp, normalizeSpec, extractJson, mediaQueries, slugify, SECTION_TYPES, FIELD_TYPES };
