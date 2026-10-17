import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiPath } from "@/config/env";

// Cortex no celular: conversa com /api/pedidos (só o dono). Os pedidos são as issues da fila do Cortex.

export type Situacao = "fila" | "fazendo" | "travado" | "dividido" | "feito" | "fechado";
export interface Resumo { numero: number; titulo: string; situacao: Situacao; criado: string; quando: string; comentarios: number; tentativas: number; link: string }
export interface Lista { total: number; pagina: number; temMais: boolean; itens: Resumo[] }
export interface Fala { quem: string; quando: string; texto: string }
export interface PR { numero: number; titulo: string; link: string; ramo: string; estado: "aberto" | "rascunho" | "juntado" | "fechado"; ci: string | null; automerge: boolean; quando: string }
export interface Detalhe extends Resumo { rotulos: string[]; conversa: Fala[]; prs: PR[] }
export interface Deploy { mudancas: number; titulos: string[]; ultimoDeploy: { quando: string; link: string } | null; emAndamento: boolean; falhou: boolean }
export type Filtro = "todos" | "abertos" | "travados" | "feitos";

export const NOME_SITUACAO: Record<Situacao, string> = {
  fila: "⏳ Na fila", fazendo: "⚙️ Fazendo", travado: "🛑 Travado", dividido: "🧩 Em partes", feito: "✅ Feito", fechado: "✖️ Cancelado",
};
export const NOME_PR: Record<PR["estado"], string> = { aberto: "Aberto", rascunho: "Rascunho", juntado: "✅ Já está no app", fechado: "Fechado sem entrar" };

export function usePedidos() {
  const { getToken } = useAuth();
  const chamar = useCallback(async <T,>(query: string, corpo?: Record<string, unknown>): Promise<T> => {
    const token = await getToken();
    if (!token) throw new Error("Faça login para continuar.");
    const res = await fetch(apiPath("/pedidos") + query, {
      method: corpo ? "POST" : "GET",
      headers: { "Content-Type": "text/plain;charset=UTF-8", Authorization: `Bearer ${token}` },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Erro ${res.status}`);
    return body as T;
  }, [getToken]);
  const listar = useCallback((q: string, estado: Filtro, pagina: number) =>
    chamar<Lista>(`?estado=${estado}&pagina=${pagina}&q=${encodeURIComponent(q)}`), [chamar]);
  const abrir = useCallback((n: number) => chamar<Detalhe>(`?n=${n}`), [chamar]);
  const deploy = useCallback(() => chamar<Deploy>("?deploy=1"), [chamar]);
  const agir = useCallback((corpo: Record<string, unknown>) => chamar<{ ok: boolean; mensagem: string; numero?: number }>("", corpo), [chamar]);
  return { listar, abrir, agir, deploy };
}
