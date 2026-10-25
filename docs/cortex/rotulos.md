# Rótulos do Cortex

Esta tabela explica o que cada rótulo do Cortex significa nas tarefas e pedidos.

| Rótulo             | Significado                                                                                                 |
| :----------------- | :---------------------------------------------------------------------------------------------------------- |
| `cortex-fila`      | O pedido está na fila, aguardando para ser processado pelo Cortex.                                          |
| `cortex-rodando`   | O Cortex está trabalhando ativamente neste pedido.                                                         |
| `pista-N`          | Indica o número da pista ou thread em que o Cortex está trabalhando (ex: `pista-1`, `pista-2`).            |
| `tentativa-N`      | Número da tentativa de processamento de um pedido (ex: `tentativa-1`).                                      |
| `cortex-feito`     | O Cortex concluiu o pedido com sucesso.                                                                     |
| `cortex-travado`   | O Cortex encontrou um problema e não consegue prosseguir com o pedido. Requer intervenção humana.         |
| `cortex-dividido`  | O pedido foi dividido em partes menores para facilitar o processamento.                                     |
| `cortex-parte`     | Indica que esta é uma parte de um pedido maior que foi dividido.                                            |
| `cortex-sem-divisao` | O pedido é pequeno e não precisa ser dividido em partes.                                                  |
| `cortex-prioridade`| Este pedido tem prioridade e será processado antes de outros.                                               |
| `cortex-jules`     | O pedido está sendo processado pelo agente Jules (uma parte do Cortex).                                     |
| `jules-enviado`    | O pedido foi enviado ao agente Jules para processamento.                                                    |
| `cortex-retomada`  | O Cortex está retomando o processamento de um pedido que foi pausado.                                       |
| `so-humano`        | Este pedido requer apenas revisão ou execução humana, sem envolvimento do Cortex.                           |
| `revisao-manual`   | O pedido precisa de uma revisão manual por um humano antes de ser concluído.                               |
| `automerge`        | Indica que as mudanças feitas pelo Cortex podem ser mescladas automaticamente após os testes passarem.      |
