# Robôs das Máquinas: Trabalho Local que Poupa Cota

## Objetivo
Os PCs do dono gerarem tokens próprios de graça em trabalho que poupa a cota das IAs da nuvem. Nunca atendem cliente e nunca escrevem código (IA pequena erra fatos).

## Tipos de Tarefa em `tarefas_locais`

### 1. Vetorização (`vetor`)
- **Função**: Gerar vetor de texto com `nomic-embed-text` do Ollama (`/api/embed`).
- **Uso**: Cache semântico (#1824) usa isso primeiro; se nenhuma máquina estiver online, usa Workers AI.
- **Benefício**: Poupa a cota diária da Cloudflare.

### 2. Triagem (`triagem`)
- **Função**: Classificar pedido novo do Cortex em `bug`, `ideia`, `duvida` ou `grande` e sugerir rótulo.
- **Validação**: Resposta só aceita se for uma dessas palavras; senão descarta.
- **Benefício**: Filtra pedidos inválidos antes de enviar para a IA da nuvem.

### 3. Resumo de Erro (`resumo-erro`)
- **Função**: Quando uma tarefa do Cortex falha, resumir o log em até 8 linhas (arquivo, linha, mensagem) antes de mandar para a IA da nuvem tentar de novo.
- **Benefício**: Poupa tokens de entrada da nuvem.

### 4. Cache Noturno (`cache-noturno`)
- **Função**: Entre 0h e 6h, gerar respostas para as 50 perguntas gerais mais frequentes da semana e guardar como **rascunho**. Um modelo da nuvem só revisa (aprova/corrige) de dia; só rascunho aprovado entra no cache.
- **Benefício**: Reduz a carga diária da IA da nuvem.

## Regras
- Cada tipo tem tempo máximo (vetor 20 s, triagem 30 s, resumo 90 s, noturno sem pressa) e cai para a nuvem se passar.
- Escolher a máquina pelo pulso: tarefa pesada vai para a de mais RAM livre.
- Placar na Central (card Máquinas): tokens gerados localmente hoje e tokens de nuvem poupados.
- Variável `CORTEX_ROBOS_LOCAIS` liga tipo por tipo (ex.: `vetor,triagem`). Padrão: só `vetor`.

## Pronto Quando
- Testes com Ollama falso provam cada tipo.
- A queda para a nuvem por tempo.
- Que resposta inválida da triagem é descartada.
