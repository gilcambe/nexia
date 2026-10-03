# PHASE-11-REPORT.md — Fase 11: produção com aprovação, observabilidade e aceitação

Branch `nexia-ai/fase-11`, base `develop` @ `b0f61c2`. Última fase do MIGRATION-PLAN. Sem deploy (nem staging nem produção), sem credencial nova, sem regras/índices publicados. Tudo testado contra o GitHub falso em memória e o emulador do Firestore.

## Entregas

| Pedido (MIGRATION-PLAN Fase 11 / spec §21, §23, §29, §30 fases 20–22) | Arquivo | Teste |
|---|---|---|
| Produção só com aprovação humana | `deploy.production` (CRITICAL) em `nexia-ai/tool-gateway/tools/deploy.js`; `dispatchPipeline` com `allowProduction` + `expectedSha`; plano `deploy_production` no Orchestrator; gate 11 com `approved_by` | O6; G1, G2; H9; U2 |
| Custo e duração por execução; painel de auditoria | `nexia-ai/observability`; `GET /api/nexia/metrics`; página `/auditoria` | Observabilidade; O9; E2E Fase 11 |
| Testes E2E de aceitação A a G (spec §29) | `tests/integration/acceptance.test.js` | A, B, C, D, E, F, G1, G2 |
| Pendências da Fase 10 | retomada (`sweep`), mapa check→gate (`Project.qa_checks`), `run-name` por alvo, `action_pins` | O9; U2; C6; H9 |
| Onboarding cria integrações (caso E) | `nexia-ai/onboarding` (Integration `pending`, sem credencial) | E |
| Piloto | roteiro em `PILOT-RUNBOOK.md` (ação do dono) | — |

## Saídas cruas (local)

```
$ npm test
# tests 96
# pass 96
# fail 0

$ node --test tests/unit/github-adapter.test.js tests/unit/cicd-integrations.test.js tests/unit/orchestrator.test.js   (novos/alterados)
ok 6 - C6. pipeline (Fase 11): alvo no título da execução; ações fixadas por SHA quando informado
ok 15 - H9. pipeline (Fase 11): produção só com allowProduction e com o SHA validado; execução separada por alvo
ok 17 - U2. gates: sem evidência fica pending; check falho reprova; obrigatório sem check nunca passa

$ npm run test:rules   (tests/integration/acceptance.test.js)
ok 1 - A. cliente conhecido: só o nome do cliente e a tarefa; projeto identificado sem perguntar
ok 2 - B. cliente ambíguo: dois projetos possíveis; pergunta antes de editar e não cria execução
ok 3 - C. correção simples: edita, testa (CI), revisa, registra e entrega com evidência
ok 4 - E. projeto novo: onboarding cria snapshot e integrações (pendentes, sem credencial)
ok 5 - F. falha: erro transitório é repetido com segurança; falha real não vira sucesso
ok 6 - G1. produção sem o commit em staging: mesmo aprovada, não dispara
ok 7 - D. deploy: sem comandos manuais; dispara o pipeline autorizado, acompanha e confirma
ok 8 - G2. produção: política exige aprovação humana; depois dela, só o commit validado vai ao ar
ok 9 - Observabilidade: custos, ferramentas, aprovações e deploys do projeto vêm do Vault

$ npm run test:rules   (todos)
ok 67 - O9. sweep retoma execução parada; /api/nexia/metrics agrega custo e auditoria do projeto
# tests 116
# pass 116
# fail 0

$ npm run test:e2e
  ✓  62 tests/e2e/regression.spec.js:152:3 › NEXIA AI — Fase 11 › /auditoria sem login pede login e não chama a API (558ms)
  ✓  63 tests/e2e/regression.spec.js:160:3 › NEXIA AI — Fase 11 › /api/nexia/metrics e sweep sem token respondem 401 (16ms)
  63 passed (26.8s)
```

## Critério de pronto da V1 (spec §33) — estado no código

| Critério | Estado |
|---|---|
| "cliente X" identifica o projeto | Pronto (caso A) |
| Contexto relevante do Vault automático | Pronto (Context Engine, Fase 4) |
| Workspace local correto | Pronto no Bridge (Fase 7); validação na máquina do dono no piloto |
| Analisar e alterar arquivos; criar branch/commit | Pronto (agentes + GitHub App); exige a GitHub App criada |
| Executar testes | Pelo CI do repositório (gates 1–7) e pelo Bridge local |
| GitHub / Firebase / Cloudflare integrados | Pronto no código; Firebase/Cloudflare quando o projeto usa e o dono ativa a integração |
| Deploy disparado e acompanhado sem comandos manuais | Pronto (caso D); exige o pipeline instalado no repositório do cliente |
| Toda operação relevante no Vault; auditoria; permissões | Pronto (ToolCall, Execution, Deployment; `/auditoria`; Policy Engine) |
| Falhas não mascaradas | Pronto (caso F, O4) |
| Projeto real completa solicitação → código → teste → deploy | **Pendente do piloto** (precisa das ações do dono abaixo) |

## Pendências do dono (consolidadas, todas as fases)

1. Rotacionar os secrets expostos (Fase 1) e restringir a chave Firebase por referrer + App Check.
2. Restaurar os masters legítimos e só então publicar regras e índices do Firestore (inclui `vault_executions`).
3. Decidir sobre o repositório NEXIA-OS e sobre reescrever o histórico do git.
4. Criar e instalar a NEXIA GitHub App (Fase 8) e colocar `ANTHROPIC_API_KEY` e as variáveis da App como segredos do Worker no Cloudflare (ADR-HOST-01; o Render foi removido).
5. Deploy desta versão no Cloudflare pelo workflow manual "Deploy Cloudflare" (depois dos itens 1 e 2).
6. Piloto: seguir `PILOT-RUNBOOK.md`.

## TEMPORÁRIO / limitações

| Item | Motivo | Risco | Remoção |
|---|---|---|---|
| ~~Retomada de execução só sob demanda (ADR-F11-03)~~ | Resolvido na ADR-F12-03 (Cron do Worker) | — | — |
| ~~Ações do pipeline na major sem `action_pins` (ADR-F11-05)~~ | Resolvido na ADR-F12-01 (SHA padrão) | — | — |
| Gates por nome de check sem `qa_checks` (ADR-F11-04) | Compatibilidade | Check com nome enganoso | Ao cadastrar `qa_checks` do projeto |
| ~~Log do Bridge fora do Vault (ADR-F11-06)~~ Resolvido na ADR-F12-04; runner Windows na ADR-F12-02 | Credencial do Bridge / máquina do dono | Auditoria local não centralizada | Piloto |
| Resultado de ferramenta como texto ao modelo (ADR-F10-04) | Model Router só com texto | Prompt injection mitigada por política e verificação | Quando houver `tool_result` nativo |
