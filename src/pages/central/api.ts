import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiPath } from "@/config/env";

// Central NEXIA: conversa com /api/central (só o administrador). Cada parte vem num pedido separado.

export interface Produto { id: string; nome: string; icone: string; frase: string; logo?: string; segmento?: string; site?: string; painel?: string; suporte?: string; pendente?: boolean; tipo?: "produto" | "cliente" | "tenant" | string }
export interface Medida { id: string; ok: boolean; codigo: number; tempo: number; lento: boolean; quando?: string | null }
export interface Maquina { nome: string; cpu?: string; ramTotal?: number | null; ramLivre?: number | null; modelos?: string[]; ollamaOk?: boolean; visto_em?: string; online: boolean }
export interface Tarefa { numero: number; titulo: string; link: string; quando: string; atribuidoA?: string; gratis: boolean } // Adicionado gratis
export interface TarefaGratis { numero: number; titulo: string; link: string; quando: string; gratis: true } // Nova interface para tarefas gratuitas
export interface Robo { arquivo: string; nome: string; podeRodar: boolean; situacao: "ok" | "erro" | "rodando" | "nunca" | "sem-acesso"; quando: string | null; link: string | null }
export interface Dinheiro {
  total: number; pagantes: number; emTeste: number; vencendo7: number; receitaMes: number; avisos7: number;
  porTipo: { coach: number; aluno: number; independente: number };
  receitaPorMes: { mes: string; valor: number }[];
  novosPorDia: { dia: string; n: number }[];
  ativosPorDia: { dia: string; n: number }[];
}
export interface Cortex { 
  naFila: number; 
  fazendo: Tarefa[]; 
  travadas: Tarefa[]; 
  feitas7: number; 
  ultimas: Tarefa[]; 
  proximas: Tarefa[]; 
  gratuitas: TarefaGratis[]; // Adicionado gratuitas
  distribuidas: number; // Novo campo para tarefas distribuídas
}
export interface Divulga {
  naFila: number;
  proximos: { id: string; texto: string }[];
  historico: { quando: string; id: string | null; cliente: string; resultados: { canal: string; ok: boolean; erro?: string }[] }[];
  seguidores30d?: { dia: string; total: number }[];
  melhorHorario?: string;
  melhorTema?: string;
}
export type Situacao = "ok" | "erro" | "desligado";
export interface Fornecedor { id: string; nome: string; grupo: string; paraQue: string; gratis: string; link: string; situacao: Situacao; quando: string | null; chave?: string | null; chaveEstado?: "existe" | "falta" | null }
export interface Personal { email: string; plano: string; faixa: number; situacao: "isento" | "pagando" | "teste" | "vencido"; desde: number; gratisAte?: number; diasRestantes?: number }
export interface PixPendente { id: string; uid: string; email: string; nome?: string; plano: string; valor: number; em: number; dias: number }
export interface UsoIaProvedor { provedor: string; usado: number; limite: number; pct: number }
export interface UsoIaCliente { email: string; requisicoes: number; tokens: number }
export interface UsoIaResumo { porCliente: UsoIaCliente[]; porProvedor: UsoIaProvedor[]; frear80: boolean }
export interface Lead { id: string; nome: string; produto: string; status: string; whatsapp: string; email: string; quando: string; origem: string; indicadoPor?: string }
export interface Leads { total: number; semana: number; novos: number; porStatus: Record<string, number>; porProduto: Record<string, number>; porOrigem: Record<string, number>; ultimos: Lead[] }
export interface TesteIA { provedor: string; modelo: string; situacao: Situacao; tempo?: number; motivo?: string }
export interface RotaSaude {
  id: string; nome: string; url: string; amostras: number; disponibilidade: number | null; quedas: number; horasFora: number;
  erros: number; codigos: Record<string, number>; tempoMedio: number | null; ultimaQueda: string | null; agora: boolean;
}
export interface Cota { id: string; nome: string; limite: number; usado: number | null; pct: number | null }
export interface Cotas { itens: Cota[]; perto: string[]; frear: boolean; limiar: number; firestoreErro?: string; em: string }
export interface ErroRecente { em: number; rid: string; rota: string; metodo: string; codigo: number; msg: string }
export interface Historico { dias: number; amostras: number; desde: string | null; rotas: RotaSaude[]; porDia: { dia: string; disponibilidade: number }[] }
// Conectar IAs (#1958): 3 vagas de chave grátis. A chave nunca vem para a página.
export type VagaSituacao = "ok" | "sem-cota" | "recusada" | "erro";
export interface VagaTeste { situacao: VagaSituacao; tempo: number; motivo?: string; resposta?: string; em: string; onde: "central" | "robo" }
export interface VagaUso { vaga: number; provedor: string; pr: number; link: string; tarefa: number | null; quando: string; entrou: boolean }
export interface Vaga { vaga: number; ligada: boolean; provedor: string | null; salvaEm: string | null; teste: VagaTeste | null; usos: VagaUso[] }
export interface ProvedorVaga { id: string; nome: string; site: string; logo: string | null; passos: string[] }
export interface JulesEstado { ligado: boolean; comEle: number | null; prsHoje: number; ultimoPr: { numero: number; link: string; quando: string } | null }
export interface Vagas { vagas: Vaga[]; provedores: ProvedorVaga[]; podeLerSegados: boolean; jules?: JulesEstado }
export interface Dados {
  lista?: { produtos: Produto[]; links: { nome: string; url: string }[] };
  saude?: { produtos: Medida[]; em: string };
  dinheiro?: Dinheiro;
  cortex?: Cortex;
  robos?: { robos: Robo[] };
  divulga?: Divulga;
  banco?: { ok: boolean; cheio?: boolean; tempo: number };
  cloudflare?: { configurado: boolean; pedidos?: number; limite: number; erro?: string };
  cotas?: Cotas;
  empresa?: { fornecedores: Fornecedor[] };
  clientes?: { empresas: { site: string; nome: string; leilao: boolean }[]; personais: Personal[]; pixAguardando?: PixPendente[]; usoIa?: UsoIaResumo; receitaMes?: number };
  leads?: Leads;
  vagas?: Vagas;
  maquinas?: { ligado: boolean; maquinas: Maquina[] };
  erros?: { erros: ErroRecente[] }; // aba Sistema, só quando abre
  historico?: Historico; // só a aba Sistema pede (lê 30 dias; não entra no "conferir" de 5 em 5 min)
}
export type Parte = keyof Dados;
export const PARTES: Parte[] = ["lista", "saude", "dinheiro", "cortex", "robos", "divulga", "banco", "cloudflare", "cotas", "empresa", "clientes", "leads", "vagas", "maquinas"];

