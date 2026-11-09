'use strict';

/**
 * Lê o objeto de registro gravado no bloco HTML `<!-- trabalho:{...} -->`.
 * Devolve null se não encontrar ou se o JSON for inválido.
 */
function lerRegistro(corpo) {
  if (typeof corpo !== 'string') return null;
  const match = corpo.match(/<!--\s*trabalho:(\{[\s\S]*?\})\s*-->/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

/**
 * Atualiza ou insere o bloco `<!-- trabalho:{...} -->` no corpo do texto.
 * Preserva o restante do texto sem alterar nada fora do bloco.
 */
function escreverRegistro(corpo, obj) {
  const jsonStr = JSON.stringify(obj);
  const novoBloco = `<!-- trabalho:${jsonStr} -->`;
  const texto = typeof corpo === 'string' ? corpo : '';
  const regex = /<!--\s*trabalho:\{[\s\S]*?\}\s*-->/;
  if (regex.test(texto)) {
    return texto.replace(regex, novoBloco);
  }
  return texto ? `${texto.trimEnd()}\n\n${novoBloco}` : novoBloco;
}

/**
 * Retorna os itens ainda pendentes (feito === false) acompanhados de seus índices originais.
 */
function itensPendentes(reg) {
  if (!reg || !Array.isArray(reg.itens)) return [];
  const pendentes = [];
  reg.itens.forEach((item, indice) => {
    if (item && item.feito === false) {
      pendentes.push({ ...item, indice });
    }
  });
  return pendentes;
}

module.exports = {
  lerRegistro,
  escreverRegistro,
  itensPendentes,
};
