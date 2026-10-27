// Classificação de intenções de esquecimento e gerenciamento de memória no chat Cortex.
// Trata expressões em português como "esqueça isso", "não guarde", "apagar tudo", etc.

const sem = (t: string) => (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Expressões que indicam limpeza TOTAL da memória. */
const EXPRESSOES_LIMPEZA_TOTAL = /\b(apagar tudo|apague tudo|limpar tudo|limpar memoria|apagar memoria|esquecer tudo|deletar tudo|remover tudo|zerar memoria)\b/;

/** Expressões que indicam remoção de fato específico ou pedido de esquecimento. */
const EXPRESSOES_ESQUECER = /\b(esque[cç]a|esquece|nao guarde|n[ãa]o guarde|nao salve|n[ãa]o salve|apagar|apague|deletar|remov[ae]|limpar|zerar)\b/;

export type ForgetIntentType = 'none' | 'specific' | 'total';

export interface ForgetIntentResult {
  isForget: boolean;
  type: ForgetIntentType;
  query?: string;
}

/**
 * Detecta se o texto enviado pelo usuário é uma intenção de esquecimento.
 */
export function ehEsquecer(texto: string): boolean {
  const t = sem(texto);
  if (!t) return false;
  return EXPRESSOES_LIMPEZA_TOTAL.test(t) || (EXPRESSOES_ESQUECER.test(t) && (t.includes("isso") || t.includes("fato") || t.includes("memoria") || t.includes("tudo") || t.includes("info")));
}

/**
 * Analisa em detalhes a intenção de esquecimento.
 */
export function detectForgetIntent(texto: string): ForgetIntentResult {
  const t = sem(texto);
  if (!t) return { isForget: false, type: 'none' };

  if (EXPRESSOES_LIMPEZA_TOTAL.test(t)) {
    return { isForget: true, type: 'total' };
  }

  if (ehEsquecer(texto)) {
    return { isForget: true, type: 'specific', query: texto };
  }

  return { isForget: false, type: 'none' };
}
