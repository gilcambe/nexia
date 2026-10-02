# PHASE-6-REPORT.md — Fase 6: Tool Gateway e Policy Engine

Branch `nexia-ai/fase-6`, base `develop` @ `c219f64`. Sem deploy, sem credencial nova, regras e índices não publicados (índices novos só no arquivo).

## Entregas

| Pedido (MIGRATION-PLAN Fase 6) | Arquivo · função | Teste |
|---|---|---|
| Registro de ferramentas com nível de risco declarado | `nexia-ai/tool-gateway/index.js` · `createGateway` (registro valida nome, risco e `run`); `describe()` | G2, G8 |
| Decisão automática/confirmação/proibido por projeto e ambiente | `nexia-ai/policy-engine/index.js` · `decide`; entidade `ToolPolicy` | `tests/unit/policy-engine.test.js` P1–P5; G5 |
| Log de cada chamada no Vault | entidade `ToolCall` (`vault_tool_calls`), auditoria do Vault em cada mudança de estado | G1, G3 (histórico create→update→update), G7 |
| Ferramentas iniciais só de leitura: `vault.*`, `github.get_repo`, `github.get_checks` | `tool-gateway/tools/vault.js` (`get`, `list`, `history`, `context`), `tool-gateway/tools/github.js` | G1, G2, G7, G10 (GitHub real) |
| Fila de aprovações pendentes visível no painel | `GET /api/nexia/approvals`, `POST /approvals/{id}/approve|reject`; página `src/pages/aprovacoes/page.tsx` (`/aprovacoes`) | G3, G4, G8; Playwright "NEXIA AI — Fase 6" |

Schemas novos no Vault (`ToolCall`, `ToolPolicy`): `VAULT-SCHEMAS.md` e `firestore.indexes.json` regenerados pelos scripts (`54` índices `vault_*`).

## Saídas cruas (local)

```
$ npm test
ok 28 - P1. matriz padrão: LOW auto; MEDIUM a partir da autonomia 1; HIGH a partir da 3; CRITICAL sempre confirma
ok 29 - P2. produção: acima de LOW sempre confirma, em qualquer autonomia; LOW continua automático
ok 30 - P3. ferramenta desconhecida ou sem risco declarado é proibida
ok 31 - P4. política do projeto: forbidden e confirm endurecem; auto libera só até HIGH e fora de produção
ok 32 - P5. curingas: "*", prefixo.* e segmento.*
# tests 62
# pass 62
# fail 0
# skipped 0

$ NODE_USE_ENV_PROXY=1 npm run test:rules
ok 37 - G1. LOW automático: vault.list executa na hora e fica registrado no Vault
ok 38 - G2. escopo e validação: registro de outro projeto falha com SCOPE; entrada inválida e ferramenta desconhecida não executam
ok 39 - G3. MEDIUM na autonomia 0: fila de aprovação; agente não aprova; versão evita execução dupla
ok 40 - G4. rejeição e expiração: nada executa
ok 41 - G5. política do projeto: forbidden nega na hora; política alterada antes da aprovação impede a execução
ok 42 - G6. idempotência: a mesma chave não executa duas vezes
ok 43 - G7. GitHub: só o repositório do projeto; SHA encurtado no registro; checks resumidos
ok 44 - G8. HTTP /api/nexia: tools, invoke, approvals e tool-calls; usuário comum barrado
ok 45 - G9. regras: a fila (entrada completa) é inacessível a clientes; o log segue a regra vault_*
ok 46 - G10. GitHub real (gilcambe/nexia): get_repo e get_checks pelo gateway
# tests 84
# pass 84
# fail 0
# skipped 0

$ npm run test:e2e
  55 passed

$ npm run test:e2e:readdy
READDY original: 89 testes, 67 passaram, 20 falharam, 2 pulados, 22 conhecidos.
Sem regressões em relação ao develop.

$ npm run typecheck
> tsc --noEmit -p .
```

## TEMPORÁRIO / limitações

| Item | Motivo | Risco | Remoção |
|---|---|---|---|
| Projeto com `ToolCall` não pode ser removido | Log de ferramentas é auditoria | Projeto arquivado segue referenciado | Fase 11 (retenção) |
| Expiração da aprovação fixa em 24 h | Sem configuração por projeto ainda | Aprovação lenta precisa ser pedida de novo | Quando houver configuração por projeto |
| Nenhuma ferramenta de escrita registrada ainda | Plano da fase: só leitura | A fila só recebe chamadas quando a política endurece leituras | Fases 7–9 (Bridge, GitHub, CI/CD) |
| Nível 5 de autonomia não libera produção | Decisão do dono: produção sempre com pessoa | — | Revisão na Fase 11 |
| A fila `nexia_tool_queue` sem TTL nativo | TTL é configuração de produção | Pendentes expiradas ficam até alguém tentar aprovar | Junto da política de TTL do Vault |

## Pendências do dono (inalteradas)
Rotacionar segredos; restringir a chave Firebase e ativar App Check; restaurar masters antes de publicar regras; publicar regras e índices (agora incluem `vault_tool_calls` e `vault_tool_policies`); deploy; decisão sobre NEXIA-OS e reescrita de histórico.
