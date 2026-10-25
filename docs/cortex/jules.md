# Como o Jules (nossa IA mais forte) trabalha

O Jules é uma inteligência artificial mais potente que usamos para tarefas complexas. Veja como ele entra em ação:

- **Rótulo `cortex-jules`**: Se uma tarefa recebe este rótulo, ela vai direto para o Jules. Se o Jules não aceitar a tarefa em até 3 horas, ela volta para o Cortex (nossa IA padrão).

- **Tarefa travada**: Se uma tarefa ficar travada e não tiver progresso, o Jules tentará ajudar a cada 15 minutos.

- **Sem retorno do Jules**: Se o Jules não enviar um Pull Request (uma proposta de código) em 24 horas, a tarefa volta para o Cortex do zero. Ela receberá o rótulo `cortex-retomada`.

- **Travou de novo**: Se a mesma tarefa que voltou do Jules travar novamente, ela será enviada para o Jules mais uma vez.

- **`so-humano`**: Depois de voltar do Jules, travar de novo e ir para o Jules novamente, se a tarefa ainda não for resolvida, ela receberá o rótulo `so-humano`. Isso significa que ela precisa de ajuda de uma pessoa.

## Plano Grátis do Jules

O Jules tem um plano grátis com as seguintes limitações:
- 15 tarefas por dia.
- Até 3 tarefas rodando ao mesmo tempo.