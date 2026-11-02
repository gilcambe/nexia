// #2895: em que passo da linha do tempo está um pedido do Cortex. Sem imports, para o teste rodar no Node.
export type Passo = "fila" | "fazendo" | "testando" | "pronto" | "noApp" | "travado";
interface PrMin { estado: "aberto" | "rascunho" | "juntado" | "fechado"; ci: string | null }
interface PedidoMin { situacao: string; prs?: PrMin[] }

export const PASSOS: { id: Exclude<Passo, "travado">; nome: string }[] = [
  { id: "fila", nome: "⏳ Na fila" },
  { id: "fazendo", nome: "⚙️ Fazendo" },
  { id: "testando", nome: "🧪 Testando" },
  { id: "pronto", nome: "✅ PR pronto" },
  { id: "noApp", nome: "🎉 Já está no app" },
];

export function obterPasso(p: PedidoMin): Passo {
  const prs = p.prs || [];
  if (prs.some((x) => x.estado === "juntado")) return "noApp";
  const aberto = prs.find((x) => x.estado === "aberto");
  if (aberto && aberto.ci === "verde") return "pronto";
  if (aberto) return "testando";
  if (p.situacao === "travado") return "travado";
  if (p.situacao === "feito") return "noApp";
  if (p.situacao === "fazendo" || p.situacao === "dividido" || prs.some((x) => x.estado === "rascunho")) return "fazendo";
  return "fila";
}
