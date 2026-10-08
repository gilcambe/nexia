export interface MensagemSalva {
  id: string;
  role: "user" | "assistant";
  text: string;
  model?: string;
}

export interface Conversa {
  id: string;
  titulo: string;
  atualizadaEm: number;
  mensagens: MensagemSalva[];
}

const CHAVE = "nexia_cortex_conversas_v1";
const MAX_CONVERSAS = 50;

export function listarConversas(): Conversa[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CHAVE);
    if (!raw) return [];
    const conversas = JSON.parse(raw) as Conversa[];
    return conversas.sort((a, b) => b.atualizadaEm - a.atualizadaEm);
  } catch {
    return [];
  }
}

export function obterConversa(id: string): Conversa | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CHAVE);
    if (!raw) return null;
    const conversas = JSON.parse(raw) as Conversa[];
    return conversas.find((c) => c.id === id) || null;
  } catch {
    return null;
  }
}

export function novaConversaId(): string {
  return "conv-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
}

export function salvarConversa(conversa: Conversa): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(CHAVE);
    const conversas: Conversa[] = raw ? JSON.parse(raw) : [];
    const idx = conversas.findIndex((c) => c.id === conversa.id);
    if (idx >= 0) {
      conversas[idx] = conversa;
    } else {
      conversas.unshift(conversa);
    }
    if (conversas.length > MAX_CONVERSAS) {
      conversas.length = MAX_CONVERSAS;
    }
    localStorage.setItem(CHAVE, JSON.stringify(conversas));
  } catch {
    // Silently fail
  }
}

export function apagarConversa(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(CHAVE);
    if (!raw) return;
    const conversas = JSON.parse(raw) as Conversa[];
    const filtered = conversas.filter((c) => c.id !== id);
    localStorage.setItem(CHAVE, JSON.stringify(filtered));
  } catch {
    // Silently fail
  }
}
