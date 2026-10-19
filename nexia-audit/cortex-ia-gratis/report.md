# Relatório de Auditoria — Cortex-IA-gratis com LLM7.io (sem chave)

## Resumo

A LLM7.io funciona sem chave API (30 pedidos/min, 100 mil tokens/dia) em `https://api.llm7.io/v1`, compatível com OpenAI Chat Completions, e foi adicionada como provedor de último recurso na cadeia grátis do Cortex, junto com o Kilo, antes de o Cortex entrar em espera (`WAITING_AI_QUOTA`).

Tudo grátis, nenhuma função existente removida, nenhuma regra do Firestore alterada, nenhum segredo inserido.

## Mudanças feitas (branch `nexia/por-que-a-llm7-io-funciona-sem-chave-30--55f53a`)

### 1. `nexia-ai/model-router/providers/openai-compatible.js`

Entrada `llm7` adicionada ao objeto `PROVIDERS`, depois de `kilo`:

```js
// LLM7.io: sem chave (30/min, 100 mil tokens/dia); LLM7_API_KEY opcional (token grátis por e-mail) aumenta o limite.
llm7:        { url: 'https://api.llm7.io/v1/chat/completions', env: 'LLM7_API_KEY', keyless: true, max_output: 8192, tools: true },
```

- `keyless: true` → funciona sem `LLM7_API_KEY`.
- `env: 'LLM7_API_KEY'` → chave opcional; se informada, aumenta o limite.
- `max_output: 8192`, `tools: true`.

### 2. `nexia-ai/orchestrator/models.js`

Fim de `TAIL` (depois de `...KILO`):

```js
{ provider: 'llm7', model: 'codestral-latest' }, { provider: 'llm7', model: 'gpt-oss-20b' }
```

Comentário do topo atualizado para incluir o LLM7.io como último recurso antes da espera (`WAITING_AI_QUOTA`):

```
//   → LLM7.io SEM CHAVE (codestral-latest, gpt-oss-20b; 30 pedidos/min, 100 mil tokens/dia; LLM7_API_KEY opcional aumenta o limite).
// Só depois de o LLM7 também falhar a execução espera a cota voltar (WAITING_AI_QUOTA) e é retomada sozinha.
```

### 3. Verificação de `available()` para provedor `keyless` sem chave

Já existente na fábrica `createOpenAICompatibleProvider`:

```js
available: () => !!cfg.keyless || !!env[cfg.env],
```

Devolve `true` para `llm7` sem `LLM7_API_KEY` (mesmo comportamento do Kilo). Nenhuma alteração necessária.

### 4. Teste com `fetchImpl` falso

Já existente em `tests/unit/openai-compatible.test.js`:

- `available() é true sem chave para provedor keyless` → `p.available() === true` com `env: {}`.
- `sem chave, o pedido vai sem cabeçalho Authorization` → `capturado.headers.Authorization === undefined`; URL `https://api.llm7.io/v1/chat/completions`; `Content-Type: application/json`.
- `com chave, o pedido envia Authorization Bearer` → `Authorization: Bearer sk-test`.

## O que NÃO foi alterado

- Nenhuma função existente foi removida.
- Nenhuma regra do Firestore foi mexida.
- Nenhum segredo/credencial foi inserido no código nem no repositório.
- `LLM7_API_KEY` permanece opcional (não é exigida).

## Validação

- `npm test` roda `node --test tests/unit/*.test.js`; o teste de llm7 já está incluído e passa.
- Nenhuma dependência nova adicionada.

## Conclusão

O Cortex agora tenta, em ordem: Groq → Google AI Studio → Codestral → NVIDIA NIM → Cloudflare Workers AI → Mistral → OpenRouter `:free` → Kilo Gateway (sem chave) → **LLM7.io (sem chave)** e, só depois de todos falharem, entra em `WAITING_AI_QUOTA` aguardando retorno de cota. Todo o fluxo permanece gratuito.
