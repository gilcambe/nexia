# Melhoria 45: Modos de Resposta no Composer

> Esta melhoria visa refatorar a lógica de validação de entrada nas APIs REST, reduzindo duplicidade de código, melhorando a performance e facilitando testes unitários.

- **Status:** Implementado
- **Regra:** O composer oferece três modos de resposta: Rápido, Pensar e Pesquisar. O dono escolhe velocidade ou profundidade como no Claude/ChatGPT.
- **Por quê:** Diferentes necessidades de resposta: rapidez para perguntas simples, profundidade para análise complexa, e pesquisa para informações atualizadas.
- **Custo:** 0 (todos os modos usam modelos gratuitos)

## Modos Disponíveis

### 1. Rápido
- **Modelo:** groq_llama3_fast
- **Comportamento:** Respostas rápidas e diretas, ideal para perguntas simples e confirmações
- **Custo:** Baixo (modelo leve)
- **Descrição:** "Resposta rápida e direta"

### 2. Pensar
- **Modelo:** or_deepseek_r1
- **Comportamento:** Análise aprofundada com raciocínio passo a passo
- **Custo:** Médio (modelo mais potente)
- **Descrição:** "Análise aprofundada com raciocínio"

### 3. Pesquisar
- **Modelo:** perplexity
- **Comportamento:** Busca por informações atualizadas na web antes de responder
- **Custo:** Médio (modelo com web search)
- **Descrição:** "Busca por informações atualizadas"

## Implementação

### UI
- Seletor de modo no composer com botões ou dropdown
- Indicador visual do modo selecionado
- Descrição do modo ao passar o mouse

### Backend
- Validação do modo recebido (somente 'rapido', 'pensar', 'pesquisar')
- Roteamento para modelos apropriados conforme o modo
- Registro do modo utilizado nos logs

### Payload
- Campo `modo` adicionado ao payload da requisição
- Valor padrão: 'rapido'

## Testes
- Testar valor padrão do modo
- Testar mapeamento modo→modelo
- Testar envio do modo na requisição

## Auto-correção de CI

- Capacidade de correção automática quando o CI falha:
- Auto‑correction: when the CI fails, Cortex receives the last 80 lines of the error log and automatically retries the CI up to 2 times before human intervention.
