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

function lerTodas(): Conversa[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CHAVE);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function escreverTodas(conversas: Conversa[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHAVE, JSON.stringify(conversas));
}

export function listarConversas(): Conversa[] {
  return lerTodas().sort((a, b) => b.atualizadaEm - a.atualizadaEm);
}

export function obterConversa(id: string): Conversa | null {
  const todas = lerTodas();
  return todas.find((c) => c.id === id) ?? null;
}

export function novaConversaId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function salvarConversa(conversa: Conversa) {
  const todas = lerTodas();
  const idx = todas.findIndex((c) => c.id === conversa.id);
  if (idx >= 0) {
    todas[idx] = conversa;
  } else {
    todas.unshift(conversa);
  }
  if (todas.length > MAX_CONVERSAS) todas.length = MAX_CONVERSAS;
  escreverTodas(todas);
}

export function apagarConversa(id: string) {
  const todas = lerTodas().filter((c) => c.id !== id);
  escreverTodas(todas);
}
