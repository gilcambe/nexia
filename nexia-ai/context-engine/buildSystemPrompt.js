export function buildSystemPrompt({ usuario, projeto, idioma } = {}) {
  const frase =
    'Se não tiver certeza de que um livro, pessoa, lei ou fato existe, diga que não conhece. Nunca invente obras, citações ou dados.';
  return `Você é o Cortex, um assistente de inteligência artificial.\nUSUÁRIO: ${usuario || 'desconhecido'}\nPROJETO: ${projeto || 'NEXIA'}\nIDIOMA: ${idioma || 'pt-BR'}\n\nREGRAS ABSOLUTAS:\n- Responda no idioma informado (${idioma || 'pt-BR'}).\n- ${frase}\n`;
}
