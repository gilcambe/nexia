/**
 * Configuração de Planos de Imagem e Validações Q5
 * NEXIA AI - Grátis e sem cobranças (conforme decisões do dono)
 */

export const MAX_IMAGES_PER_PLAN = {
  free: 50,
  standard: 200,
  unlimited: 1000
};

export const FORMAT_LIMITS = {
  square: { width: 1024, height: 1024, maxDaily: 50 },
  portrait: { width: 768, height: 1024, maxDaily: 50 },
  landscape: { width: 1024, height: 768, maxDaily: 50 }
};

export const PROHIBITED_KEYWORDS = [
  'violence',
  'gore',
  'nsfw',
  'explicit',
  'hate',
  'harassment',
  'weapons',
  'illegal',
  'abuse',
  'suicide',
  'violencia',
  'conteudo adulto',
  'odio',
  'ilegal'
];

/**
 * Valida se o conteúdo do prompt é permitido (não contém palavras-chave proibidas Q5).
 * @param {string} prompt - O texto do prompt enviado pelo usuário.
 * @returns {boolean} - true se permitido, false se contiver termos proibidos.
 */
export function isContentAllowed(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return true;
  }
  const lowerPrompt = prompt.toLowerCase();
  for (const keyword of PROHIBITED_KEYWORDS) {
    if (lowerPrompt.includes(keyword.toLowerCase())) {
      return false;
    }
  }
  return true;
}

/**
 * Valida se a geração é permitida com base no plano e no uso atual.
 * @param {string} [plan='free'] - O plano do usuário.
 * @param {number} [currentCount=0] - A quantidade atual de imagens geradas.
 * @returns {boolean} - true se puder gerar, false caso contrário.
 */
export function canGenerate(plan = 'free', currentCount = 0) {
  const limit = MAX_IMAGES_PER_PLAN[plan] !== undefined ? MAX_IMAGES_PER_PLAN[plan] : MAX_IMAGES_PER_PLAN.free;
  return currentCount < limit;
}
