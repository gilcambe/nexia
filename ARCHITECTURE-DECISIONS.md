# ARCHITECTURE-DECISIONS.md — Registro de decisões (NEXIA AI)

Cada decisão tem status: **ACEITA** (em vigor neste branch), **PROPOSTA** (aguardando aprovação do dono) ou **PENDENTE** (fase futura). As decisões D1–D8 vêm do `MIGRATION-PLAN.md` da auditoria de 02/10/2026.

## Decisões de base (MIGRATION-PLAN §1)

| # | Decisão | Status |
|---|---|---|
| D1 | Repositório canônico = `gilcambe/nexia`, branch `develop` | **ACEITA** na Fase 1 (o PR da Fase 1 é aberto contra `develop`) |
| D2 | Acesso ao repositório de produção `NEXIA_OS`/`NEXIA-OS` | PENDENTE (não acessível a esta sessão) |
| D3 | Vault no Firestore `nexia-c8710`, coleções `vault_*` | **ACEITA** na Fase 2 (ADR-F2-01) |
| D4 | Código novo em `nexia-ai/`, rotas `/api/nexia/*` | **ACEITA**: `nexia-ai/vault/` (Fase 2); `nexia-ai/api/` e `nexia-ai/onboarding/` com rotas `/api/nexia/*` (Fase 3) |
| D5 | NEXIA Bridge como servidor MCP local | PROPOSTA (Fase 7) |
| D6 | SDK oficial da Anthropic atrás de `ModelProvider` | PROPOSTA (Fase 5) |
| D7 | GitHub Actions no repo canônico | **ACEITA** (CI mínimo nesta fase) |
| D8 | GitHub App / token fine-grained em vez de `GITHUB_TOKEN` clássico | PROPOSTA (Fase 8) |

