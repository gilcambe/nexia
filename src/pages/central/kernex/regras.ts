// Central Kernex nova (#3219): regras puras (testadas em tests/unit/central-kernex.test.js).
export const TELAS = [
  { id: "inicio", nome: "Início", icone: "🏠", serve: "Ver em 5 segundos se está tudo certo e o que precisa de você." },
  { id: "pedir", nome: "Pedir", icone: "✍️", serve: "Escreva o que você quer; acompanhe cada pedido até ficar pronto." },
  { id: "projetos", nome: "Projetos", icone: "📁", serve: "Quanto falta em cada projeto, contado só com prova." },
  { id: "clientes", nome: "Clientes e modelos", icone: "🧩", serve: "Clonar um cliente (tenant) e criar sites e sistemas a partir dos modelos base." },
  { id: "fabrica", nome: "Fábrica", icone: "🏭", serve: "Criar um sistema novo ou clonar um projeto usando o que já temos pronto." },
  { id: "maquinas", nome: "Máquinas", icone: "🖥️", serve: "PC 1 e PC 2: ligados, ocupados e o que estão fazendo." },
  { id: "ia", nome: "IA & Cortex", icone: "🤖", serve: "O que cada IA está fazendo agora e quanto de cota resta." },
  { id: "tarefas", nome: "Tarefas", icone: "✅", serve: "Cada tarefa: quem pegou, onde parou e por quê." },
  { id: "arquivos", nome: "Arquivos", icone: "🗂️", serve: "Achar qualquer arquivo dos seus PCs e abrir com 1 clique." },
  { id: "publicacoes", nome: "Publicações", icone: "🚀", serve: "O que entrou no código e o que já está no ar." },
  { id: "homologacao", nome: "Homologação", icone: "🧪", serve: "Cada produto testado antes de qualquer versão: verde passa, vermelho bloqueia." },
  { id: "cofre", nome: "Cofre", icone: "🔐", serve: "Nomes das chaves e quando foram trocadas. O valor nunca aparece." },
  { id: "relatorios", nome: "Relatórios", icone: "📊", serve: "O que foi feito por dia e por IA." },
  { id: "config", nome: "Configurações", icone: "⚙️", serve: "Avisos, modo ausente e jeito da tela." },
] as const;
export type TelaId = (typeof TELAS)[number]["id"];

export const telaDaUrl = (search: string): TelaId => {
  const t = new URLSearchParams(search).get("tela");
  return (TELAS.find((x) => x.id === t)?.id || "inicio") as TelaId;
};

export type Cor = "verde" | "amarelo" | "vermelho";
export function corSemaforo({ precisa = 0, travadas = 0, servicosFora = 0 }: { precisa?: number; travadas?: number; servicosFora?: number }): { cor: Cor; texto: string } {
  if (precisa > 0 || servicosFora > 0) return { cor: "vermelho", texto: "Precisa de você" };
  if (travadas > 0) return { cor: "amarelo", texto: "Atenção" };
  return { cor: "verde", texto: "Tudo certo" };
}

export const haQuanto = (iso?: string | null, agora = Date.now()) => {
  if (!iso) return "—";
  const m = Math.max(0, Math.round((agora - Date.parse(iso)) / 60000));
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `há ${h} h` : `há ${Math.round(h / 24)} dias`;
};
export const hora = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "");

export const CHIPS = [
  { id: "meus", nome: "Meus pedidos" },
  { id: "andamento", nome: "Em andamento" },
  { id: "travadas", nome: "Travadas" },
  { id: "precisa", nome: "Precisa de você" },
  { id: "concluidas", nome: "Concluídas" },
  { id: "todos", nome: "Todas" },
] as const;

export const COR_ESTADO: Record<string, string> = { cinza: "#64748b", azul: "#3b82f6", roxo: "#8b5cf6", laranja: "#f59e0b", verde: "#22c55e", vermelho: "#ef4444" };

// Cota: nunca "ilimitado"; sem dado do provedor, diz isso.
export const textoCota = (situacao?: string | null) =>
  situacao === "sem-cota" ? "Acabou a cota de hoje; volta amanhã" : situacao === "erro" ? "Chave com erro" : situacao === "ativa" || situacao === "ociosa" ? "Com cota (o provedor não informa quanto)" : "não informado pelo provedor";

export function textoDeploy(d?: { emAndamento?: boolean; falhou?: boolean; mudancas?: number } | null) {
  if (!d) return "sem dados";
  if (d.emAndamento) return "⏳ Publicando agora…";
  if (d.falhou) return "🔴 A última publicação falhou.";
  if (d.mudancas) return `🟡 ${d.mudancas} mudança(s) ainda não estão no ar.`;
  return "🟢 Tudo o que entrou já está no ar.";
}

// Relatório: concluídas nos últimos 7 dias, por dia (Brasília) e por IA.
export function porDiaEIa(itens: { quando: string; ia?: string | null }[], agora = Date.now()) {
  const dia = (ms: number) => new Date(ms - 3 * 36e5).toISOString().slice(0, 10);
  const dias = Array.from({ length: 7 }, (_, i) => ({ dia: dia(agora - i * 864e5), n: 0 }));
  const ias: Record<string, number> = {};
  for (const t of itens) {
    const d = dias.find((x) => x.dia === dia(Date.parse(t.quando)));
    if (!d) continue;
    d.n++;
    const ia = t.ia || "Cortex";
    ias[ia] = (ias[ia] || 0) + 1;
  }
  return { dias, ias: Object.entries(ias).map(([ia, n]) => ({ ia, n })).sort((a, b) => b.n - a.n) };
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const buscarTelas = (q: string) => (q.trim() ? TELAS.filter((t) => semAcento(t.nome).includes(semAcento(q.trim()))) : []);

// O "precisa de você" de verdade é a lista com passo a passo (donos.ts); o número do resumo do servidor sai da frase.
export const semPrecisa = (t: string) => String(t || "").replace(/, \d+ precisa(m)? de você/, "");
