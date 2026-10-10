import { useCallback, useEffect, useState } from 'react';
import { localDateKey } from '@/lib/localDemo';

// Troca escolhida para um item do cardápio ou do plano. Vale só hoje (guardada no aparelho).
export interface Troca { nome: string; porcao: string; kcal?: number; p?: number; c?: number; g?: number }

export function useTrocasDoDia(uid: string | undefined, escopo: 'cardapio' | 'plano') {
  const chave = uid ? `bc_trocas_${uid}_${escopo}_${localDateKey()}` : null;
  const [trocas, setTrocas] = useState<Record<string, Troca>>({});
  useEffect(() => {
    if (!chave) return;
    try { setTrocas(JSON.parse(localStorage.getItem(chave) || '{}')); } catch { setTrocas({}); }
  }, [chave]);
  const definir = useCallback((item: string, t: Troca | null) => {
    setTrocas((atual) => {
      const novo = { ...atual };
      if (t) novo[item] = t; else delete novo[item];
      try { if (chave) localStorage.setItem(chave, JSON.stringify(novo)); } catch { /* sem armazenamento */ }
      return novo;
    });
  }, [chave]);
  return { trocas, definir };
}
