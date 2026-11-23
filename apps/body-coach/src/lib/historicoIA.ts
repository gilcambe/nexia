export interface MensagemChat { id: string; speaker: 'user' | 'coach'; text: string; local?: boolean }
export function historicoParaIA(mensagens: MensagemChat[]): { role: 'user' | 'assistant'; content: string }[] {
  return (Array.isArray(mensagens) ? mensagens : [])
    .filter((m) => m && m.id !== 'c-greet' && m.local !== true && String(m.text || '').trim())
    .slice(-10)
    .map((m) => ({ role: m.speaker === 'user' ? 'user' as const : 'assistant' as const, content: m.text }));
}
