import { hasContentViolation, filterAIResponse } from '../utils/contentFilter.js';
import { promptInjectionGuard } from '../utils/promptInjectionGuard.js';

/**
 * Serviço responsável por processar prompts para a IA.
 */
export async function aiPromptService(prompt, options = {}) {
  // Verifica se o prompt contém conteúdo proibido
  if (hasContentViolation(prompt)) {
    return "Desculpe, não posso ajudar com isso.";
  }

  // Aplica o guard contra injeção de prompt antes do processamento
  const guardedPrompt = promptInjectionGuard(prompt);
  if (guardedPrompt !== prompt) {
    // Se o guard modificou o prompt, retorna a resposta genérica
    return guardedPrompt;
  }

  // Caso não haja violação, prossegue com a chamada normal (simulada ou integrada)
  // ... lógica existente do serviço ...
  const rawResponse = `Resposta gerada para: ${prompt}`;
  
  // Analisa a saída da IA e aplica o filtro de conteúdo (reutilizando filterAIResponse)
  return filterAIResponse(rawResponse);
}

export default aiPromptService;
