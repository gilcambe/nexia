# PHASE-4-REPORT.md — Fase 4: Project Resolver e Context Engine

Branch `nexia-ai/fase-4`, base `develop` @ `e44d09d`. Sem deploy, sem credencial nova, sem regras publicadas.

## Entregas

| Pedido (MIGRATION-PLAN Fase 4) | Arquivo · função | Teste |
|---|---|---|
| Resolução em 8 camadas com `ProjectContext {project_id, client_id, confidence, rationale}` | `nexia-ai/project-resolver/index.js` · `resolveProject` | `tests/integration/nexia-resolver.test.js` R1–R4 |
| Pergunta ao usuário abaixo do limiar | `resolveProject` (`needs_confirmation`, `question`) | R2, R4; R7 (`/api/cortex` devolve `clarification`) |
| Context Engine compacto com orçamento de tokens | `nexia-ai/context-engine/index.js` · `buildContext` | R5 |
| `cortex-chat` chama o resolver quando há projeto em jogo, sem mudar o fluxo sem projeto | `nexia-ai/cortex/index.js` · `resolveForChat`, `promptSection`; `netlify/functions/cortex-chat.js` (+18 linhas) | R6, R7; regressão Playwright e READDY sem mudança |
| Aceitação A (cliente conhecido) e B (cliente ambíguo) | — | R1 e R2 |
| Endpoints de apoio | `nexia-ai/api/index.js`: `POST /resolve`, `GET /projects/{id}/context` | R7 |
| Normalização de texto | `nexia-ai/text.js` | `tests/unit/nexia-text.test.js` |

Dados de teste: os produtos que existem neste repositório (NEXIA OS em `gilcambe/nexia`; CES com as páginas de `ces/`; Viajante Pro com `vp-guide.html` e `vp-passenger.html`).

## Saídas cruas (local)

```
$ npm test
# tests 45
# pass 45
# fail 0

$ NODE_USE_ENV_PROXY=1 npm run test:rules
ok 29 - R3. camadas 2–4: nome, alias, repositório e workspace
ok 30 - R4. camadas 5–7 e limiar: conversa + histórico somam; sem sinal não há candidato; busca lexical sozinha pergunta
ok 31 - R5. Context Engine: camadas, refs verificáveis, só memórias aprovadas e vigentes, orçamento
ok 32 - R6. ponte do chat: usuário comum não usa o Vault; admin recebe contexto, pergunta ou nada
ok 33 - R7. HTTP: /api/nexia/resolve e /projects/{id}/context; /api/cortex pergunta antes de agir no caso ambíguo
# tests 69
# pass 69
# fail 0
# skipped 0

$ npm run test:e2e
  51 passed

$ npm run test:e2e:readdy
READDY original: 89 testes, 67 passaram, 20 falharam, 2 pulados, 22 conhecidos.
Sem regressões em relação ao develop.
```

## TEMPORÁRIO / limitações

| Item | Motivo | Risco | Remoção |
|---|---|---|---|
| Camada 7 lexical, sem embeddings | Sem provedor de embeddings antes do Model Router | Perde sinônimos | Fase 5+ |
| Chat segue sem contexto se o resolver falhar (fail-open) | Não derrubar o produto atual | Resposta sem contexto | Fase 10 |
| Contexto só para master/admin no chat | Mesmo critério das regras `vault_*` | Membros comuns não recebem contexto do projeto | Quando houver política de leitura por papel (Fase 6) |
| Resposta não-stream do chat não informa `project` | Mudança mínima no legado | Só o stream informa o projeto resolvido | Fase 5 (router) |
| Estado da conversa (`nexia_chat_state`) sem TTL | TTL é configuração de produção | Crescimento da coleção | Junto da política de TTL do Vault |
