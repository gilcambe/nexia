'use strict';

// Gera um spec a partir de um objeto de design e normaliza/valida o resultado.
function normalizeSpec(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new Error('spec deve ser um objeto');
  }
  if (!spec.nome || typeof spec.nome !== 'string') {
    throw new Error('spec.nome é obrigatório');
  }
  if (!Array.isArray(spec.secoes)) {
    throw new Error('spec.secoes deve ser um array');
  }
  return spec;
}

function generateSpec(design) {
  if (!design || typeof design !== 'object' || Array.isArray(design)) {
    throw new Error('design deve ser um objeto');
  }
  const spec = {
    nome: design.nome || 'Projeto',
    nicho: design.nicho || 'geral',
    secoes: design.secoes || [],
    cores: design.cores || { primario: '#2563eb', secundario: '#64748b' },
    fonte: design.fonte || 'Inter',
  };
  return normalizeSpec(spec);
}

module.exports = { generateSpec, normalizeSpec };
