# Estudo: custo de IA em milhares (2026-10-26)

## 1. Contexto

O Cortex usa um roteador de modelos com vários provedores grátis. Cada chamada de IA custa tempo de fila e, em alguns provedores, cota de tokens.

## 2. Situação atual

O roteador de modelos fica em `nexia-ai/model-router/`. Os provedores de reserva são testados em ordem; se um não responde, o próximo é tentado.

## 3. Custo observado

As chamadas de IA para programar e revisar (fila interna do Cortex) consomem cotas dos provedores grátis. Quando um provedor cai, a fila pode travar esperando timeout.

## 4. Provedor de reserva Ollama (apenas jobs internos do Cortex)

### 4.1 O que muda

Um novo provedor `ollama` entra no roteador de modelos. Ele é compatível com a API OpenAI (`/v1/chat/completions`, `/v1/models`) e usa o endpoint `/api/tags` do Ollama apenas para o ping de saúde.

- **URL:** variável `OLLAMA_URL` (ex.: `https://xxx/v1`). Se vazia, o provedor **não existe** — não entra na lista e nada muda no comportamento.
- **Token:** variável `OLLAMA_TOKEN` (enviada no header `Authorization: Bearer`).
- **Modelo:** variável `OLLAMA_MODELO`, padrão `qwen2.5-coder:7b`.

### 4.2 Posição na fila de reserva

O provedor `ollama` entra no **fim** da lista de provedores de reserva. Só recebe jobs internos do Cortex (programar, revisar).

O ping de saúde faz `GET /api/tags` com **timeout de 5 segundos**. Se o Ollama não responder em 5 s, o provedor é pulado e a fila segue para o próximo, sem travar.

### 4.3 Bloqueio para clientes

O provedor `ollama` **nunca** é exposto no chat de clientes. É restrito a jobs internos do Cortex. O computador do dono pode desligar a qualquer momento sem afetar clientes.

### 4.4 Guia de instalação

Veja o guia passo a passo para leigo em `docs/ollama-reserva.md`.

### 4.5 Critérios de prontidão

- Sem `OLLAMA_URL` → nada muda no comportamento do roteador.
- Ollama fora do ar → a fila não trava (pulo após 5 s).
- Chat de cliente nunca usa esse provedor.

---

*Feito com Kernex* — seleção de modelo por tarefa, sem pagar por IA.
