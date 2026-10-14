import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiPath } from "@/config/env";

// Central NEXIA: conversa com /api/central (só o administrador). Cada parte vem num pedido separado.

export interface Produto { id: string; nome: string; icone: string; frase: string; site: string; painel: string; suporte?: string }
export interface Medida { id: string; ok: boolean; codigo: number; tempo: number; lento: boolean }
export interface Tarefa { numero: number; titulo: string; link: string; quando: string }
export interface Robo { arquivo: string; nome: string; podeRodar: boolean; situacao: "ok" | "erro" | "rodando" | "nunca" | "sem-acesso"; quando: string | null; link: string | null }
export interface Dinheiro {
  total: number; pagantes: number; emTeste: number; vencendo7: number; receitaMes: number; avisos7: number;
  porTipo: { coach: number; aluno: number; independente: number };
  receitaPorMes: { mes: string; valor: number }[];
  novosPorDia: { dia: string; n: number }[];
  ativosPorDia: { dia: string; n: number }[];
}
export interface Cortex { naFila: number; fazendo: Tarefa[]; travadas: Tarefa[]; feitas7: number; ultimas: Tarefa[]; proximas: Tarefa[] }
export interface Divulga {
  naFila: number;
  proximos: { id: string; texto: string }[];
  historico: { quando: string; id: string | null; cliente: string; resultados: { canal: string; ok: boolean; erro?: string }[] }[];
}
export interface Dados {
  lista?: { produtos: Produto[]; links: { nome: string; url: string }[] };
  saude?: { produtos: Medida[]; em: string };
  dinheiro?: Dinheiro;
  cortex?: Cortex;
  robos?: { robos: Robo[] };
  divulga?: Divulga;
  banco?: { ok: boolean; cheio?: boolean; tempo: number };
}
export type Parte = keyof Dados;
export const PARTES: Parte[] = ["lista", "saude", "dinheiro", "cortex", "robos", "divulga", "banco"];

export function useCentral() {
  const { getToken } = useAuth();
  const pedir = useCallback(async <T,>(init: RequestInit & { query?: string } = {}): Promise<T> => {
    const token = await getToken();
    if (!token) throw new Error("Faça login para continuar.");
    const res = await fetch(apiPath("/central") + (init.query || ""), { ...init, headers: { "Content-Type": "text/plain;charset=UTF-8", Authorization: `Bearer ${token}` } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Erro ${res.status}`);
    return body as T;
  }, [getToken]);
  const buscar = useCallback(<K extends Parte>(parte: K) => pedir<NonNullable<Dados[K]>>({ query: `?parte=${parte}` }), [pedir]);
  const agir = useCallback((corpo: Record<string, unknown>) => pedir<{ ok: boolean; mensagem: string; link?: string }>({ method: "POST", body: JSON.stringify(corpo) }), [pedir]);
  const entrarSuporte = useCallback(async (site: string) => {
    const token = await getToken();
    const res = await fetch(apiPath("/agenda"), { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8", Authorization: `Bearer ${token}` }, body: JSON.stringify({ acao: "suporte", site }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Erro ${res.status}`);
    return `${body.painel}#suporte=${body.token}`;
  }, [getToken]);
  return { buscar, agir, entrarSuporte };
}

export const reais = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function haQuanto(iso: string | null | undefined): string {
  if (!iso) return "nunca";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}
