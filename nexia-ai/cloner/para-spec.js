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
      .replace(/\/\*[\s\S]*?\*\//g, ''); // remove /* comentário */;
    const obj = JSON.parse(limpo);
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

/**
 * Valida o slug para evitar caminhos maliciosos
 * @param {string} slug 
 * @throws {Error} Se o slug for inválido ou malicioso
 */
function _validarSlug(slug) {
  if (!slug || typeof slug !== 'string') {
    throw new Error('slug é obrigatório e deve ser uma string');
  }
  
  // Expressão regular para validar slug: letras, números, hífens e underscores
  const slugRegex = /^[a-zA-Z0-9_-]+$/;
  if (!slugRegex.test(slug)) {
    throw new Error('slug contém caracteres inválidos. Use apenas letras, números, hífens e underscores');
  }
  
  // Verifica se o slug não contém tentativas de acesso a diretórios
  if (slug.includes('..') || slug.includes('/') || slug.includes('\\')) {
    throw new Error('slug contém tentativas de acesso a diretórios');
  }
}

/**
 * Verifica se o diretório do cliente existe
 * @param {string} slug 
 * @param {string} base 
 * @returns {boolean}
 */
function _verificarDiretorioCliente(slug, base) {
  const clienteDir = path.join(base, 'clientes', String(slug));
  try {
    return fs.existsSync(clienteDir) && fs.statSync(clienteDir).isDirectory();
  } catch (err) {
    console.error(`Erro ao verificar diretório do cliente: ${err.message}`);
    return false;
  }
}

/**
 * Combina dados de clientes/<slug>/design.json, molde de nicho e briefing
 * em um objeto spec e o normaliza com normalizeSpec.
 *
 * @param {{ slug: string }} params - Parâmetro com o slug do cliente
 * @returns {object} spec normalizado (lança se normalizeSpec retornar erros)
 * @throws {Error} Se o slug for inválido, o diretório não existir ou houver erros de leitura
 * 
 * @example
 * // Exemplo de uso:
 * try {
 *   const spec = await montarSpec({ slug: 'meu-cliente' });
 *   console.log('Spec normalizado:', spec);
 * } catch (err) {
 *   console.error('Erro ao montar spec:', err.message);
 * }
 */
async function montarSpec({ slug } = {}) {
  console.log(`[montarSpec] Iniciando processamento para slug: ${slug}`);
  
  try {
    // Valida o slug
    _validarSlug(slug);
    console.log(`[montarSpec] Slug válido: ${slug}`);
    
    const base = path.resolve(__dirname, '..', '..');
    const designPath = path.join(base, 'clientes', String(slug), 'design.json');
    const moldePath = path.join(__dirname, 'nicheTemplate.json');
    const briefingPath = path.join(__dirname, 'briefing.json');
    
    // Verifica se o diretório do cliente existe
    if (!_verificarDiretorioCliente(slug, base)) {
      throw new Error(`Diretório do cliente não encontrado: clientes/${slug}`);
    }
    console.log(`[montarSpec] Diretório do cliente encontrado: clientes/${slug}`);
    
    // Lê os arquivos
    console.log(`[montarSpec] Lendo arquivos: design.json, nicheTemplate.json, briefing.json`);
    const design = _lerJson(designPath);
    const molde = _lerJson(moldePath);
    const briefing = _lerJson(briefingPath);
    
    console.log(`[montarSpec] Arquivos lidos com sucesso`);
    
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
    
    console.log(`[montarSpec] Dados combinados, aplicando normalizeSpec`);
    const resultado = normalizeSpec(raw, { kind: raw.kind || 'site', request: '' });
    
    if (resultado.errors && resultado.errors.length > 0) {
      throw new Error(`spec inválido: ${resultado.errors.join('; ')}`);
    }
    
    console.log(`[montarSpec] Spec normalizado com sucesso`);
    return resultado.spec;
    
  } catch (err) {
    console.error(`[montarSpec] Erro ao processar slug ${slug}: ${err.message}`);
    throw err;
  }
}

module.exports = { montarSpec };
