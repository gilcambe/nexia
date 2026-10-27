import { buildSystemPrompt } from '../nexia-ai/context-engine/buildSystemPrompt.js';

const prompt = buildSystemPrompt({
  usuario: 'dono',
  projeto: 'Cortex-p1',
  idioma: 'pt-BR',
});

const fraseEsperada =
  'Se não tiver certeza de que um livro, pessoa, lei ou fato existe, diga que não conhece. Nunca invente obras, citações ou dados.';

if (!prompt.includes(fraseEsperada)) {
  throw new Error(`buildSystemPrompt não contém a frase obrigatória: ${fraseEsperada}`);
}

console.log('OK: buildSystemPrompt contém a frase obrigatória.');
