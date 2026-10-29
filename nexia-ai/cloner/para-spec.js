'use strict';
// Modo lote (issue 4/5 de #2133): junta o site do cliente (clientes/<slug>/site.json, já montado pelo briefing + molde do nicho)
// com o design do site de referência (clientes/<slug>/design.json) e devolve um spec válido do Site Kit.
// Do design só entram cores, fontes, estilo e a ORDEM das seções (applyDesignBase). Nenhum texto, imagem ou marca do site
// de referência passa para o spec: o conteúdo continua sendo do cliente.
const fs = require('fs');
const path = require('path');
const { applyDesignBase } = require('./design');
const { normalizeSpec } = require('../site-kit/spec');

const SLUG_VALIDO = /^[a-z0-9-]{3,40}$/;
const RAIZ = path.resolve(__dirname, '..', '..');

function lerJson(arquivo, rotulo) {
  let texto;
  try { texto = fs.readFileSync(arquivo, 'utf8'); } catch { return null; }
  try { return JSON.parse(texto.replace(/^﻿/, '')); }
  catch (e) { throw new Error(`${rotulo} não é um JSON válido (${e.message})`); }
}

/**
 * @param {{ slug: string, raiz?: string }} o  slug do cliente; raiz só para teste
 * @returns {Promise<object>} spec normalizado
 * @throws {Error} slug inválido, falta site.json, design.json corrompido ou spec inválido
 */
async function montarSpec({ slug, raiz = RAIZ } = {}) {
  const s = String(slug || '').trim();
  if (!SLUG_VALIDO.test(s)) throw new Error('slug inválido: use letras minúsculas, números e hífen (3 a 40)');
  const pasta = path.join(raiz, 'clientes', s);
  const site = lerJson(path.join(pasta, 'site.json'), `clientes/${s}/site.json`);
  if (!site || typeof site !== 'object' || Array.isArray(site)) {
    throw new Error(`falta clientes/${s}/site.json (gere antes com: node scripts/briefing-para-spec.js ${s})`);
  }
  const design = lerJson(path.join(pasta, 'design.json'), `clientes/${s}/design.json`);
  const base = design && design.spec_base && typeof design.spec_base === 'object' ? design.spec_base : null;
  const bruto = base ? applyDesignBase(site, base) : site;
  const { spec, errors } = normalizeSpec(bruto, { kind: site.kind === 'system' ? 'system' : 'site' });
  if (errors && errors.length) throw new Error(`spec inválido: ${errors.join('; ')}`);
  return spec;
}

module.exports = { montarSpec, SLUG_VALIDO };
