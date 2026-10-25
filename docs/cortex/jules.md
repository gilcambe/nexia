# Como o Jules (nossa IA mais forte) entra em ação

O Jules é a inteligência artificial mais avançada que temos para resolver tarefas complexas. Ele entra em ação em algumas situações específicas para garantir que o trabalho seja feito de forma eficiente.

## Tarefas grandes e importantes

Se uma parte grande de uma tarefa receber o rótulo `cortex-jules`, ela será enviada diretamente para o Jules. Se, por algum motivo, o Jules não aceitar começar essa tarefa em até 20 minutos, ela volta para o Cortex (nossa IA principal) para ser reavaliada. Nada fica esperando horas.

## Tarefas que estão travadas

Quando uma tarefa não consegue progredir, o Jules pode ser acionado para ajudar a destravar.

-   **Tentativa inicial**: Se uma tarefa estiver travada, ela será enviada ao Jules automaticamente a cada 15 minutos até que ele comece a trabalhar nela.
-   **Volta ao Cortex**: Se o Jules não conseguir enviar um Pull Request (uma proposta de código) em 2 horas, a tarefa é considerada "travada demais" para ele. Nesse caso, ela volta para o Cortex do zero e recebe o rótulo `cortex-retomada`. Isso indica que o Cortex precisa tentar novamente, talvez de uma forma diferente.
-   **Nova chance para o Jules**: Se a tarefa voltar para o Cortex e travar novamente, ela será enviada de novo para o Jules.
-   **Situação `so-humano`**: Se a tarefa ainda não for resolvida mesmo após essa segunda tentativa do Jules, ela receberá o rótulo `so-humano`. Isso significa que a tarefa é tão complexa ou peculiar que precisa de uma pessoa para resolvê-la.

## Limites do plano grátis do Jules

Para que possamos usar o Jules de forma sustentável, temos um limite para o seu uso:

-   **Tarefas por dia**: Podemos enviar até 15 tarefas para o Jules por dia.
-   **Tarefas ao mesmo tempo**: O Jules consegue trabalhar em até 3 tarefas simultaneamente.