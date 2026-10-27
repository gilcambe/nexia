/**
 * Calcula o número aproximado de tokens em um texto
 * @param {string} texto - O texto a ser analisado
 * @returns {number} Número aproximado de tokens
 */
function contarTokens(texto) {
  // Retorna 0 para texto vazio ou não-string
  if (!texto || typeof texto !== 'string') {
    return 0;
  }

  // Detecta se o texto é código
  const codePattern = /[{}[\]()=<>;:+-*/%!&|@#$^?]/;
  const hasCodeSymbols = codePattern.test(texto);
  
  // Palavras-chave típicas de código
  const codeKeywords = ['function', 'const', 'let', 'var', 'import', 'export', 'return', 'class', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue'];
  const hasCodeKeywords = codeKeywords.some(keyword => texto.toLowerCase().includes(keyword));
  
  const isCode = hasCodeSymbols || hasCodeKeywords;
  
  // Calcula o número de tokens
  const caracteres = texto.length;
  const divisor = isCode ? 3 : 3.6;
  return Math.floor(caracteres / divisor);
}

// Exporta a função
module.exports = {
  contarTokens
};