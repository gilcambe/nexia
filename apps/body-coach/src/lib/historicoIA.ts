export interface Mensagem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  local?: boolean;
}

export function historicoParaIA(mensagens: Mensagem[]) {
  return mensagens
    .filter(m => m.id !== 'c-greet' && m.content.trim() !== '' && !m.local)
    .slice(-10)
    .map(({ role, content }) => ({ role, content }));
}