## ADR-F1-01 — Estáticos servidos só de raízes públicas explícitas (C1)
- **Status:** ACEITA.
- **Contexto:** `server.js` juntava o caminho da URL com a raiz do repositório e servia qualquer arquivo (código, `.env`, arquivos do sistema).
- **Decisão:** novo módulo `lib/safe-static.js`. O caminho é decodificado uma vez, rejeitado se tiver `%2f`/`%5c`, `\`, byte nulo, codificação dupla ou segmento iniciado por ponto; depois é resolvido com `path.resolve` e `realpath` (symlinks inclusos) e precisa ficar **dentro** da raiz. Raízes permitidas: `out/` e as pastas legadas `core`, `ces`, `bezsan`, `splash`, `viajante-pro`. Extensões em allowlist. Só `GET`/`HEAD`. Caminho com extensão que não resolve → 404 (sem fallback para a raiz do repo); rotas sem extensão e `.html` inexistente → `out/index.html` (SPA), mantendo o comportamento anterior para links legados como `/nexia/observability.html` sem servir o arquivo pedido.
- **Consequência:** arquivos na raiz do repositório deixam de ser públicos. Todas as páginas legadas continuam servidas (cobertas pelos testes Playwright).

## ADR-F1-02 — Fonte do papel `master` (C2, C3, A3)
- **Status:** ACEITA.
- **Decisão:** papel global vem, nesta ordem, de custom claim `role` (só o Admin SDK define), de `users/{uid}.role` (que o próprio usuário não pode mais alterar, ver ADR-F1-03) ou de `MASTER_EMAIL` **configurado explicitamente e com `email_verified == true`**. Removidos: o padrão `admin@nexia.com`, a promoção por pertencer ao tenant `nexia`, o "auto-reparo" guest → nexia e o modo demo (qualquer token virava master sem Firebase Admin). Sem Firestore, a validação de tenant falha fechada. Papel vindo de `tenants/{t}/members` é limitado a `user|member|manager|admin`.
- **Consequência:** masters legítimos que dependiam das promoções automáticas precisam de custom claim ou de `users/{uid}.role = 'master'` gravado pelo console/Admin SDK (procedimento em `PHASE-1-REPORT.md`, não executado).

## ADR-F1-03 — Regras do Firestore versionadas e endurecidas (C2, M2)
- **Status:** ACEITA no repositório. **Não publicada** no projeto Firebase (publicação é manual e separada; esta fase não faz deploy).
- **Decisão:** `firestore.rules`, `storage.rules`, `firestore.indexes.json` trazidos do `READDY`; `firebase.json` novo, só com firestore/storage/emulators (sem hosting). Nas regras: o usuário não altera `role`, `tenantSlug`, `tenant`, `plan`, `email`, `uid`, `permissions`, `isAdmin`, `isMaster`, `customClaims`, `claims`; perfil novo só nasce como `role: 'user'`, `tenantSlug: 'guest'`; tenant só é criado/apagado por master e admins do tenant não alteram campos de cobrança/estado; `cortex_memory` só é acessível pelo dono da conversa (id começa com o `uid`); o catch-all do tenant não se aplica mais às subcoleções com regra própria (regras do Firestore combinam permissões por OU, então o catch-all anulava as restrições).
- **Consequência:** `core/auth.js` passou a criar perfis como `guest` e não grava mais `members` pelo cliente; entrada em tenant é feita pelo servidor (`tenant-admin`).

## ADR-F1-04 — Automação com credencial de administrador desligada por padrão (C4, A1)
- **Status:** ACEITA.
- **Decisão:** Sentinel: removido o bypass pelo cabeçalho `x-netlify-event`; `POST` exige token com papel admin; modo `heal` responde 403 salvo `SENTINEL_HEAL_ENABLED=true`, e mesmo ligado **não** aplica overrides do LLM em coleção alguma nem dispara redeploy; grava só o relatório em `sentinel_heals` e `system_status/last_heal`. Removidos o auto-heal do scan, `isScheduled` e o "modo demo" (GET sem DB → 503). `autocommit`: 403 salvo `AUTOCOMMIT_ENABLED=true`; quando ligado exige master, branch explícito e não protegido (`main`, `master`, `develop`, `production`, `prod`, `staging`), caminho validado por regex sem `..` nem dotfiles, e grava trilha em `audit_log_global`.
- **Consequência:** o substituto definitivo é o GitHub Adapter com branch + PR (Fase 8).

## ADR-F1-05 — Erros sem detalhe interno para o cliente (A5)
- **Status:** ACEITA.
- **Decisão:** `lib/safe-error.js` gera um `correlationId`; o detalhe vai só para o log do servidor e o cliente recebe `{ error, correlationId }`. Aplicado em `server.js`, `cortex-chat` (inclusive nas mensagens de stream dos provedores), `cortex-agent`, `autocommit` e Sentinel.

## ADR-F1-06 — Estratégia de testes
- **Status:** ACEITA.
- **Decisão:** `node:test` para unitários (`npm test`); Firebase Emulator (auth + firestore) com `@firebase/rules-unit-testing` para regras e autorização da API (`npm run test:rules`); Playwright com `BASE_URL` **obrigatório** e sem padrão de produção: regressão nova (`npm run test:e2e`) e a suíte original do READDY sem alteração nos testes (`npm run test:e2e:readdy`), com checagem de paridade contra a lista de falhas já existentes no develop (`tests/e2e/readdy-known-failures.json`). O caminho de inicialização do Firebase Admin sem credencial só é usado quando os dois emuladores estão configurados e `NODE_ENV != production`.

## ADR-F1-07 — CI mínimo sem deploy
- **Status:** ACEITA.
- **Decisão:** `.github/workflows/ci.yml` com `permissions: contents: read`: varredura de secrets (gitleaks 8.24.3 com checksum verificado, árvore atual e commits novos do PR), `npm ci`, typecheck, unitários, emulador, build e Playwright contra servidor local. Nenhum passo de deploy.

## ADR-F1-08 — Varredura de secrets e chave web pública do Firebase
- **Status:** ACEITA.
- **Decisão:** `.gitleaks.toml` estende as regras padrão e acrescenta Mercado Pago, service account (JSON e base64) e arquivos `.env`. A config web do Firebase embutida em três páginas legadas é pública por natureza e foi liberada **só** nas regras de chave GCP/genérica e **só** nesses três arquivos (em qualquer outro arquivo continua detectada). A proteção real dela é restrição por referrer no Google Cloud + App Check (ação do dono).

## ADR-F1-09 — Histórico do Git não é reescrito nesta fase
- **Status:** ACEITA.
- **Decisão:** secrets foram removidos do HEAD; o histórico continua contendo valores antigos. Reescrever (`git filter-repo`/BFG) exige autorização explícita. A mitigação é a rotação das credenciais pelo dono.

## ADR-F1-10 — Dependências sem saltos de versão maior
- **Status:** ACEITA.
- **Decisão:** `npm audit fix` sem `--force`, mais `express` 4.22.3 (patch dentro da faixa declarada) para corrigir `qs`. O que só se corrige com versão maior (`firebase-admin` 14, `vite` 6+, `firebase` cliente, `react-router-dom` 7) fica para uma fase própria, com teste de regressão.

## ADR-F2-01 — Vault no Firestore existente, coleções `vault_*` de primeiro nível (D3)
- **Status:** ACEITA.
- **Decisão:** 16 coleções de domínio (`vault_clients`, `vault_projects`, `vault_repositories`, `vault_environments`, `vault_requirements`, `vault_decisions`, `vault_tasks`, `vault_artifacts`, `vault_conversations`, `vault_memories`, `vault_changes`, `vault_test_runs`, `vault_deployments`, `vault_errors`, `vault_integrations`, `vault_project_snapshots`) e 3 internas (`vault_audit`, `vault_idempotency`, `vault_unique`). Coleções de primeiro nível, não subcoleções de `tenants/{slug}`, para que as consultas por `project_id`/`client_id`/`status` sejam diretas e as regras fiquem num único `match`. Isolamento por `tenant_id` em todo documento.
- **Consequência:** nenhum banco paralelo; mesma conta, mesmas regras versionadas, mesmo emulador. Nada no código legado foi alterado; o módulo ainda não é chamado por rota alguma.

## ADR-F2-02 — Tenancy do Vault = tenant SaaS existente
- **Status:** ACEITA.
- **Decisão:** `tenant_id` é o slug de `tenants/{slug}`. Toda escrita confirma, dentro da transação, que o tenant existe. Leitura, atualização e exclusão de registro de outro tenant respondem `NOT_FOUND` (sem revelar existência). Entidade `Client` é o cliente do dono do tenant (spec §5), não o tenant.

## ADR-F2-03 — Camada de acesso única (`nexia-ai/vault/repository.js`)
- **Status:** ACEITA.
- **Decisão:** `createVault({ db })` devolve um repositório por entidade com `create`, `get`, `list`, `update`, `softDelete`, `restore`, `history`. Toda escrita roda numa transação do Firestore que faz, nesta ordem: confere tenant, idempotência, unicidade e referências (leituras), depois grava documento, reservas de unicidade, idempotência e auditoria (escritas). Regras:
  - IDs `{prefixo}_{32 hex}` gerados pelo servidor; id do documento = campo `id`.
  - Metadados (`id`, `tenant_id`, `schemaVersion`, `version`, `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`, `last_execution_id`) só pelo servidor; enviados pelo chamador → `VALIDATION unknownField`.
  - Timestamps com `FieldValue.serverTimestamp()`; leitura devolve ISO 8601.
  - Concorrência otimista: `version` (inteiro, também é o etag) começa em 1; `update`/`softDelete`/`restore` exigem `expectedVersion`; divergência → `VERSION_CONFLICT`. A transação do Firestore garante que, em escritas simultâneas com a mesma versão esperada, só uma vence.
  - Integridade referencial na escrita (inclusive `restore`): alvo existe, mesmo tenant, não excluído; mesmo projeto quando o alvo pertence a um projeto; projeto do mesmo cliente quando há `client_id` e `project_id`; auto-referência proibida.
  - Soft-delete por `deleted_at`; bloqueado (`HAS_DEPENDENTS`) se existir registro ativo apontando para o alvo (mapa derivado dos campos `ref` dos schemas, inclusive arrays via `array-contains`). Não há exclusão física.
  - Unicidade por tenant (`slug` de Client e Project; `provider+owner+repo`; `project_id+name` de Environment) com documentos em `vault_unique` cujo id é hash. A reserva continua após soft-delete (a identidade não é reaproveitada).
  - `schemaVersion` diferente do suportado → `SCHEMA_VERSION` (falha fechada; não há migração na v1).
  - Listagem: só ativos, `updated_at` desc, no máximo um filtro (`client_id`, `project_id` ou `status`), `limit` 1–200.

## ADR-F2-04 — Idempotência de eventos
- **Status:** ACEITA.
- **Decisão:** `create(ctx, data, { idempotencyKey })`. Chave `[A-Za-z0-9_.:-]{8,128}`, escopo tenant + entidade, guardada só como hash (`vault_idempotency/{sha256}`) junto do hash canônico do conteúdo validado. Mesma chave e mesmo conteúdo → devolve o registro existente com `replayed: true`, sem nova escrita nem auditoria. Mesma chave e conteúdo diferente → `IDEMPOTENCY_CONFLICT`. Atualizações não usam chave: `expectedVersion` já torna a repetição segura (a segunda tentativa recebe `VERSION_CONFLICT`).

## ADR-F2-05 — Execution ID e auditoria
- **Status:** ACEITA.
- **Decisão:** `createExecutionContext({ tenantId, actor, executionId? })` gera `exec_{32 hex}` (ou valida um recebido, para propagar entre chamadas). Toda escrita grava `last_execution_id` no documento e uma entrada em `vault_audit` na mesma transação, com: `tenant_id`, `execution_id`, `actor {type,id}`, `operation` (`create|update|soft_delete|restore`), `entity`, `entity_id`, `version`, `content_hash` (SHA-256 do JSON canônico dos campos de domínio), `changed_fields` (só nomes), `at` (servidor), `entity_schema_version`, `schemaVersion`. Nenhum valor de campo vai para a auditoria nem para mensagens de erro.

## ADR-F2-06 — Secrets fora do Vault (spec §15)
- **Status:** ACEITA.
- **Decisão:** `Environment.secret_refs` e `Integration.secret_refs` só aceitam `{ name (formato de variável de ambiente), store (enum), ref (caminho no secret store), description }`; não existe campo para valor. Todo texto de qualquer entidade passa por `detectSecret` (PEM, service account, JWT, AWS, GitHub, GitLab, Groq, OpenAI/Anthropic, Stripe, Slack, Google API/OAuth, Mercado Pago, npm, URL com credencial, hex ≥ 40, atribuição `password=`/`token:` e alta entropia). Suspeita → `SECRET_DETECTED` com caminho e nome do detector, nunca o valor. Campos `sha` e `ref` são validados por formato e não passam pelo detector.
- **Consequência:** falso positivo possível em texto com hash longo ou token aleatório legítimo; o chamador precisa reescrever o texto (risco aceito: preferimos rejeitar a gravar um secret).

## ADR-F2-07 — Regras `vault_*`
- **Status:** ACEITA no repositório. **Não publicada.**
- **Decisão:** um `match /{vaultCollection}/{vaultDocId}` com `vaultCollection.matches('^vault_.+')`: escrita sempre negada a clientes (só o Admin SDK grava); leitura para master (custom claim `role == 'master'` ou `users/{uid}.role == 'master'`) em qualquer tenant e para admin do tenant (`users/{uid}.role == 'admin'` e `tenantSlug == tenant_id`) só no próprio tenant; usuário comum, `manager` e anônimo não leem; `vault_idempotency` e `vault_unique` ilegíveis no cliente.

## ADR-F2-08 — Índices e documentação gerados dos schemas
- **Status:** ACEITA.
- **Decisão:** `nexia-ai/vault/indexes.js --write` mantém os 49 índices `vault_*` em `firestore.indexes.json` (listagens, dependentes por `array-contains`, histórico de auditoria) sem tocar nos índices legados; `nexia-ai/vault/schema-doc.js --write` gera `VAULT-SCHEMAS.md`. Testes unitários falham se os arquivos divergirem dos schemas.

## ADR-F3-01 — Execução autônoma das Fases 3–11
- **Status:** ACEITA (instrução do dono em 02/10/2026: "assuma o controle e vá enviando os próximos passos até finalizar, sem pedir permissão").
- **Decisão:** cada fase segue com branch própria, PR contra `develop`, CI verde, relatório e merge, sem nova aprovação entre fases. Continuam exigindo a palavra do dono: deploy de produção, publicação de regras/índices do Firestore, uso ou rotação de credenciais reais, reescrita de histórico e qualquer ação irreversível. Quando uma fase depende disso, o restante é entregue e a pendência fica registrada no relatório da fase.

## ADR-F3-02 — `/api/nexia/*` como um handler único carregado pelo `server.js`
- **Status:** ACEITA.
- **Decisão:** `nexia-ai/api/index.js` exporta `handler(event)` no mesmo formato das funções legadas. O `server.js` recebeu só a rota `/api/nexia` → `nexia-api` e o `require` do módulo (4 linhas). Recursos: `clients`, `projects`, `repos`, `environments` (listar, criar, ler, `PATCH`, `DELETE` = soft-delete, `restore`, `history`), `projects/{id}/onboard`, `projects/{id}/snapshot` e `me`.
- **HTTP:** `ETag: "v{version}"`; `PATCH`/`DELETE`/`restore` exigem `If-Match` (428 sem, 412 em conflito); `Idempotency-Key` no `POST`; `X-Execution-Id` em toda escrita. Códigos: 400 validação, 422 secret/referência, 409 único/dependentes/excluído/idempotência, 404 não encontrado (inclusive outro tenant).
- **Autorização:** igual às regras `vault_*`: master em qualquer tenant (`?tenant=` ou `X-Tenant-Id`); admin só no próprio tenant; demais papéis 403.
- **Limitação:** o preflight CORS do `server.js` (legado) não lista `PATCH`, `If-Match` nem `Idempotency-Key`. A SPA é servida pela mesma origem, então não há preflight; um cliente de outra origem precisaria desse ajuste no `server.js` (registrado como pendência, não alterado para não mexer no legado).

## ADR-F3-03 — Onboarding somente leitura (spec §20, autonomia 0)
- **Status:** ACEITA.
- **Decisão:** `nexia-ai/onboarding/` lê o repositório pela API do GitHub (público sem token; privado com o `GITHUB_TOKEN` já existente no servidor, nenhuma credencial nova) e detecta pelos arquivos: stack e frameworks (`package.json`), comandos (`scripts`), Node (`engines`), Firebase (`firebase.json`, `.firebaserc` ou config web pública embutida, ignorando valores de exemplo), Cloudflare (`wrangler.*`), hosting (`render.yaml`, `netlify.toml`, `vercel.json`), CI (`.github/workflows`), documentação (`*.md` da raiz e `docs/`) e nomes de variáveis (`.env.example`). Cada conclusão traz a evidência (arquivo).
- Grava no Vault: Repository (se ainda não existir), Environments detectados que ainda não existem (nunca altera existentes; `secret_refs` só com nomes), um Artifact por documento (idempotente por caminho), um ProjectSnapshot novo a cada execução (com último deploy, erros abertos, tarefas abertas e decisões aceitas do Vault) e `primary_repository_id` se vazio.
- Não executa nada do repositório: smoke tests (passo 12) ficam `not_run` até existir execução (Bridge/CI por projeto). Workspace local (passo 4) é campo do Project, editável pela API.
- A fonte local (`createLocalSource`) usa só arquivos versionados (`git ls-files`), não segue symlink, não sai da raiz e nunca lê `.env*`, chaves ou JSON de service account.
