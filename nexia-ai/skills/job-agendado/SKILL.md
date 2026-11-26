---
name: job-agendado
description: quando a tarefa cria ou muda cron, robô, fila ou varredura
---

# SKILL job-agendado

Use esta skill quando a tarefa cria ou muda qualquer processo agendado (cron, robô, fila, varredura).

Regras de uso:

1. Idempotência obrigatória: antes de criar, checar se já existe PR juntado da mesma tarefa ou estado; nunca duplicar processamento.

2. Prazo antes do limite: jobs (GitHub Actions, Worker, cron) têm limite de tempo (ex.: 30 min). Pare de pegar itens novos 5 minutos antes do limite. Deixe o restante para a próxima execução.

3. Log: cada item processado (ou tentado) deve ser registrado no log com status claro (sucesso/erro/pulado), facilitando auditoria e retomada.
