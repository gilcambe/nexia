# PHASE-10-REPORT.md — Fase 10: Orchestrator, agentes e gates de QA

Branch `nexia-ai/fase-10`, base `develop` @ `ecd409c`. Sem deploy, sem credencial nova, sem regras publicadas. Nenhuma chamada real a modelo, GitHub ou deploy nos testes: o modelo é um roteiro de teste (router falso) e o GitHub é o falso em memória (`tests/fake-github.js`), agora com check runs configuráveis.

## Entregas

| Pedido (MIGRATION-PLAN Fase 10 / spec §6, §7, §14, §22, §27, §29) | Arquivo | Teste |
|---|---|---|
| Orquestrador com plano, orçamento e estado de execução | `nexia-ai/orchestrator/index.js`; entidade `Execution` no Vault | O1–O7 |
| Agentes Architect, Coder, Frontend, Backend, Database, QA, Security, DevOps, Reviewer (prompt + ferramentas permitidas + classe de modelo) | `orchestrator/agents.js`, `orchestrator/models.js` | U4; O1 |
| Runtime do agente: ferramenta pelo Tool Gateway, retry, troca de modelo, veredito estruturado | `orchestrator/runtime.js` | O1, O4 |
| Gates 1–11 com evidência; nada "feito" sem confirmação da ferramenta | `orchestrator/gates.js` | U2; O1, O4, O6 |
| API e painel | `POST/GET /api/nexia/executions`, `GET .../{id}`, `POST .../{id}/refresh`, `POST .../{id}/resume`; página `/execucoes` | O8; E2E Fase 10 |
| Funções legadas no Model Router (fecha ADR-F5-03) | `netlify/functions/{architect,autodev-engine,sentinel,dynamic-pricing,ai-sales-agent,takedown-gen,cortex-memory}.js` | `npm test`; grep abaixo |

Fluxos cobertos (spec §29): mudança de código com branch, commit, revisão, segurança, PR e CI (O1); pedido ambíguo (O2); aprovação humana e retomada (O3); falha sem falso sucesso — agente sem commit, revisão reprovada, modelo fora do ar, aprovação rejeitada (O4); orçamento (O5); staging só com CI verde e produção bloqueada (O6); pergunta só leitura (O7).

## Saídas cruas (local)

```
$ node --test tests/unit/orchestrator.test.js
ok 1 - U1. intenção por regras (spec §29) e especialista pelo assunto
ok 2 - U2. gates: sem evidência fica pending; check falho reprova; obrigatório sem check nunca passa
ok 3 - U3. orçamento: passos, ferramentas, tokens e tempo
ok 4 - U4. agentes: os 10 da spec, só leitura onde deve, modelos por classe
# tests 4
# pass 4
# fail 0

$ npm test
# tests 94
# pass 94
# fail 0

$ npm run test:rules   (só tests/integration/orchestrator.test.js)
ok 1 - O1. pedido de mudança: análise → branch → commit → revisão → segurança → PR; só conclui quando o CI fica verde
ok 2 - O2. pedido ambíguo (spec §29 caso B): pergunta qual projeto e não cria execução
ok 3 - O3. autonomia 2: o PR espera aprovação humana; resume segue só depois de aprovado
ok 4 - O4. sem falso sucesso: agente sem commit, revisão reprovada e aprovação rejeitada terminam em failed
ok 5 - O5. orçamento estourado para a execução com BUDGET_EXCEEDED
ok 6 - O6. staging com CI verde e nível 4; produção nunca é executada
ok 7 - O7. pergunta: só leitura, conclui com a resposta do agente
ok 8 - O8. API /api/nexia/executions: 202 e execução em segundo plano; pergunta sem execução; admin de outro tenant barrado
# tests 8
# pass 8
# fail 0

$ npm run test:rules   (todos)
# tests 106
# pass 106
# fail 0

$ npm run test:e2e
  ✓  59 tests/e2e/regression.spec.js:135:3 › NEXIA AI — Fase 10 › /execucoes sem login pede login e não chama a API (521ms)
  ✓  60 tests/e2e/regression.spec.js:143:3 › NEXIA AI — Fase 10 › /api/nexia/executions sem token responde 401 (29ms)
  60 passed (26.2s)

$ grep -rn "api.anthropic|api.groq|api.openai|generativelanguage|api.deepseek" <7 funções migradas> | wc -l
0
```

## Erros achados pelos testes e corrigidos

- Uso/custo somado em dobro a cada gravação intermediária: agora soma uma vez sobre o uso anterior à rodada.
- Gravação intermediária com status final sem `finished_at` (regra `final_requires_finished_at`) e `needs_input` sem pergunta: o estado final só é gravado no `finish`.
- Gates de staging no `refresh` não liam os checks da branch do ambiente: corrigido (`stagingRef`).

## Pendências do dono

1. Ter `ANTHROPIC_API_KEY` no Render (sem ela os agentes respondem `NO_MODEL` e a execução falha com aviso, sem fingir).
2. Criar a NEXIA GitHub App (Fase 8) para os passos de escrita.
3. Publicar índices do Firestore (inclui `vault_executions`) junto com as regras, depois de restaurar os masters.

## TEMPORÁRIO / limitações

| Item | Motivo | Risco | Remoção |
|---|---|---|---|
| Execução em segundo plano no próprio processo (ADR-F10-03) | Sem infraestrutura nova nesta fase | Reinício deixa execução parada até `resume` | Fase 11 |
| Gates 1–7 por nome do check (ADR-F10-02) | Sem mapa check→gate no Vault | Check com nome enganoso | Fase 11 |
| Intenção por regras (ADR-F10-04) | Determinístico e auditável | Pedido misto cai na primeira regra (falha segura) | Fase 11 |
| Resultado de ferramenta como texto ao modelo (ADR-F10-04) | Model Router só com texto | Prompt injection por conteúdo lido (mitigado por política e verificação) | Quando houver `tool_result` nativo |
| Log do Bridge fora do Vault; Bridge sem runner Windows | Exige credencial do Bridge / máquina do dono | Auditoria local não centralizada | Fase 11 |
| Produção não executada pelo Orchestrator | Plano: produção só com aprovação humana | — | Fase 11 |
