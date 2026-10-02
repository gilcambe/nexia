# PHASE-2-REPORT.md — Fase 2: modelo de dados do Vault

Branch `nexia-ai/fase-2`, base `develop` @ `c2bc081`. Escopo: somente a Fase 2 do `MIGRATION-PLAN.md`. Nenhum deploy, nenhuma publicação de regras ou índices, nenhum acesso a produção. Código legado não foi alterado (o módulo novo não é carregado por nenhuma rota ainda; ver "Fora de escopo").

## Entregas, item por item

| # | Pedido | Arquivo · função | Teste que comprova |
|---|---|---|---|
| 1 | Módulo CommonJS no Firestore `nexia-c8710`, coleções `vault_*` | `nexia-ai/vault/index.js` · `createVault`; `schemas.js` · `SCHEMAS[*].collection` | `tests/unit/vault-schemas.test.js` "16 entidades, todas com coleção vault_*…"; `vault-repository` teste 1 |
| 2 | Schemas versionados com validação rigorosa (16 entidades, §5/§21/§25) | `nexia-ai/vault/schemas.js` · `SCHEMAS`; `validate.js` · `validateEntity` | unitário "schema X: válido passa, inválido é rejeitado…" (16) + "campos desconhecidos…" + "tipos…"; `vault-repository` testes 2 (16, no emulador) e 3 |
| 3a | Timestamps do servidor | `repository.js` · `create/update/softDelete/restore` (`FieldValue.serverTimestamp`) | `vault-repository` teste 1 (tipo `Timestamp` no documento cru) |
| 3b | Soft-delete | `repository.js` · `softDelete`, `restore`, `assertNoDependents` | teste 10 |
| 3c | IDs estáveis | `repository.js` · `newId`; `schemas.js` · `idPattern` | teste 1 |
| 3d | Integridade referencial na escrita | `repository.js` · `checkRefs` | teste 5 (inexistente, outro tenant, outro projeto, outro cliente, excluído, auto-referência), teste 10 (restore) |
| 3e | Idempotency key | `repository.js` · `create(…, { idempotencyKey })` | teste 9 (repetição, conflito, escopo por tenant, 3 chamadas simultâneas → 1 registro) |
| 3f | Concorrência (version/etag) | `repository.js` · `loadForWrite`, `assertExpectedVersion` | teste 8 (obrigatório, conflito, 2 escritas simultâneas → 1 vence) |
| 3g | Execution ID gerado e propagado | `execution.js` · `createExecutionContext`; `repository.js` · `last_execution_id`, `auditEntry` | unitário "contexto de execução…"; testes 1 e 11 |
| 4 | Environment só com referência de secret; valores rejeitados | `schemas.js` · `secretRef`; `secrets.js` · `detectSecret`; `repository.js` · `throwIfInvalid` | unitário "Environment: secret_refs…" (9 tipos de secret × 3 campos); teste 12 (create, update, campo `value`, outra entidade; nada gravado, nada auditado, erro sem valor) |
| 5 | `firestore.rules` para `vault_*` (não publicadas) | `firestore.rules` · `isVaultMaster`, `canReadVault`, `match /{vaultCollection}/{vaultDocId}` | `tests/integration/vault-rules.test.js` V1–V6 |
| 6 | Auditoria sem dados sensíveis | `repository.js` · `auditEntry`, `history` | teste 11 (chaves exatas do registro, valores ausentes, hash muda com o conteúdo); teste 9 (chave de idempotência só como hash) |
| 7 | Testes no emulador + CI | `tests/integration/vault-repository.test.js` (30), `tests/integration/vault-rules.test.js` (6), `tests/unit/vault-schemas.test.js` (24); `.github/workflows/ci.yml` (passos renomeados; `npm test` e `npm run test:rules` já incluem os arquivos novos) | saídas abaixo |
| 8 | Documentação | `ARCHITECTURE-DECISIONS.md` (ADR-F2-01…08, D3 aceita), `SECURITY-AUDIT.md` (seção Fase 2), `VAULT-SCHEMAS.md` (gerado), este relatório | unitário "VAULT-SCHEMAS.md está em dia…" |
| — | Índices compostos (§25) | `nexia-ai/vault/indexes.js` · `vaultIndexes`; `firestore.indexes.json` (+49 `vault_*`, legados intactos) | unitário "firestore.indexes.json contém exatamente os índices vault_*…" |

