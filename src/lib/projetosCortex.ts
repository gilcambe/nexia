// Projetos do Cortex (como os "Projetos" do Claude): um nome e instruções fixas que valem para
// todas as conversas do projeto. Guardado só no navegador (localStorage), sem gastar cota do Firestore.
export interface ProjetoCortex {
  id: string;
  nome: string;
  instrucoes: string;
  criadoEm: number;
}

const CHAVE = "nexia_cortex_projetos_v1";
const MAX_PROJETOS = 30;

function ler(): ProjetoCortex[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CHAVE);
    const lista = raw ? (JSON.parse(raw) as ProjetoCortex[]) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function gravar(lista: ProjetoCortex[]): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista.slice(0, MAX_PROJETOS)));
  } catch {
    // sem espaço ou bloqueado: segue sem salvar
  }
}

export function listarProjetos(): ProjetoCortex[] {
  return ler().sort((a, b) => b.criadoEm - a.criadoEm);
}

export function obterProjeto(id: string): ProjetoCortex | null {
  return ler().find((p) => p.id === id) || null;
}

export function salvarProjeto(p: { id?: string; nome: string; instrucoes: string }): ProjetoCortex {
  const lista = ler();
  const nome = p.nome.trim().slice(0, 60) || "Projeto sem nome";
  const instrucoes = p.instrucoes.trim().slice(0, 4000);
  const existente = p.id ? lista.find((x) => x.id === p.id) : undefined;
  if (existente) {
    existente.nome = nome;
    existente.instrucoes = instrucoes;
    gravar(lista);
    return existente;
  }
  const novo: ProjetoCortex = {
    id: "proj-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    nome,
    instrucoes,
    criadoEm: Date.now(),
  };
  lista.unshift(novo);
  gravar(lista);
  return novo;
}

export function apagarProjeto(id: string): void {
  gravar(ler().filter((p) => p.id !== id));
}

// Monta a mensagem que vai ao Cortex: instruções do projeto + conversa até agora + pergunta nova.
// O servidor recebe só texto, então o "histórico" viaja dentro dele (limitado para não estourar o modelo).
export function montarPrompt(opts: {
  pergunta: string;
  instrucoes?: string;
  anteriores: { role: "user" | "assistant"; text: string }[];
  maxCaracteres?: number;
}): string {
  const max = opts.maxCaracteres ?? 6000;
  const partes: string[] = [];
  if (opts.instrucoes && opts.instrucoes.trim()) {
    partes.push(`[Instruções do projeto]\n${opts.instrucoes.trim()}`);
  }
  // Pega as mensagens mais recentes que cabem no limite.
  const blocos: string[] = [];
  let usado = 0;
  for (let i = opts.anteriores.length - 1; i >= 0; i--) {
    const m = opts.anteriores[i];
    if (!m.text.trim()) continue;
    const bloco = `${m.role === "user" ? "Usuário" : "Cortex"}: ${m.text.trim().slice(0, 1500)}`;
    if (usado + bloco.length > max) break;
    blocos.unshift(bloco);
    usado += bloco.length;
  }
  if (blocos.length) partes.push(`[Conversa até agora]\n${blocos.join("\n")}`);
  if (!partes.length) return opts.pergunta;
  partes.push(`[Pergunta atual]\n${opts.pergunta}`);
  return partes.join("\n\n");
}
