export const terminalLines = [
  { type: "info" as const, text: "cortex → analisando intent..." },
  { type: "user" as const, text: '[CORTEX] msg: "Crie uma API REST em Node.js..."' },
  { type: "system" as const, text: "[ROUTER] intent → code/dev detectado" },
  { type: "system" as const, text: "[MODEL] selecionado → DeepSeek Coder" },
  { type: "stream" as const, text: "[STREAM] iniciando SSE → tokens em 14ms" },
];

export const assistantReplies: Record<string, string> = {
  default: "Entendi! Vou conectar você com nosso time de especialistas. Que tal agendar uma demo personalizada do CORTEX? 🚀",
  "ver demos": "Temos demos ao vivo toda terça e quinta às 15h. Posso te enviar o link de acesso!",
  "falar com vendas": "Perfeito! Nosso time comercial responde em até 15 min no WhatsApp.",
  "integração api": "A API do CORTEX é REST + SSE com autenticação JWT. Posso te enviar a chave de sandbox?",
  parceria: "Adoramos parcerias! Trabalhamos com revenda white-label e co-desenvolvimento.",
};
