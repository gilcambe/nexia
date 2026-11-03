import type { Tarefa, PacoteIA } from "./api";

const lista = (t?: Tarefa[]) => (t && t.length ? t.map((i) => `- #${i.numero} ${i.titulo} (${i.link})`).join("\n") : "- nenhuma");

// Texto que o dono cola em qualquer IA web grátis para ela continuar o trabalho.
export function montarPacote(p: PacoteIA): string {
  const x = p.cortex;
  return `# CONTINUAR O PROJETO NEXIA / KERNEX
Você vai continuar o trabalho de outra IA (Claude Code) sem perder nada. Pacote gerado em ${new Date(p.em).toLocaleString("pt-BR")}.

## Seu papel
- Responda em português simples, curto, passo a passo. O dono não é programador.
- Você NÃO roda código e NÃO mexe no GitHub. Você escreve TAREFAS para o Cortex (a IA que programa).
- Uma coisa por tarefa, título + texto com menos de 3.500 letras. Se tiver código pronto, escreva "Copie EXATAMENTE".
- O dono cola a tarefa na Central (aba Cortex, quadro "Pedir ao Cortex") ou em https://github.com/gilcambe/nexia/issues/new com o rótulo cortex-fila.
- Tarefa travada: peça ao dono o último comentário dela, explique o erro e reescreva a tarefa menor.
- Nunca peça senha ou chave. Nada pago. Nada irreversível sem o dono dizer "pode".
- Ao terminar de ler, responda só: "Entendi. Sugestão das 3 próximas tarefas:" e liste 3, olhando a fila abaixo.

## Regras e contexto fixo
${p.contexto || "(abra https://github.com/gilcambe/nexia/blob/develop/docs/CONTEXTO-IA.md)"}

## Estado e memória
${p.estado || "(abra https://github.com/gilcambe/nexia/blob/develop/docs/ESTADO-IA.md)"}

## Fila do Cortex agora
Esperando na fila: ${x ? x.naFila : "?"}
Fazendo agora:
${lista(x?.fazendo)}
Travadas (precisam de ajuda):
${lista(x?.travadas)}
Próximas:
${lista(x?.proximas)}
Entregues nos últimos 7 dias:
${lista(x?.ultimas)}
`;
}