Dados de teste: o próprio projeto NEXIA (`tests/vault-fixtures.js`): repositório `gilcambe/nexia`, URL `https://nexia-os.onrender.com`, projeto Firebase `nexia-c8710`, commits reais da Fase 1 (`c2bc081…`, `196ffe0…`), contagens reais do CI da Fase 1 (Playwright 48/0/0), nomes de variáveis usados pelo código (`GROQ_API_KEY`, `FIREBASE_SERVICE_ACCOUNT_BASE64`, `MASTER_EMAIL`). Os valores com forma de secret dos testes são gerados com bytes aleatórios em tempo de execução; nenhum valor real e nenhum literal no código.

## Saídas cruas (local, Node 22, firebase-tools 13.35.1)

### `npm test`
```
ok 1 - resolveRole: sem promoção por tenant, e-mail padrão ou e-mail não verificado (C3)
ok 2 - demo mode removido: qualquer token sem Firebase Admin é rejeitado (A3)
ok 3 - guard sem token responde 401
ok 4 - validateTenant falha fechado sem Firestore
ok 5 - Sentinel: cabeçalho x-netlify-event não dispensa autenticação (C4)
ok 6 - endpoints sensíveis exigem autenticação (A1, A2)
ok 7 - metrics-aggregator: sem segredo configurado ou com segredo errado → 401
ok 8 - erros internos não vazam detalhes ao cliente (A5)
ok 9 - normalizeRequestPath rejeita traversal, encodings e arquivos ocultos
ok 10 - resolveStatic só devolve arquivos dentro da raiz, com extensão permitida e sem symlink para fora
ok 11 - server.js não serve arquivos fora das raízes públicas (C1)
ok 12 - erro interno de função não expõe detalhes (A5)
ok 13 - 16 entidades, todas com coleção vault_*, prefixo de id e schemaVersion
ok 14 - schema Client: válido passa, inválido é rejeitado com a regra esperada
ok 15 - schema Project: válido passa, inválido é rejeitado com a regra esperada
ok 16 - schema Repository: válido passa, inválido é rejeitado com a regra esperada
ok 17 - schema Environment: válido passa, inválido é rejeitado com a regra esperada
ok 18 - schema Requirement: válido passa, inválido é rejeitado com a regra esperada
ok 19 - schema Decision: válido passa, inválido é rejeitado com a regra esperada
ok 20 - schema Task: válido passa, inválido é rejeitado com a regra esperada
ok 21 - schema Artifact: válido passa, inválido é rejeitado com a regra esperada
ok 22 - schema Conversation: válido passa, inválido é rejeitado com a regra esperada
ok 23 - schema Memory: válido passa, inválido é rejeitado com a regra esperada
ok 24 - schema Change: válido passa, inválido é rejeitado com a regra esperada
ok 25 - schema TestRun: válido passa, inválido é rejeitado com a regra esperada
ok 26 - schema Deployment: válido passa, inválido é rejeitado com a regra esperada
ok 27 - schema Error: válido passa, inválido é rejeitado com a regra esperada
ok 28 - schema Integration: válido passa, inválido é rejeitado com a regra esperada
ok 29 - schema ProjectSnapshot: válido passa, inválido é rejeitado com a regra esperada
ok 30 - campos desconhecidos e metadados do servidor são rejeitados
ok 31 - tipos: string vazia, número em texto, data inválida, array duplicado
ok 32 - Environment: secret_refs aceita nomes de variável e rejeita valores de secret
ok 33 - detectSecret: não acusa nomes de variável, URLs, ids e texto comum
ok 34 - contexto de execução: Execution ID gerado, formato validado
ok 35 - firestore.indexes.json contém exatamente os índices vault_* gerados dos schemas
ok 36 - VAULT-SCHEMAS.md está em dia com schemas.js
# tests 36
# pass 36
# fail 0
```

