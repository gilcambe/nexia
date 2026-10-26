/**
 * Módulo de Gestão de Fontes e Citações do Cortex AI
 * Fornece funções para numeração de fontes, marcação de fatos, validação de links e cálculo de grau de certeza.
 */

/**
 * (1) numerarFontes(resultados)
 * Recebe array de resultados de busca/ferramentas e devolve lista numerada.
 * Cada item da lista numerada contém a fonte com seu índice (1-based).
 */
function numerarFontes(resultados) {
  if (!Array.isArray(resultados)) {
    return [];
  }
  return resultados.map((item, index) => {
    const id = index + 1;
    return {
      ...item,
      id,
      numero: id,
      referenciaFormatada: `[${id}] ${item.title || item.titulo || item.url || 'Fonte sem título'}`
    };
  });
}

/**
 * (2) marcarFatosComFonte(texto, fontes)
 * Insere [n] ao final de frases que contêm fato, número, data, lei ou notícia.
 * Se nenhuma fonte, adiciona "não verifiquei".
 */
function marcarFatosComFonte(texto, fontes) {
  if (!texto || typeof texto !== 'string') {
    return texto || '';
  }

  const listaFontes = Array.isArray(fontes) ? fontes : [];

  if (listaFontes.length === 0) {
    // Se nenhuma fonte, adiciona menção de não verificado ao final do texto ou das frases principais
    const trimmed = texto.trim();
    if (trimmed && !trimmed.endsWith('não verifiquei')) {
      return `${trimmed} (não verifiquei)`;
    }
    return trimmed;
  }

  // Divide o texto em frases (considerando ponto, interrogação, exclamação seguidos de espaço ou fim de string)
  // Mantemos o delimitador ou tratamos a divisão
  const partes = texto.split(/([.!?]+(?:\s+|$))/);
  let resultado = '';

  // Regex para detectar se uma frase contém fato, número, data, lei ou notícia
  // - Números / dígitos: \d+
  // - Datas / Anos: \b(?:19|20)\d{2}\b ou \d{1,2}/\d{1,2}
  // - Lei / Artigo / Decreto / Notícia / Segundo / Conforme / Dados / Pesquisa
  const regexFato = /(\d+|\b(?:19|20)\d{2}\b|\b(?:lei|artigo|decreto|portaria|notícia|dados|pesquisa|estudo|segundo|conforme|informou|revelou|registrou)\b)/i;

  for (let i = 0; i < partes.length; i += 2) {
    const frase = partes[i];
    const pontuacao = partes[i + 1] || '';

    if (!frase || frase.trim() === '') {
      resultado += frase + pontuacao;
      continue;
    }

    let fraseProcessada = frase;
    const contemFato = regexFato.test(frase);

    if (contemFato) {
      // Atribui uma fonte de forma determinística ou circular com base no comprimento/índice
      const indiceFonte = (i % listaFontes.length) + 1;
      fraseProcessada = `${frase} [${indiceFonte}]`;
    }

    resultado += fraseProcessada + pontuacao;
  }

  return resultado.trim();
}

/**
 * (3) validarLinks(texto, fontes)
 * Remove links não presentes na lista de fontes e os substitui por "(fonte não confirmada)".
 */
function validarLinks(texto, fontes) {
  if (!texto || typeof texto !== 'string') {
    return texto || '';
  }

  const listaFontes = Array.isArray(fontes) ? fontes : [];
  const urlsValidas = new Set(
    listaFontes.map(f => (typeof f === 'string' ? f : f.url || f.link)).filter(Boolean)
  );

  // Regex simples para detectar URLs markdown [texto](url) ou URLs puras http://... ou https://...
  // Substitui URLs que não estão em urlsValidas por "(fonte não confirmada)"
  
  // Substituição de links Markdown: [texto](url)
  let textoValidado = texto.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, anchor, url) => {
    if (urlsValidas.has(url)) {
      return match;
    }
    return `(fonte não confirmada)`;
  });

  // Substituição de URLs soltas
  textoValidado = textoValidado.replace(/\bhttps?:\/\/[^\s<>)]+/g, (url) => {
    if (urlsValidas.has(url)) {
      return url;
    }
    return '(fonte não confirmada)';
  });

  return textoValidado;
}

/**
 * (4) calcularCerteza(fontes, tipoResposta)
 * Devolve "alta", "média" ou "baixa" segundo regras descritas:
 * - alta: fontes oficiais / múltiplas fontes / tipo de resposta factual/técnica com fontes suficientes
 * - média: fontes parciais ou tipo moderado
 * - baixa: sem fontes ou fontes insuficientes
 */
function calcularCerteza(fontes, tipoResposta) {
  const listaFontes = Array.isArray(fontes) ? fontes : [];
  const tipo = (tipoResposta || '').toLowerCase();

  if (listaFontes.length === 0) {
    return 'baixa';
  }

  // Critérios baseados na quantidade e tipo de fontes e tipo de resposta
  if (listaFontes.length >= 3) {
    return 'alta';
  }

  if (listaFontes.length === 2) {
    return tipo.includes('criativ') || tipo.includes('opiniao') ? 'média' : 'alta';
  }

  // 1 fonte
  if (tipo.includes('factual') || tipo.includes('tecnic') || tipo.includes('codigo')) {
    return 'média';
  }

  if (tipo.includes('criativ') || tipo.includes('geral')) {
    return 'média';
  }

  return 'baixa';
}

module.exports = {
  numerarFontes,
  marcarFatosComFonte,
  validarLinks,
  calcularCerteza
};
