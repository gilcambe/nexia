/**
 * lib/cortex-tokens.js
 *
 * Define os limites de orçamento de contexto do Cortex e auxiliares
 * para cortar mensagens antigas preservando as 4 últimas inteiras.
 */

/** Orçamento de tokens para contexto simples. */
const CORTEX_CTX_SIMPLES = 800;

/** Orçamento de tokens para contexto normal. */
const CORTEX_CTX_NORMAL = 2000;

/** Orçamento de tokens para contexto difícil. */
const CORTEX_CTX_DIFICIL = 6000;

/**
 * Remove espaços repetidos (incluindo quebras de linha múltiplas),
 * colapsando para um único espaço, mas preservando quebras de linha
 * simples entre blocos.
 *
 * @param {string} texto
 * @returns {string}
 */
function cortarEspacosRepetidos(texto) {
  if (typeof texto !== 'string') return texto;
  return texto
    .replace(/[ \t]+/g, ' ')      // espaços e tabs -> um espaco
    .replace(/[ \t]*\n[ \t]*/g, '\n') // quebras com espaco ao redor -> quebra simples
    .replace(/\n{3,}/g, '\n\n');   // 3 ou mais quebras -> no maximo 2
}

/**
 * Compacta um bloco de codigo ou anexo antigo ja respondido.
 * Mantem a primeira e a ultima linha e insere '[trecho removido]' entre elas.
 * Se o bloco tiver 2 ou menos linhas, retorna inalterado.
 *
 * @param {string} texto
 * @returns {string}
 */
function compactarBlocoAntigo(texto) {
  if (typeof texto !== 'string') return texto;
  const linhas = texto.split('\n');
  if (linhas.length <= 2) return texto;
  const primeira = linhas[0];
  const ultima = linhas[linhas.length - 1];
  return [primeira, '[trecho removido]', ultima].join('\n');
}

/**
 * Extrai o texto de uma mensagem (aceita string ou objeto {role, content}).
 *
 * @param {any} mensagem
 * @returns {string}
 */
function _textoDaMensagem(mensagem) {
  if (typeof mensagem === 'string') return mensagem;
  if (mensagem && typeof mensagem === 'object' && mensagem.content !== undefined) {
    return String(mensagem.content);
  }
  return String(mensagem);
}

/**
 * Reconstroi uma mensagem a partir do texto novo (preserva a forma original).
 *
 * @param {any} mensagemOriginal
 * @param {string} novoTexto
 * @returns {any}
 */
function _reconstruirMensagem(mensagemOriginal, novoTexto) {
  if (typeof mensagemOriginal === 'string') return novoTexto;
  if (mensagemOriginal && typeof mensagemOriginal === 'object') {
    return { ...mensagemOriginal, content: novoTexto };
  }
  return novoTexto;
}

/**
 * Corta o contexto de mensagens respeitando o orçamento de tokens.
 *
 * Regras:
 * - As 4 ultimas mensagens sao preservadas integralmente (nunca tocadas).
 * - Mensagens anteriores tem espacos repetidos cortados.
 * - Blocos de codigo/anexos longos nas mensagens antigas sao compactados,
 *   mantendo primeira e ultima linha + '[trecho removido]'.
 *
 * @param {Array} mensagens - array de mensagens (strings ou {role, content})
 * @param {number} orcamento - limite de tokens (ex: CORTEX_CTX_SIMPLES)
 * @returns {Array} mensagens cortadas
 */
function cortarContexto(mensagens, orcamento = CORTEX_CTX_NORMAL) {
  if (!Array.isArray(mensagens)) return mensagens;

  const total = mensagens.length;
  if (total <= 4) return [...mensagens];

  const resultado = [...mensagens];

  const limiteUltimoQuatro = total - 4;

  for (let i = 0; i < limiteUltimoQuatro; i++) {
    let texto = _textoDaMensagem(resultado[i]);
    texto = cortarEspacosRepetidos(texto);
    texto = compactarBlocoAntigo(texto);
    resultado[i] = _reconstruirMensagem(mensagens[i], texto);
  }

  return resultado;
}

module.exports = {
  CORTEX_CTX_SIMPLES,
  CORTEX_CTX_NORMAL,
  CORTEX_CTX_DIFICIL,
  cortarEspacosRepetidos,
  compactarBlocoAntigo,
  cortarContexto,
};