### `npm run test:rules` (Auth + Firestore Emulator)
```
ok 1 - C3: guest não é promovido ao chamar o tenant nexia (sem auto-reparo)
ok 2 - C3: pertencer ao tenant nexia, e-mail admin@nexia.com sem verificação ou papel master em members não dão master
ok 3 - C3: MASTER_EMAIL só vale com e-mail verificado
ok 4 - A1: autocommit desligado por padrão, mesmo para master
ok 5 - C4: cabeçalho de agendamento não dá acesso e heal fica bloqueado
ok 6 - C4: aplicação de overrides do Sentinel não grava nada, mesmo com fix malicioso
ok 7 - C4: heal LIGADO (SENTINEL_HEAL_ENABLED=true) não aplica override do LLM nem chama o Deploy Hook
ok 8 - A2: observabilidade exige admin
ok 9 - isolamento de tenant: alice (tenant-a) não lê nem altera tenant-b
ok 10 - operações legítimas continuam funcionando
ok 11 - master via custom claim (operação administrativa) é reconhecido
ok 12 - 1. usuário normal não altera o próprio role
ok 13 - 2. usuário normal não altera tenantSlug nem outros campos de privilégio
ok 14 - 2b. perfil novo não nasce privilegiado nem dentro de um tenant
ok 15 - 3. membro não acessa memória nem dados de outro tenant, nem a memória de colegas
ok 16 - 3b. admin de tenant não altera plano/cobrança do tenant
ok 17 - 4. operações legítimas continuam permitidas
ok 18 - 5. master legítimo mantém acesso e administra papéis
ok 19 - 6. catch-all de tenant não afrouxa subcoleções restritas
ok 20 - 1. cria as 16 entidades com metadados do servidor, ids estáveis e Execution ID
ok 21 - 2. schema Client: inválido é rejeitado no repositório e nada é gravado
ok 22 - 2. schema Project: inválido é rejeitado no repositório e nada é gravado
ok 23 - 2. schema Repository: inválido é rejeitado no repositório e nada é gravado
ok 24 - 2. schema Environment: inválido é rejeitado no repositório e nada é gravado
ok 25 - 2. schema Requirement: inválido é rejeitado no repositório e nada é gravado
ok 26 - 2. schema Decision: inválido é rejeitado no repositório e nada é gravado
ok 27 - 2. schema Task: inválido é rejeitado no repositório e nada é gravado
ok 28 - 2. schema Artifact: inválido é rejeitado no repositório e nada é gravado
ok 29 - 2. schema Conversation: inválido é rejeitado no repositório e nada é gravado
ok 30 - 2. schema Memory: inválido é rejeitado no repositório e nada é gravado
ok 31 - 2. schema Change: inválido é rejeitado no repositório e nada é gravado
ok 32 - 2. schema TestRun: inválido é rejeitado no repositório e nada é gravado
ok 33 - 2. schema Deployment: inválido é rejeitado no repositório e nada é gravado
ok 34 - 2. schema Error: inválido é rejeitado no repositório e nada é gravado
ok 35 - 2. schema Integration: inválido é rejeitado no repositório e nada é gravado
ok 36 - 2. schema ProjectSnapshot: inválido é rejeitado no repositório e nada é gravado
ok 37 - 3. metadados do servidor não podem vir na entrada
ok 38 - 4. contexto: sem contexto válido ou tenant inexistente, nada é gravado
ok 39 - 5. integridade referencial: inexistente, outro tenant, outro projeto, outro cliente, excluído, auto-referência
ok 40 - 6. unicidade por tenant: slug, repositório e ambiente
ok 41 - 7. campos imutáveis não mudam no update
ok 42 - 8. concorrência: expectedVersion obrigatório, conflito detectado, uma vencedora em escrita simultânea
ok 43 - 9. idempotência: repetição devolve o mesmo registro; conteúdo diferente é conflito; simultâneas geram um só
ok 44 - 10. soft-delete: bloqueado por dependentes, oculto de get/list, restaurável, imutável enquanto excluído
ok 45 - 11. auditoria: uma entrada por escrita, com Execution ID, ator, operação, versão e hash, sem valores
ok 46 - 12. Environment rejeita valores de secret (create e update) sem gravar nem ecoar o valor
ok 47 - 13. isolamento entre tenants na camada de acesso
ok 48 - 14. listagem por project_id, client_id e status; filtros não suportados são rejeitados
ok 49 - 15. schemaVersion desconhecido falha fechado na leitura e na escrita
ok 50 - V1. sem login e usuário comum não leem nada do Vault (get e list, 16 coleções)
ok 51 - V2. admin do tenant lê só o próprio tenant
ok 52 - V3. master lê qualquer tenant (perfil ou custom claim)
ok 53 - V4. nenhum cliente grava no Vault, nem master (create, update, delete)
ok 54 - V5. coleções internas (idempotência e unicidade) não são legíveis por ninguém no cliente
ok 55 - V6. a regra do Vault não abre coleções fora do prefixo vault_
# tests 55
# pass 55
# fail 0
```

