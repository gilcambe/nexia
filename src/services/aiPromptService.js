import { hasContentViolation } from '../utils/contentFilter.js';

/**
 * Serviço responsável por processar prompts para a IA.
 */
export async function aiPromptService(prompt, options = {}) {
  // Verifica se o prompt contém conteúdo proibido
  if (hasContentViolation(prompt)) {
    return "Desculpe, não posso ajudar com isso.";
  }

  // Caso não haja violação, prossegue com a chamada normal (simulada ou integrada)
  // ... lógica existente do serviço ...
  const rawResponse = `Resposta gerada para: ${prompt}`;
  
  // Analisa a saída da IA e aplica o filtro de conteúdo (reutilizando contentFilter)
  if (hasContentViolation(rawResponse)) {
    return "Desculpe, não posso ajudar com isso.";
  }

  return rawResponse;
}

export default aiPromptService;