export function useCentral() {
  const { getToken } = useAuth();
  const pedir = useCallback(async <T,>(init: RequestInit & { query?: string } = {}): Promise<T> => {
    const token = await getToken();
    if (!token) throw new Error("Faça login para continuar.");
    // "Failed to fetch" = a conexão caiu antes de haver resposta (servidor ocupado, rede do celular): tenta de novo até 3 vezes.
    let res: Response | undefined;
    for (let tentativa = 0; tentativa < 3 && !res; tentativa++) {
      try {
        res = await fetch(apiPath("/central") + (init.query || ""), { ...init, headers: { "Content-Type": "text/plain;charset=UTF-8", Authorization: `Bearer ${token}` } });
      } catch (e) {
        if (tentativa === 2 || init.method === "POST") throw new Error("Sem conexão com o servidor agora. Toque em Conferir de novo.");
        await new Promise((r) => setTimeout(r, 700 * (tentativa + 1)));
      }
    }
    if (!res) throw new Error("Sem conexão com o servidor agora. Toque em Conferir de novo.");
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Erro ${res.status}`);
    return body as T;
  }, [getToken]);
  const buscar = useCallback(<K extends Parte>(parte: K) => pedir<NonNullable<Dados[K]>>({ query: `?parte=${parte}` }), [pedir]);
  const agir = useCallback(<T = { ok: boolean; mensagem: string; link?: string },>(corpo: Record<string, unknown>) => pedir<T>({ method: "POST", body: JSON.stringify(corpo) }), [pedir]);
  const entrarSuporte = useCallback(async (site: string) => {
    const token = await getToken();
    const res = await fetch(apiPath("/agenda"), { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8", Authorization: `Bearer ${token}` }, body: JSON.stringify({ acao: "suporte", site }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Erro ${res.status}`);
    return `${body.painel}#suporte=${body.token}`;
  }, [getToken]);
  const distribuirTarefas = useCallback(async (tarefas: TarefaGratis[]) => {
    const token = await getToken();
    const res = await fetch(apiPath("/distribuir-tarefas"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tarefas }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Erro ${res.status}`);
    return body as { ok: boolean; mensagem: string };
  }, [getToken]);
  return { buscar, agir, entrarSuporte, distribuirTarefas };
}

export const reais = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function haQuanto(iso: string | null | undefined): string {
  if (!iso) return "nunca";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} ${d === 1 ? "dia" : "dias"}`;
}