### Prova de mutação das regras
Regras do Vault alteradas temporariamente para `canReadVault = isAuthenticated() || …` e `allow write: if isAuthenticated()`, depois restauradas (`git diff --stat firestore.rules` igual antes e depois):
```
not ok 1 - V1. sem login e usuário comum não leem nada do Vault (get e list, 16 coleções)
not ok 2 - V2. admin do tenant lê só o próprio tenant
not ok 3 - V3. master lê qualquer tenant (perfil ou custom claim)
not ok 4 - V4. nenhum cliente grava no Vault, nem master (create, update, delete)
ok 5 - V5. coleções internas (idempotência e unicidade) não são legíveis por ninguém no cliente
ok 6 - V6. a regra do Vault não abre coleções fora do prefixo vault_
# pass 2
# fail 4
```
(V5 e V6 continuam passando porque a mutação não mexeu na exclusão das coleções internas nem no prefixo.)

### Typecheck, build, Playwright, secret scan
```
$ npm run typecheck
> tsc --noEmit -p .
(sem erros)

$ npm run build
✓ built in 2.85s

$ BASE_URL=http://127.0.0.1:3457 npm run test:e2e
  48 passed (19.2s)

$ BASE_URL=http://127.0.0.1:3457 npm run test:e2e:readdy
  20 failed
  2 skipped
  67 passed (2.5m)
READDY original: 89 testes, 67 passaram, 20 falharam, 2 pulados, 22 conhecidos.
Sem regressões em relação ao develop.

$ gitleaks dir . --config .gitleaks.toml --redact
INF no leaks found
```
As 20 falhas e 2 pulados da suíte READDY são exatamente as já registradas em `tests/e2e/readdy-known-failures.json` (idênticas ao develop).

## TEMPORÁRIO / limitações declaradas

| Item | Motivo | Risco | Remoção |
|---|---|---|---|
| Vault não é chamado por nenhuma rota | Endpoints `/api/nexia/*` estão fora do escopo da Fase 2 | Nenhum (código inerte em produção) | Fase 3+ (quando autorizada) |
| Só `schemaVersion` 1; outra versão → `SCHEMA_VERSION` | Não existe migração ainda | Documento gravado por código futuro fica ilegível para este código (falha fechada) | Na primeira mudança de schema, com migração registrada |
| Registros de `vault_idempotency` não expiram | TTL do Firestore é configuração de produção (fora do escopo) | Crescimento da coleção | Fase de operação: política TTL em `created_at` |
| Sem rotina de backup/export do Vault (§25) | Exige ação no projeto de produção | Perda de dados sem PITR/export | Ação do dono / fase de infraestrutura |
| Índices `vault_*` não implantados | Sem deploy nesta fase | Em produção, `list()` e `history()` falham até os índices existirem | Junto da publicação das regras |
| Verificação de dependentes com igualdade usa merge de índices simples | O emulador não exige índices; não dá para provar localmente | Se o Firestore exigir índice composto, o soft-delete devolve erro (falha fechada, não exclui) | Validar ao publicar índices |
| Playwright local usou `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium` | O contêiner desta sessão não tem a versão de navegador do `@playwright/test`; o CI instala a sua | Nenhum no código | Não se aplica ao CI |

Nenhum mock, fallback ou bypass foi introduzido no código do Vault. O caminho de inicialização sem credencial do Firebase Admin é o da Fase 1 (só com os dois emuladores configurados e `NODE_ENV != production`).

## Não testado
- Comportamento em produção (regras e índices não publicados; nenhum acesso ao `nexia-c8710`).
- Carga e custo de leituras (cada escrita lê tenant, referências, unicidade e, no soft-delete, até 14 consultas de dependentes).
- Detecção de formatos de secret fora da lista do `detectSecret` com baixa entropia (ver `SECURITY-AUDIT.md`).

## Fora de escopo (não implementado, nenhuma pasta criada)
Endpoints `/api/nexia/*`, UI, onboarding, Project Resolver, Context Engine, Model Router, SDK, Tool Gateway, Policy Engine, Bridge, GitHub App, adapters, Orchestrator, agentes e migração de dados antigos (`cortex_memory` etc. continuam como estão; `Conversation.external_ref` só prevê a referência).

## Pendências do dono
- Apagar a branch `backup/pre-nexia-ai` (o proxy desta sessão recusou o push de exclusão de novo; a tag `pre-nexia-ai` cobre o backup): `git push origin --delete backup/pre-nexia-ai`.
- Continuam valendo as da Fase 1: rotação de secrets, restrição da chave web + App Check, restaurar masters antes de publicar regras, decisão sobre `NEXIA-OS` e reescrita de histórico.
- Ao publicar regras e índices: incluir os `vault_*` deste PR.
