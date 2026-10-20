import type { Dados } from "./api";
import type { Cor } from "./ui";

// O que precisa do dono agora, em frases simples. A aba diz onde resolver.
export interface Aviso { cor: Cor; texto: string; aba: Aba }
export type Aba = "inicio" | "clientes" | "dinheiro" | "divulgar" | "cortex" | "prs" | "sistema";

export function calcularAvisos(d: Dados): Aviso[] {
  const a: Aviso[] = [];
  const nome = (id: string) => d.lista?.produtos.find((p) => p.id === id)?.nome || id;
  for (const m of d.saude?.produtos || []) {
    if (!m.ok) a.push({ cor: "vermelho", texto: `${nome(m.id)} está fora do ar`, aba: "clientes" });
    else if (m.lento) a.push({ cor: "amarelo", texto: `${nome(m.id)} está lento para abrir`, aba: "clientes" });
  }
  if (d.banco && !d.banco.ok) a.push({ cor: "vermelho", texto: d.banco.cheio ? "O banco de dados chegou no limite grátis de hoje" : "O banco de dados não respondeu", aba: "sistema" });
  for (const r of d.robos?.robos || []) if (r.situacao === "erro") a.push({ cor: "amarelo", texto: `O robô "${r.nome}" deu erro na última vez`, aba: "sistema" });
  const travadas = d.cortex?.travadas.length || 0;
  if (travadas) a.push({ cor: "amarelo", texto: `${travadas} tarefa${travadas > 1 ? "s" : ""} do Cortex travada${travadas > 1 ? "s" : ""}`, aba: "cortex" });
  if (d.dinheiro?.avisos7) a.push({ cor: "amarelo", texto: `${d.dinheiro.avisos7} aviso${d.dinheiro.avisos7 > 1 ? "s" : ""} de pagamento Pix nos últimos 7 dias (confira e libere)`, aba: "dinheiro" });
  if (d.dinheiro?.vencendo7) a.push({ cor: "amarelo", texto: `${d.dinheiro.vencendo7} assinatura${d.dinheiro.vencendo7 > 1 ? "s vencem" : " vence"} em até 7 dias`, aba: "dinheiro" });
  for (const f of d.empresa?.fornecedores || []) if (f.situacao === "erro") a.push({ cor: "amarelo", texto: `${f.nome} deu erro na última vez`, aba: "sistema" });
  if (d.leads?.novos) a.push({ cor: "amarelo", texto: `${d.leads.novos} contato${d.leads.novos > 1 ? "s" : ""} interessado${d.leads.novos > 1 ? "s" : ""} esperando resposta`, aba: "clientes" });
  const ultimo = d.divulga?.historico[0];
  if (ultimo && ultimo.resultados.length && ultimo.resultados.every((r) => !r.ok)) a.push({ cor: "amarelo", texto: "O último post não saiu em nenhuma rede", aba: "divulgar" });
  return a.sort((x, y) => (x.cor === "vermelho" ? -1 : 0) - (y.cor === "vermelho" ? -1 : 0));
}
