# PHASE-5-REPORT.md — Fase 5: Model Router

Branch `nexia-ai/fase-5`, base `develop` @ `79861f6`. Sem deploy, sem credencial nova, sem chave real nos testes (servidor falso que fala o protocolo de cada provedor).

## Entregas

| Pedido (MIGRATION-PLAN Fase 5) | Arquivo · função | Teste |
|---|---|---|
| Interface `ModelProvider` (chat, structured_output, tool_call, streaming, capabilities, cost_estimate) | `nexia-ai/model-router/index.js` · `createRouter` (`chat`, `stream`, `toolCall`, `structuredOutput`, `capabilities`, `costEstimate`, `*WithFallback`) | `tests/unit/model-router.test.js` M2–M8 |
| Adapter Claude com SDK oficial | `providers/anthropic.js` (`@anthropic-ai/sdk` 0.131.0, versão exata) | M2, M3, M8; S1, S5 |
| Adapters dos provedores atuais reaproveitando o catálogo | `providers/openai-compatible.js` (12 provedores), `providers/gemini.js`, `providers/cohere.js` | M4, M5, M6, M9 |
| Streaming real (escrever no `res` à medida que os tokens chegam) | `lib/stream-response.js` · `writeStream`; `server.js` (+4 linhas); `cortex-chat` devolve `{ stream }` | M3, M10; S1 (1º token chega ao cliente HTTP enquanto o provedor segura o resto) |
| Resumos de memória que sumiam no Claude | `model-router/messages.js` · `normalizeRequest` | M1, M2; S1 (o Claude recebe "MEMÓRIA COMPRIMIDA" no `system`) |
| `cortex-chat` e `multi-model-engine` usam o router | `netlify/functions/cortex-chat.js` (`callSync`, ramo de streaming); `netlify/functions/multi-model-engine.js` (`callModel`) | S1, S4, S5; M9 |
| Nenhum modelo removido do catálogo | `AI_CATALOG` 52 e `MODELS` 13, iguais a `e44d09d` | M9 |

Prova de que S1 detecta a regressão: com `writeStream` alterado localmente para acumular e enviar no fim, S1 falhou com `o gate só abre quando o cliente recebe o 1º token` (`true !== false`); o arquivo foi restaurado em seguida.

## Saídas cruas (local)

```
$ npm test
ok 9 - M1. resumos da memória (role system no histórico) viram system prompt em vez de sumir
ok 10 - M2. Claude via SDK oficial: chat com resumo no system, max_tokens limitado ao teto do modelo, uso e custo
ok 11 - M3. streaming real no Claude: o primeiro token chega antes de o provedor terminar
ok 12 - M4. OpenAI-compatível (Groq): streaming com uso, chat, teto de max_tokens e tool_call
ok 13 - M5. Gemini: streaming com a chave no header (nunca na URL)
ok 14 - M6. chave ausente falha antes de qualquer chamada de rede
ok 15 - M7. fallback: troca de provedor antes do primeiro token; erro depois do primeiro token não troca
ok 16 - M8. saída estruturada: tool forçada no Claude, JSON validado no Gemini, inválida vira INVALID_OUTPUT
ok 17 - M9. catálogos: todo modelo do cortex-chat e do multi-model-engine tem provedor no router (nenhum removido)
ok 18 - M10. server.js: resposta { stream } sai em trechos e o iterador é encerrado se o cliente desconectar
# tests 55
# pass 55
# fail 0
# skipped 0

$ npm run test:rules
ok 12 - S1+S2+S3. /api/cortex com Claude: 1º token antes do fim, resumo da memória no system, conversa salva
ok 13 - S5. /api/cortex sem stream: Claude via router devolve a resposta completa em JSON
ok 14 - S4. sem nenhuma chave de IA: resposta de aviso em SSE, como antes da Fase 5
# tests 72
# pass 71
# fail 0
# skipped 1      (A7 lê o GitHub real; roda no CI com o token do workflow)

$ npm run test:e2e
  52 passed

$ npm run test:e2e:readdy
READDY original: 89 testes, 67 passaram, 20 falharam, 2 pulados, 22 conhecidos.
Sem regressões em relação ao develop.

$ npm run typecheck
> tsc --noEmit -p .
```

## Mudanças de comportamento

- O chat do Cortex com `stream: true` agora entrega os tokens à medida que chegam (antes, tudo no fim).
- Claude e GPT-4o voltam a responder no chat: o `max_tokens` de 100000 era recusado com 400 e o chat caía no fallback.
- Temperaturas fixas por provedor do `callSync` antigo deixaram de ser enviadas (ADR-F5-02).
- Resposta sem stream do chat informa `_meta.project` quando há projeto resolvido (pendência da Fase 4).

## TEMPORÁRIO / limitações

| Item | Motivo | Risco | Remoção |
|---|---|---|---|
| Tetos de `max_tokens` por provedor, não por modelo | Sem catálogo de limites por modelo | Cortar resposta longa num modelo que aceitaria mais | Fase 11 |
| Tabela de preço estática e parcial (`pricing.js`) | Custo medido por execução é da Fase 11 | Preço desatualizado; fora da tabela → `known: false` | Fase 11 |
| Cohere sem streaming nativo | Mudança mínima | Resposta chega em um trecho | Quando houver uso do Cohere no chat |
| Gemini e Cohere sem `tool_call` no adapter | `structuredOutput` funciona por JSON validado | Menos robusto que ferramenta forçada | Fase 6 (Tool Gateway) |
| 6 funções legadas e o resumo do `cortex-memory` chamam provedores direto | Fora do escopo do plano para esta fase | Sem fallback/limites do router nelas | Fase 10 (ADR-F5-03) |

## Pendências do dono (inalteradas)
Rotacionar segredos expostos; restringir a chave Firebase e ativar App Check; restaurar masters antes de publicar regras; publicar regras e índices; deploy; decisão sobre NEXIA-OS e reescrita de histórico. Para o Claude funcionar em produção depois do deploy, `ANTHROPIC_API_KEY` precisa estar configurada no Render (já era usada pelo código anterior).
