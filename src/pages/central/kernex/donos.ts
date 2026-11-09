// 09/11 (dono): "aparece PRECISA DE VOCÊ mas não diz o que preciso fazer". Regra pura (testada em
// tests/unit/central-kernex-nova.test.js): só entra o que o dono pode fazer, e cada item traz os passos
// em português simples e UM botão. Sem passo claro, não entra.
import type { TelaId } from "./regras";

export interface Acao {
  id: string;
  titulo: string;
  passos: string[];
  botao: { texto: string; href?: string; tela?: TelaId };
}
interface Esperando { tipo: string; numero: number; titulo: string; link: string; passos?: string[] }
interface Maq { nome: string; online?: boolean; visto_em?: string | null }
interface Proj { id: string; nome?: string; proposto?: boolean }

export function montarAcoes({ esperando = [], maquinas = [], projetos = [] }: { esperando?: Esperando[]; maquinas?: Maq[]; projetos?: Proj[] }): Acao[] {
  const out: Acao[] = [];
  for (const e of esperando) {
    if (!e.passos || !e.passos.length || !e.link) continue;
    out.push({ id: e.tipo + e.numero, titulo: (e.tipo === "pr" ? "Aprovar: " : "Responder: ") + e.titulo, passos: e.passos, botao: { texto: e.tipo === "pr" ? "Abrir para aprovar" : "Abrir", href: e.link } });
  }
  for (const m of maquinas) {
    if (m.online || !m.visto_em) continue;
    out.push({ id: "maq-" + m.nome, titulo: m.nome + " não manda sinal", passos: ["Se o " + m.nome + " está ligado, o programa que manda o sinal parou nele.", "Reinicie o " + m.nome + " e espere 2 minutos.", "Se não voltar, toque em \"Ver o passo a passo\"."], botao: { texto: "Ver o passo a passo", tela: "maquinas" } });
  }
  for (const p of projetos) {
    if (!p.proposto) continue;
    out.push({ id: "rot-" + p.id, titulo: "Aprovar o roteiro de " + (p.nome || p.id), passos: ["O Cortex montou a lista do que falta neste projeto.", "Leia a lista e toque em \"Aprovar roteiro\". Se algo estiver errado, peça a mudança em \"Pedir\"."], botao: { texto: "Ver e aprovar", tela: "projetos" } });
  }
  return out;
}
