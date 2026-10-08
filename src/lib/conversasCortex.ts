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