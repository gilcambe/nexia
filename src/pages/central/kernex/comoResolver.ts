// C2-F1 parte 2 (PC 2, 13/11): todo aviso vira "Como resolver": a causa numa frase, o passo a passo e se precisa do dono.
// Regra do PLANO-CENTRAL-2: nada de "19 travadas" sem saída. O que o Cortex resolve sozinho diz isso claramente.

export type Solucao = { tipo: "cota" | "teste" | "conflito" | "decisao" | "sem-criterio" | "outro"; causa: string; passos: string[]; precisaDono: boolean };

const sem = (s?: string) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function comoResolver(motivo?: string | null): Solucao {
  const m = sem(motivo || "");
  if (/429|cota|quota|rate.?limit|limite de uso|sem credito|402|esgot/.test(m)) return {
    tipo: "cota", precisaDono: false, causa: "Acabou a cota grátis de uma IA por hoje.",
    passos: ["Não precisa fazer nada: o Cortex passa a tarefa para outra IA grátis sozinho.", "Se isso aparecer todo dia, veja em Configurações › Avançado › IA & Cortex qual IA está sem cota."],
  };
  if (/conflit|merge conflict/.test(m)) return {
    tipo: "conflito", precisaDono: false, causa: "Outro trabalho mexeu nos mesmos arquivos ao mesmo tempo.",
    passos: ["Toque em \"Tentar de novo\": o Cortex refaz em cima do código mais novo."],
  };
  if (/nao testavel|sem criterio|criterio de aceite|como conferir/.test(m)) return {
    tipo: "sem-criterio", precisaDono: true, causa: "O pedido não diz como conferir se ficou pronto.",
    passos: ["Toque em \"Abrir no GitHub\".", "Escreva em uma frase como você saberia que ficou certo (ex.: \"o botão Agendar abre a agenda no celular\").", "Volte aqui e toque em \"Tentar de novo\"."],
  };
  if (/decis|precisa (de )?voce|aprova|pergunt|aguardando o dono|resposta do dono/.test(m)) return {
    tipo: "decisao", precisaDono: true, causa: "O Cortex precisa de uma resposta sua para continuar.",
    passos: ["Toque em \"Abrir no GitHub\" e leia a última pergunta.", "Responda em uma frase, do seu jeito.", "Volte aqui e toque em \"Tentar de novo\"."],
  };
  if (/teste|test|\bci\b|check|homolog|build|typecheck|portao|gate/.test(m)) return {
    tipo: "teste", precisaDono: false, causa: "O código feito pela IA não passou nos testes automáticos.",
    passos: ["Não precisa fazer nada: o Cortex tenta de novo com outra IA.", "Se quiser apressar, toque em \"Passar para outra IA\".", "Se travar 3 vezes, toque em \"Cancelar\" e peça de novo em Conversar com mais detalhes."],
  };
  return {
    tipo: "outro", precisaDono: false, causa: motivo && motivo.trim() ? `A IA parou: ${motivo.trim().slice(0, 160)}` : "A IA parou sem dizer o motivo.",
    passos: ["Toque em \"Tentar de novo\".", "Se travar de novo, toque em \"Passar para outra IA\"."],
  };
}

/** Frase do topo do Início para tarefas travadas: diz quem resolve, nunca só o número. */
export function fraseTravadas(n: number, doDono = 0): string {
  if (!n) return "";
  if (doDono > 0) return `${n} tarefa(s) parada(s); ${doDono} precisa(m) de uma resposta sua. Toque em "Tarefas travadas" para ver como resolver.`;
  return `${n} tarefa(s) parada(s): o Cortex já está tentando de novo com outras IAs. Se alguma precisar de você, ela aparece em "Precisa de você".`;
}
