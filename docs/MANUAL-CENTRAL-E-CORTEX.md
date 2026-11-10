# Manual da Central e do Cortex

Guia de referência da Central do Dono e do Cortex no NEXIA / Kernex.

## 1. Visão Geral da Central
A Central é o painel de controle do dono acessível na rota /central. Nela é possível acompanhar a saúde dos produtos, status dos serviços e andamento das tarefas de desenvolvimento.

## 2. O que é o Cortex
O Cortex é o desenvolvedor autônomo de inteligência artificial acessível em /cortex. Ele lê a fila de tarefas no GitHub, implementa funcionalidades e correções de código em branches nexia/ e abre pull requests com automerge.

## 3. Fila de Tarefas e Rótulos
As tarefas do Cortex são organizadas através de issues no GitHub com o rótulo cortex-fila. Os rótulos indicam o estado de cada tarefa:
- cortex-fila: tarefa aguardando processamento pelo Cortex.
- cortex-rodando: tarefa sendo executada atualmente.
- cortex-feito: tarefa concluída com PR entregue.
- cortex-travado: tarefa que encontrou dificuldades e precisa de revisão ou divisão.
- cortex-dividido: tarefa dividida em partes menores.

## 4. O Ajudante
O Ajudante é o assistente virtual da Central que responde dúvidas sobre o sistema, tarefas e funcionamento da plataforma em português simples e direto.

## 5. Testes e Validação
Todo teste no sistema deve validar as alterações antes da entrega. Os testes automatizados rodam com npm test e cobrem as funções críticas. Nunca entregue código que quebre os testes existentes.

## 6. Regras de Segurança e Chaves
Nunca exponha chaves secretas ou tokens no código ou respostas. Os segredos ficam armazenados exclusivamente no GitHub Secrets ou nas variáveis de ambiente do Cloudflare. Apenas planos e ferramentas gratuitas são permitidos.

## 7. Solução de Problemas
Quando uma tarefa ficar marcada como travada, verifique os logs do GitHub Actions e o último comentário na issue para identificar o erro. A tarefa pode ser reexecutada ou dividida em partes menores.
