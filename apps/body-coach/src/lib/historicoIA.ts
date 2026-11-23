export interface MensagemHistorico {
  id?: string;
  role: 'user' | 'assistant' | 'model';
  content?: string;
  texto?: string;
  local?: boolean;
}

export function historicoParaIA(mensagens: MensagemHistorico[]): { role: string; content: string }[] {
  if (!Array.isArray(mensagens)) return [];
  
  const filtradas = mensagens.filter((m) => {
    if (m.id === 'c-greet') return false;
    if (m.local === true) return false;
    const texto = m.content || m.texto || '';
    if (!texto.trim()) return false;
    return true;
  });

  const ultimas = filtradas.slice(-10);

  return ultimas.map((m) => ({
    role: m.role === 'assistant' ? 'model' : m.role,
    content: m.content || m.texto || '',
  }));
}
