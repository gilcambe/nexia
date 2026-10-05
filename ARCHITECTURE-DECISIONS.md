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

## ADR-F4-01 — Project Resolver em 8 camadas com pontuação combinada
- **Status:** ACEITA.
- **Decisão:** `nexia-ai/project-resolver` pontua cada projeto ativo do tenant por camada (spec §5): 1 seleção na UI (1,0); 2 nome/slug do projeto na mensagem (0,9); 3 alias do projeto (0,8) ou cliente mencionado (0,85 se o cliente tem um só projeto ativo, 0,5 cada se tem vários); 4 repositório `owner/repo` (0,95) ou pasta dentro do `workspace.local_path` (0,9); 5 projeto da conversa (0,6); 6 histórico recente (0,4 decaindo); 7 busca no Vault (até 0,45, só quando nenhuma camada 1–4 casou); combinação "ou ruidoso" `1 − Π(1 − s)`. 8: abaixo de 0,7, ou com diferença menor que 0,15 para o segundo, devolve `needs_confirmation` e uma pergunta com os candidatos. Saída `ProjectContext { project_id, client_id, confidence, rationale[{layer, field, score}], candidates, needs_confirmation, question }`; a justificativa cita camada e campo, nunca conteúdo sensível. Comparação de nomes por palavras inteiras, sem acento e sem caixa.
- **TEMPORÁRIO:** a camada 7 é lexical (sobreposição de palavras), não semântica com embeddings. Motivo: não há provedor de embeddings configurado (Model Router é a Fase 5). Risco: perde sinônimos. Remoção: quando houver embeddings no Model Router.

## ADR-F4-02 — Context Engine com orçamento e referências
- **Status:** ACEITA.
- **Decisão:** `nexia-ai/context-engine` monta o contexto por camadas da spec (identidade, fatos, decisões, estado, preferências, histórico, derivado), com limite por camada, ordenação por relevância com a mensagem e recência, e orçamento em tokens estimados (4 caracteres por token; padrão 1200). Identidade sempre entra; o resto entra por prioridade até o limite e o que sobra fica listado em `dropped`. Cada item leva o id do registro (`[prj_…]`) para ser verificável. Só entram memórias `approved` e não expiradas. Documentos entram só por título e caminho.

## ADR-F4-03 — Integração com o `cortex-chat` sem mudar o fluxo sem projeto
- **Status:** ACEITA.
- **Decisão:** `nexia-ai/cortex.resolveForChat` roda antes de montar o system prompt. Só atua para master ou admin do próprio tenant (mesmo critério das regras `vault_*`), com `tenantId` explícito no corpo, tenant existente e ao menos um projeto no Vault. Resultado: `context` (acrescenta a seção "CONTEXTO DO PROJETO" ao system prompt e informa `project` no evento final do stream), `ask` (responde só a pergunta de desambiguação, sem chamar modelo, quando houve menção explícita: camadas 1–4) ou `none` (fluxo anterior intacto). O projeto resolvido fica lembrado por conversa em `nexia_chat_state` (fora de `vault_*`; sem regra própria, o default-deny das regras bloqueia clientes).
- **TEMPORÁRIO:** se o resolver falhar (ex.: Firestore indisponível), o chat segue sem contexto (fail-open para o fluxo legado), com aviso no log. Motivo: o chat é o produto atual e não pode cair por uma camada nova. Risco: resposta sem contexto do projeto. Remoção: Fase 10 (Orchestrator decide se pode prosseguir sem contexto).
- Novos endpoints: `POST /api/nexia/resolve` e `GET /api/nexia/projects/{id}/context?message=&budget=` (mesma autorização da Fase 3).

## ADR-F5-01 — Model Router com interface `ModelProvider` e SDK oficial no Claude
- **Status:** ACEITA.
- **Decisão:** `nexia-ai/model-router` é o único ponto de chamada a modelos para `cortex-chat` e `multi-model-engine`. Cada provedor implementa `ModelProvider { id, envKey, available(), capabilities(model), chat(model, req), stream?(model, req) }`; o router expõe `chat`, `stream`, `toolCall`, `structuredOutput` (ferramenta forçada quando o provedor tem tool_call; JSON validado contra o schema quando não tem), `capabilities`, `costEstimate`, `chatWithFallback` e `streamWithFallback`. Adapters: Anthropic com `@anthropic-ai/sdk` 0.131.0 (versão fixa; `chat` também usa `messages.stream().finalMessage()`, porque o SDK recusa chamada não streaming com `max_tokens` alto), um adapter único para os 12 provedores compatíveis com OpenAI Chat Completions, Gemini (chave no header `x-goog-api-key`, não mais na URL) e Cohere (sem streaming nativo; o router entrega o texto em um trecho).
- Os catálogos continuam com os chamadores (`AI_CATALOG` com 52 modelos e `MODELS` com 13, iguais ao develop em `e44d09d`); o router recebe `{ provider, model }`. Nenhum modelo removido (teste M9).
- `max_tokens` é limitado ao teto de cada modelo/provedor. Antes, o chat pedia até 100000 tokens e o Claude, o GPT-4o e outros respondiam 400, caindo sempre no fallback.
- **TEMPORÁRIO:** tetos de saída por provedor (não por modelo) nos adapters compatíveis com OpenAI, e tabela de preço estática e parcial em `pricing.js` (modelos fora dela devolvem `known: false`, nunca custo zero). Motivo: o custo medido por execução é da Fase 11. Risco: teto conservador cortar resposta longa; preço desatualizado. Remoção: Fase 11.

## ADR-F5-02 — Streaming real pelo `server.js` e resumos da memória preservados
- **Status:** ACEITA.
- **Decisão:** um handler pode devolver `{ statusCode, headers, stream }`; `server.js` (4 linhas) entrega a `lib/stream-response.writeStream`, que escreve cada trecho em `res` assim que ele chega, respeita backpressure e encerra o iterador quando o cliente desconecta (o que cancela a chamada ao provedor). O `cortex-chat` com `stream: true` passou a devolver esse `stream`: antes, os tokens eram acumulados num array e enviados de uma vez no fim. A troca de provedor continua só antes do primeiro token (mesma ordem de fallback); um erro depois do primeiro token encerra a resposta com aviso, sem misturar dois modelos.
- As mensagens com `role: "system"` no histórico (os resumos "MEMÓRIA COMPRIMIDA" do `cortex-memory`) passam a ser incorporadas ao system prompt por `normalizeRequest`. Antes, o caminho Anthropic filtrava `role: "system"` e os resumos sumiam.
- As funções `stream*`, `callFreeProvider`, `getStream` e o corpo antigo de `callSync` do `cortex-chat`, e `callModelAnthropic`/corpo antigo de `callModel` do `multi-model-engine`, foram substituídos pelos adapters (mesmos endpoints). `callSync` e `callModel` mantêm a assinatura.
- Mudanças de comportamento: as temperaturas fixas por provedor do `callSync` antigo (0,3 Groq, 0,1 DeepSeek) não são mais enviadas; vale o padrão do provedor. `multi-model-engine` mantém 4096/2000 tokens e temperatura 0,7 fora do Anthropic. `action: "list"` ganhou `details` com as capacidades de cada modelo (campo novo; `models` igual).

## ADR-F5-03 — Chamadas diretas a provedores fora do escopo desta fase
- **Status:** SUPERADA pela ADR-F10-05 (Fase 10: as funções passaram a usar o Model Router).
- **Decisão:** `architect`, `autodev-engine`, `sentinel`, `dynamic-pricing`, `ai-sales-agent`, `takedown-gen` e o resumo do `cortex-memory` (Groq direto) ainda chamam provedores diretamente. O plano da Fase 5 cita só `cortex-chat` e `multi-model-engine`; os demais migram quando virarem agentes do Orchestrator (Fase 10), para não mexer em 6 funções legadas sem teste próprio.

## ADR-F6-01 — Policy Engine: risco declarado × autonomia do projeto × ambiente
- **Status:** ACEITA.
- **Decisão:** `nexia-ai/policy-engine.decide` devolve `auto`, `confirm` ou `forbidden`. Padrão: LOW automático; MEDIUM automático a partir da autonomia 1; HIGH a partir da 3; cada ferramenta pode declarar `min_autonomy` próprio (ex.: criar branch = 2); CRITICAL sempre pede confirmação humana; em `production` tudo acima de LOW pede confirmação, em qualquer autonomia; ferramenta desconhecida ou sem risco é proibida.
- A `ToolPolicy` do projeto (nova entidade do Vault) tem regras `{ tool, environment?, decision }` com curingas (`github.*`, `*`). `forbidden` em qualquer regra que case ganha de todas; depois vale a regra mais específica. Regra `auto` só libera até HIGH e fora de produção: CRITICAL e produção nunca ficam automáticos por regra.
- Nível 5 da spec ("produção automática para projetos autorizados") **não** é implementado: produção continua exigindo pessoa (decisão do dono e plano da Fase 11).

## ADR-F6-02 — Tool Gateway com registro no Vault e fila de aprovação
- **Status:** ACEITA.
- **Decisão:** `nexia-ai/tool-gateway.createGateway` é o único caminho para executar ferramentas. Cada chamada vira um `ToolCall` no Vault (`vault_tool_calls`), com risco, decisão, motivo, ator, Execution ID, resumo da entrada definido pela ferramenta, SHA-256 da entrada, resumo da saída, código de erro e duração. Sequências hex longas são encurtadas nos resumos. A entrada completa de uma chamada pendente fica em `nexia_tool_queue` (só servidor; o default-deny das regras bloqueia clientes) e é apagada ao aprovar, rejeitar ou expirar (24 h).
- Aprovar exige ator `user` (agente não aprova) e `If-Match` com a versão do registro, o que impede execução dupla. Na aprovação a política é reavaliada: se o projeto passou a proibir a ferramenta, a chamada é rejeitada (`POLICY_FORBIDDEN`) sem executar.
- Ferramentas iniciais, todas LOW e restritas ao projeto da chamada: `vault.get`, `vault.list`, `vault.history`, `vault.context`, `github.get_repo`, `github.get_checks`. As do GitHub só alcançam repositórios cadastrados para o projeto (owner/repo nunca vêm da entrada). A entrada é validada contra o `input_schema`, sem campos extras.
- API: `GET /api/nexia/tools`, `POST /api/nexia/tools/invoke` (200 executada, 202 pendente, 403 negada, 422 falhou; aceita `Idempotency-Key`), `GET /api/nexia/approvals`, `POST /api/nexia/approvals/{id}/approve|reject` (com `If-Match`), `GET /api/nexia/tool-calls?project_id=` (só leitura) e CRUD de `tool-policies`. Painel: página `/aprovacoes` (link em `/projetos`).
- **TEMPORÁRIO:** `ToolCall` referencia o projeto, então um projeto com chamadas registradas não pode ser removido (soft-delete bloqueado por dependentes). Motivo: o log de ferramentas é auditoria e não deve sumir com o projeto. Risco: projeto arquivado continua "vivo" para o Vault. Remoção: política de retenção do log (Fase 11).

## ADR-F6-03 — Permissão `checks: read` no CI
- **Status:** ACEITA.
- **Decisão:** o workflow passa a pedir `checks: read` (além de `contents: read`) para o teste G10 ler os checks de `gilcambe/nexia` com o token efêmero do Actions. Continua sem nenhuma permissão de escrita.

## ADR-F7-01 — NEXIA Bridge como servidor MCP local por stdio, sem dependências
- **Status:** ACEITA.
- **Decisão:** `nexia-bridge/` é um servidor MCP (JSON-RPC 2.0 por stdio) que roda na máquina do usuário e é iniciado pelo próprio cliente (Claude Code ou Claude Desktop). Não abre porta, não recebe conexão de rede e não guarda credencial. Implementado só com o Node (sem SDK MCP), para não colocar dependência nova numa ferramenta que lê arquivos locais; suporta `initialize`, `tools/list`, `tools/call`, `ping` e `elicitation/create`.
- Ferramentas (nomes com `_` porque nomes de ferramenta MCP no Claude não aceitam `.`): `bridge_projects`, `workspace_list/read/write/delete`, `terminal_run`, `git_status/diff/commit`. Equivalem a `workspace.*`, `terminal.run` e `git.*` da spec §13.
- Cada projeto declara `project_id` do Vault, `roots` absolutos e `mode`. A configuração recusa raiz de disco, a pasta do usuário ou qualquer ancestral dela, caminho relativo e `stateDir` dentro de um workspace.

## ADR-F7-02 — Modos e confirmação humana fora do alcance do modelo
- **Status:** ACEITA.
- **Decisão:** três modos (spec §8): `read-only` (só leitura), `write-confirm` (escrita, apagar, comandos que alteram arquivos e perigosos pedem pessoa; testes rodam) e `autonomous` (escrita de arquivo e commit diretos; apagar, comandos que alteram arquivos e perigosos ainda pedem pessoa). Comandos de deploy/publicação, privilégio, disco, rede remota e o próprio Bridge são negados em qualquer modo; deploy passa pelo pipeline (Fase 9) e pelas aprovações (Fase 6/11).
- Confirmação: por `elicitation/create` quando o cliente suporta (a resposta vem da pessoa, não do modelo); senão, pedido pendente com código de uso único de 8 caracteres mostrado só no stderr do Bridge e aprovado com `nexia-bridge approve <id> <código>`. O pedido é amarrado ao hash da operação (mesma ferramenta, projeto e argumentos), vale 15 minutos e uma vez; código errado cancela.
- Comandos rodam sem shell (`spawn` com lista de argumentos), com ambiente sem variáveis com nome de segredo (salvo `passEnv`), `cwd` preso ao workspace, saída limitada a 64 KB e redigida.
- **TEMPORÁRIO:** pedidos pendentes ficam em memória; se o Bridge reiniciar, o pedido some e é preciso pedir de novo. Motivo: evitar arquivo com o hash do código em disco. Risco: só incômodo (nenhuma operação é executada sem aprovação). Remoção: Fase 10, quando a aprovação local passar a usar a fila de aprovações do Tool Gateway.
- **TEMPORÁRIO:** no Windows, `npm`/`npx`/`pnpm`/`yarn` são atalhos `.cmd` e só rodam com `shell: true`; nesses quatro, qualquer argumento com metacaractere do `cmd.exe` é recusado. Motivo: limitação do Node no Windows. Risco: um metacaractere não previsto. Remoção: quando o Bridge resolver o caminho do `.js` do npm e chamar o Node direto (Fase 10).

## ADR-F7-03 — Registro local; sincronização com o Vault fica para depois
- **Status:** ACEITA.
- **Decisão:** cada chamada vira uma linha em `<stateDir>/bridge-log.jsonl` com data, agente (nome do cliente MCP), ferramenta, projeto, caminho ou comando redigido, pasta, decisão, resultado, código de erro e duração. Nunca conteúdo de arquivo nem saída de comando.
- **TEMPORÁRIO:** o log fica só na máquina do usuário. Motivo: enviar ao Vault exige credencial do Bridge para a API, que não existe ainda. Risco: auditoria central não vê operações locais. Remoção: ~~Fase 10~~ Fase 11 (adiado na Fase 10: o Orchestrator registra as próprias execuções, mas o envio do log do Bridge exige credencial do Bridge para a API, que entra com o piloto na máquina do dono).

## ADR-F8-01 — GitHub Adapter com GitHub App e tokens de instalação por operação
- **Status:** ACEITA.
- **Decisão:** `nexia-ai/github-adapter` é o único caminho do NEXIA para o GitHub (leitura e escrita), usado pelas ferramentas `github.*` do Tool Gateway. Escrita exige GitHub App (`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, opcional `GITHUB_APP_INSTALLATION_ID`): o servidor assina um JWT RS256 de 9 min e troca por um token de instalação de 1 h restrito ao repositório da chamada e às permissões da operação (ex.: `contents: write` só para branch/commit; `pull_requests: write` só para PR). Tokens ficam em cache em memória até 5 min antes de expirar. Sem dependência nova (assinatura com `crypto` do Node).
- Leitura aceita o `GITHUB_TOKEN` legado ou nenhum (repositório público).
- **TEMPORÁRIO:** leitura com `GITHUB_TOKEN` (PAT de longa duração) quando a App não está configurada. Motivo: a App ainda não foi criada pelo dono; o PAT já existe no servidor. Risco: token amplo e de longa duração (já listado para rotação). Remoção: quando a App for instalada, apagar `GITHUB_TOKEN` do Render (pendência do dono).
- **Pendência do dono:** criar a GitHub App do NEXIA (permissões: Contents R/W, Pull requests R/W, Actions R/W, Checks R, Issues R, Metadata R), instalar em `gilcambe/nexia` e configurar as três variáveis no Render. Nada foi criado nem configurado nesta fase.

## ADR-F8-02 — Regras de escrita no GitHub e autonomia até o nível 3
- **Status:** ACEITA.
- **Decisão:** o NEXIA só escreve em branches com prefixo `nexia/` e nunca na branch padrão; o caminho até a branch padrão é sempre um PR (rascunho por padrão). Commit por Git Data API (um commit com vários arquivos, `force: false`, opcionalmente condicionado a `expected_head_sha`), até 20 arquivos de texto, 256 KB por arquivo e 600 KB no total (cabe na fila de aprovação do Firestore). Commit não apaga arquivo (exclusão é CRITICAL na spec §15). Arquivos sensíveis (`.env`, chaves, credenciais, `tfstate`) nunca são lidos nem escritos; conteúdo, mensagem de commit, título e corpo de PR com forma de secret são recusados; leitura redige secrets.
- Riscos e autonomia mínima (spec §15 e §23): leituras LOW; `github.create_branch` MEDIUM nível 2; `github.commit_files` HIGH nível 2 (commit equivale a push); `github.create_pr` HIGH nível 3; `github.dispatch_workflow` HIGH nível 3. Abaixo do nível, a chamada vai para a fila de aprovação (Fase 6); em `production` tudo acima de LOW pede pessoa.
- `github.dispatch_workflow` nunca dispara workflow cujo nome sugira deploy/produção (`deploy`, `prod`, `release`, `publish`) nem aceita input de ambiente: deploy é das Fases 9 e 11.
- **TEMPORÁRIO:** a regra de deploy por nome do arquivo de workflow é heurística. Motivo: o adapter não conhece os environments do repositório. Risco: um workflow de deploy com nome neutro (ex.: `ci.yml` que também publica). Remoção: Fase 9 (workflow modelo com environment protegido; o dispatch passa a checar se o workflow usa `environment:`).

## ADR-F8-03 — Remoção do `autocommit` legado
- **Status:** ACEITA.
- **Decisão:** `netlify/functions/autocommit.js` e a rota `/api/autocommit` foram removidos (agora 404). Ele gravava arquivo por arquivo pela Contents API com o PAT de `GITHUB_TOKEN`, num repositório fixo por variável de ambiente, e estava desligado desde a Fase 1 (A1). Não havia chamador no SPA nem nas funções. O substituto é `github.commit_files` + `github.create_pr` pelo Tool Gateway, com registro no Vault, política por projeto e aprovação humana.
- `AUTOCOMMIT_ENABLED` saiu do `.env.example`. Os testes C3 que usavam o autocommit como endpoint só-master passaram a testar o `guard` com `requiredRole: 'master'` diretamente (mesmo código).

## ADR-F9-01 — Pipeline modelo gerado por projeto; deploy só pelo GitHub Actions
- **Status:** ACEITA.
- **Decisão:** `nexia-ai/cicd/pipeline.js` gera `.github/workflows/nexia-pipeline.yml` para o repositório do cliente a partir dos ambientes do Vault (spec §11, §12): CI em push/PR (install, lint, testes, build, `npm audit --audit-level=high`, gitleaks com checksum); `workflow_dispatch` com `target=staging` (CI → deploy staging → smoke/health) ou `target=production` (CI → staging → smoke → produção no environment `production` → health check). Provedores suportados: Firebase Hosting (autenticação por OIDC/Workload Identity, sem chave), Cloudflare Pages (token no environment) e Render (deploy hook no environment). Segredos ficam nos environments do GitHub, separados por ambiente.
- A ferramenta `cicd.render_pipeline` (LOW) só gera o texto; a entrega no repositório é por `github.commit_files` + `github.create_pr` (Fase 8), com as regras de autonomia de sempre. Este repositório (`gilcambe/nexia`) **não** recebeu o pipeline: nada de deploy foi ligado.
- O YAML é emitido por um gerador próprio (sem dependência) e o teste C1 confere que o PyYAML lê exatamente o objeto gerado.
- **TEMPORÁRIO:** ações do GitHub fixadas por versão major (`@v4`, `@v2`), não por SHA. Motivo: legibilidade do modelo para o cliente. Risco: tag movida por terceiro. Remoção: ~~Fase 11~~ parcial na Fase 11 (ADR-F11-05): o gerador aceita `action_pins` (SHA de 40 hex por ação); o padrão continua a major até o dono informar os SHAs no piloto.

## ADR-F9-02 — Firebase e Cloudflare somente leitura, por integração do projeto
- **Status:** ACEITA.
- **Decisão:** `nexia-ai/firebase-adapter` (service account → JWT RS256 → access token com escopos `firebase.readonly` e `cloud-platform.read-only`) e `nexia-ai/cloudflare-adapter` (API token) só leem. Ferramentas LOW: `firebase.get_project`, `firebase.get_status` (Hosting/último release, regras publicadas, bancos Firestore, Cloud Functions; produto sem acesso aparece como não usado), `cloudflare.get_deployment_status` (Pages com domínios customizados, ou Workers) e `cloudflare.list_dns` (conteúdo de TXT omitido). Cada uma só funciona com uma Integration ativa do provedor no projeto; a Integration Cloudflare aponta para um recurso (`pages:<conta>:<projeto>`, `workers:<conta>:<script>` ou `zone:<zona>`).
- `cloudflare.deploy` (spec §13) não existe como ferramenta própria: deploy é sempre pelo pipeline (`deploy.staging` nesta fase; produção na Fase 11), conforme spec §12 ("não substituir o CI/CD por scripts improvisados no agente").
- **TEMPORÁRIO:** App Check, Authentication e Storage não são consultados. Motivo: exigem APIs/escopos extras e não são necessários para status de deploy. Risco: visão parcial do projeto Firebase. Remoção: Fase 10, se algum agente precisar.

## ADR-F9-03 — Credencial de integração presa ao tenant pelo nome
- **Status:** ACEITA.
- **Decisão:** o Vault guarda só o nome da variável (spec §15). Para um tenant não apontar a sua Integration para a credencial de outro (ex.: a service account do próprio NEXIA), o nome tem que ser `NEXIA_<PROVEDOR>_<TENANT>_<SUFIXO>`; fora disso a chamada falha com `SCOPE` antes de qualquer requisição. O dono cria a variável no Render; o valor nunca passa pelo Vault, pelo log nem pela resposta.
- Ajuste no Vault: nomes de variável (`secret_refs[].name`) deixam de passar pelo detector heurístico de alta entropia (nomes longos como `NEXIA_CLOUDFLARE_<TENANT>_TOKEN` eram recusados); os detectores de formato (ex.: chave AWS) continuam valendo.

## ADR-F9-04 — Staging automático no nível 4 e Deployment no Vault
- **Status:** ACEITA.
- **Decisão:** `deploy.staging` (HIGH, autonomia mínima 4, spec §23) dispara o pipeline modelo com `target=staging` na branch do ambiente staging (ou na padrão) e registra um `Deployment` `pending` no Vault com o SHA disparado. `deploy.sync_status` (LOW) acha a execução no Actions pelo SHA e espelha o estado (`in_progress`, `succeeded`, `failed`); estado final não muda depois de registrado. Abaixo do nível 4 vai para aprovação humana. `github.dispatch_workflow` (Fase 8) passa a recusar o `nexia-pipeline.yml` e inputs `target`/`environment`/`deploy`, para o nível 3 não chegar a staging por outro caminho. `target=production` não é aceito por nenhuma ferramenta nesta fase.
- Correção no Vault: o campo `Deployment.version` colidia com o metadado `version` do registro (o valor informado era sobrescrito pelo número da versão). Passou a se chamar `release`; o Context Engine, que mostrava o número no "Último deploy", foi corrigido. Teste novo impede campo com nome de metadado. Sem migração: o Vault ainda não está em produção (regras/índices não publicados).

## ADR-F10-01 — Orchestrator: plano por intenção, passos mecânicos sem modelo, Execution no Vault
- **Status:** ACEITA.
- **Decisão:** `nexia-ai/orchestrator` recebe o pedido, resolve o projeto (Project Resolver), classifica a intenção, monta o plano e registra uma `Execution` (entidade nova do Vault, `vault_executions`) com plano, agente e status de cada passo, ids das `ToolCall` que sustentam cada passo, gates, orçamento, uso, custo e modelos usados.
- Passos que precisam de julgamento (analisar, implementar, revisar, responder) são de agentes (`runAgent`). Passos mecânicos (criar branch `nexia/...`, abrir PR rascunho, ler checks, gerar e commitar pipeline, disparar e acompanhar staging) são chamadas diretas ao Tool Gateway, sem modelo, para serem determinísticos. Toda escrita passa pelo Policy Engine; o Orchestrator não tem caminho próprio de escrita.
- Pedido ambíguo (spec §29 caso B) devolve a pergunta e os candidatos **sem** criar `Execution`, porque `project_id` é obrigatório e imutável no Vault.
- Confirmação pela ferramenta: depois do agente implementador, `github.compare` precisa mostrar commit à frente da branch padrão; senão a execução falha com `NO_CHANGES`, mesmo que o agente diga que terminou. Reviewer ou Security pedindo mudanças param a execução antes do PR (`REVIEW_CHANGES_REQUESTED` / `SECURITY_CHANGES_REQUESTED`).
- Produção (`deploy_production`) não é executada: a execução fica `needs_input` com a pergunta, e o gate 11 fica `pending` (Fase 11).
- Orçamento padrão por execução: 40 passos de modelo, 80 chamadas de ferramenta, 800 mil tokens, 20 minutos; estouro termina em `failed` com `BUDGET_EXCEEDED`.

## ADR-F10-02 — Gates 1–11 só com evidência; "succeeded" só com todos verdes
- **Status:** ACEITA.
- **Decisão:** `orchestrator/gates.js` avalia os 11 gates da spec §22. Gates 1–7 vêm dos check runs do GitHub do commit/branch, por nome do check (um check pode cobrir vários gates). Testes unitários (3), build (5) e segurança (6) são obrigatórios: sem check correspondente ficam `pending`; os demais viram `not_applicable`. O gate 6 aceita o veredito do Security Agent quando o repositório não tem check de segurança. Gate 8 = veredito estruturado do Reviewer (`report_findings`); 9–10 = `Deployment` do Vault (o smoke do pipeline modelo é o health check); 11 = produção, sempre `pending` quando pedida.
- Execução fica `running` enquanto houver gate pendente e só vira `succeeded` com todos `passed`/`not_applicable`; qualquer `failed` termina em `failed`. `refresh` reavalia quando o CI ou o staging terminam.
- **TEMPORÁRIO:** a correspondência por nome do check é heurística. Motivo: cada repositório nomeia seus jobs de um jeito e o Vault ainda não guarda o mapa check→gate. Risco: um check com nome enganoso conta para o gate errado. Remoção: Fase 11 (ADR-F11-04) — `Project.qa_checks` com nome exato tem precedência; a heurística vale só para gates sem mapa.

## ADR-F10-03 — Execução em segundo plano no próprio processo
- **Status:** ACEITA.
- **Decisão:** `POST /api/nexia/executions` cria a `Execution` e responde 202; o `run` continua no mesmo processo do `server.js` (Render). `GET` lista e mostra; `POST .../refresh` reavalia gates; `POST .../resume` continua depois de uma aprovação em `/aprovacoes`. Página nova `/execucoes` no SPA.
- **TEMPORÁRIO:** sem fila durável. Motivo: o Render roda um único processo e a fase não introduz infraestrutura nova. Risco: se o processo reiniciar no meio, a execução fica parada em `running` até alguém chamar `resume`/`refresh` (o estado salvo por passo permite retomar sem refazer passos concluídos). Remoção: parcial na Fase 11 (ADR-F11-03) — `sweep` retoma execuções paradas sob demanda; fila durável fica para depois do piloto.

## ADR-F10-04 — Intenção por regras e resultados de ferramenta como texto
- **Status:** ACEITA.
- **Decisão:** `classifyIntent` usa regras sobre o texto normalizado (produção > staging > pipeline > consulta > mudança > pergunta); o especialista (Frontend, Database, Backend ou Coder) também por palavras-chave. A escolha é auditável e testada (`tests/unit/orchestrator.test.js` U1).
- **TEMPORÁRIO (1):** classificador por regras. Motivo: determinístico e sem custo; o Model Router ainda não tem classificação estruturada. Risco: pedido com palavras de duas intenções cai na primeira regra (ex.: "status do deploy em produção" vira `deploy_production`, que só pergunta — falha segura). Revisão na Fase 11: **mantido** (ADR-F11-02).
- **TEMPORÁRIO (2):** o resultado das ferramentas volta ao modelo como texto JSON numa mensagem de usuário (até 8 KB), porque o Model Router só aceita mensagens de texto (ADR-F5). Risco: conteúdo de arquivo lido pode tentar instruir o modelo (prompt injection); mitigação: o agente só tem as ferramentas da sua lista, o Policy Engine decide cada escrita e o Orchestrator confere o resultado pela ferramenta. Remoção: quando o Model Router suportar blocos `tool_result` nativos.
- Resolução de projeto: no chat (Fase 4) o resolver só sugere; no Orchestrator ele é bloqueante — sem projeto com confiança suficiente não há execução.

## ADR-F10-05 — Funções legadas migradas para o Model Router
- **Status:** ACEITA. Fecha a ADR-F5-03.
- **Decisão:** `architect`, `autodev-engine`, `sentinel`, `dynamic-pricing`, `ai-sales-agent`, `takedown-gen` e o resumo do `cortex-memory` chamam `modelRouter.getRouter().chat(...)`; nenhuma URL de provedor de IA fica nelas. Mudança mínima ("acrescentar ao lado"): formato de resposta de cada função mantido; erro HTTP do provedor vira texto vazio, como antes, e erro de configuração (sem chave) continua sendo erro.
- O Bridge continua com o log local (ADR-F7-03, adiado para a Fase 11) e sem runner Windows no CI (Fase 11).

## ADR-F11-01 — Produção só com aprovação humana e o mesmo commit validado em staging
- **Status:** ACEITA.
- **Decisão:** nova ferramenta `deploy.production` (CRITICAL). O Policy Engine sempre a põe na fila de aprovação, em qualquer autonomia — inclusive nível 5, que continua sem produção automática (decisão do dono, ADR-F6-01). Dentro da ferramenta, três travas a mais: (1) só executa com uma pessoa como ator, porque a chamada aprovada roda no contexto de quem aprovou; (2) o commit atual da branch de produção precisa ter um `Deployment` de staging `succeeded` no Vault (`STAGING_REQUIRED` senão); (3) o dispatch leva `expectedSha` e é recusado se a branch andou entre a checagem e o disparo (`CONFLICT`). O `Deployment` de produção guarda `approved_by`.
- O GitHub Adapter só aceita `target=production` com `allowProduction: true`, que só essa ferramenta passa; nenhum agente tem `deploy.production` na lista (o Orchestrator chama a ferramenta como passo determinístico, que vai para `/aprovacoes`). O job de produção do pipeline continua no environment `production` do GitHub, com os revisores de lá: são duas aprovações humanas.
- Gate 11 passa só com `approved_by` de pessoa e deploy concluído; sem aprovação registrada, falha.
- Pipeline ganhou `run-name: nexia-pipeline target=...` e o `deploy.sync_status` filtra a execução pelo alvo, para não confundir a de staging com a de produção do mesmo commit.
- **Não executado nesta fase:** nenhum deploy real de produção (nem de staging). Tudo contra o GitHub falso. Ligar de verdade é decisão e ação do dono (ver PILOT-RUNBOOK.md).

## ADR-F11-02 — Intenção continua por regras
- **Status:** ACEITA. Revê a ADR-F10-04 (1).
- **Decisão:** o classificador por regras fica. Motivo: é determinístico, testado (U1) e falha para o lado seguro — pedido misto com "produção" vira `deploy_production`, que só pede aprovação. Um classificador por modelo acrescentaria custo e não-determinismo sem ganho de segurança. Reavaliar com dados do piloto (pedidos que caem em `question` por engano aparecem em `/auditoria`).

## ADR-F11-03 — Retomada de execuções paradas (sweep)
- **Status:** ACEITA. Mitiga a ADR-F10-03.
- **Decisão:** `orchestrator.sweep(ctx)` e `POST /api/nexia/executions/sweep` (botão "Retomar paradas" em `/execucoes`) pegam execuções sem atualização há 10 min: `planned`/`running` com passo pendente → `run` (continua do primeiro passo não concluído; criação de branch reconhece a branch já registrada), `running` com todos os passos feitos → `refresh`, `waiting_approval` → `resume`. No máximo 20 por chamada.
- **TEMPORÁRIO:** sweep sob demanda, sem agendador. Motivo: o Render roda um processo por instância e o sweep precisa do tenant. Risco: execução parada até alguém abrir a página e clicar. Remoção: depois do piloto, com um job agendado por tenant (Render Cron ou GitHub Actions agendado).

## ADR-F11-04 — Mapa check→gate por projeto
- **Status:** ACEITA. Resolve a ADR-F10-02 (TEMPORÁRIO).
- **Decisão:** `Project.qa_checks: [{ gate: 1–7, check: "<nome exato do check>" }]`. Gate mapeado passa a ser obrigatório e só aceita os checks listados; gates sem mapa continuam com a correspondência por nome. O fallback do gate 6 pelo Security Agent só vale quando não há mapa.

## ADR-F11-05 — Observabilidade, auditoria, custos e onboarding com integrações
- **Status:** ACEITA.
- **Decisão:** `nexia-ai/observability.collectMetrics` agrega do Vault (sem armazenamento novo): execuções por status/intenção, tokens, chamadas de ferramenta, custo estimado (e quantas execuções sem preço conhecido), taxa de sucesso e duração média; por ferramenta, total/sucesso/falha/negada e duração média; decisões da política; aprovações pendentes/aprovadas/rejeitadas/expiradas; deploys por ambiente com o último e quem aprovou. `GET /api/nexia/metrics?project_id=&since=` e página `/auditoria` (com a trilha de `ToolCall`). Recorte de até 200 registros por tipo, avisado com `truncated`.
- Onboarding (spec §29 caso E) passa a registrar `Integration` `pending` para GitHub, Firebase (projeto detectado) e Cloudflare (wrangler), sem credencial; ativar exige o dono informar a referência no padrão `NEXIA_<PROVEDOR>_<TENANT>_...` (ADR-F9-03). Nunca altera integrações existentes.
- Pipeline modelo aceita `action_pins` (SHA de 40 hex para `actions/checkout`, `actions/setup-node`, `google-github-actions/auth`); sem pin, continua na major.

## ADR-F11-06 — O que fica para o piloto (fases 23–25 da spec)
- **Status:** ACEITA.
- Piloto com um cliente real, correções do piloto e aumento de autonomia são do dono (spec §30, fases 23–25) e dependem das pendências de credencial e publicação. Roteiro em `PILOT-RUNBOOK.md`.
- Adiados para o piloto, com motivo: log do Bridge no Vault (ADR-F7-03; precisa de credencial do Bridge para a API, que não existe sem decisão do dono), runner Windows do Bridge (só na máquina do dono), SHAs das ações (o dono informa; esta sessão não lê repositórios de terceiros), agendador do sweep.



## ADR-HOST-01 — Hospedagem só em Cloudflare + Firebase + GitHub (sem Render)
- **Status:** SUBSTITUÍDA pela ADR-FREE-01 (2026-10-04) na parte do Container (exige plano pago). Continua valendo: só Cloudflare + Firebase + GitHub, sem Render. Aceita em 2026-10-03. Substitui as menções a Render nas ADRs F3-*, F9-*, F10-03 e F11-03 e nos relatórios de fase.
- **Contexto:** o dono informou que não usa Render; usa só Firebase, GitHub e Cloudflare. O `render.yaml`, o `start.sh` e os endereços `nexia-os.onrender.com` vieram do envio original do código (commit 8a38f99, "Add files via upload") e a auditoria os tomou como a hospedagem atual.
- **Decisão:** o `server.js` continua igual e roda num **Cloudflare Container** (`Dockerfile`, Node 20, porta 8080) atrás de um **Worker** (`cloudflare/worker.js`, `wrangler.jsonc`) que recebe todo o tráfego do domínio. Site e API ficam no mesmo endereço; por isso `VITE_NEXIA_API_URL` vazio passa a ser o padrão (chamadas relativas) e o CORS sem `NEXIA_APP_URL` não libera outras origens. Firebase segue para Auth, Firestore e Storage. Deploy só pelo workflow manual `Deploy Cloudflare` (confirmação `DEPLOY` + environment `production` com revisor obrigatório no GitHub).
- **Removido:** `render.yaml`, `start.sh`, fallback `nexia-os.onrender.com` (frontend, `server.js`, Sentinel, `index.html`, QR code do CES), `RENDER_EXTERNAL_URL`, mensagens "Render free tier dormindo".
- **Mantido de propósito:** o Vault e o gerador de pipeline continuam aceitando `render` como provedor **de cliente** (outros repositórios podem usar Render); a detecção de `render.yaml` continua para esses repositórios. Nada disso é usado pelo NEXIA.
- **Alternativa considerada:** API no Firebase (Cloud Run), sem chave de serviço. Fica como opção se o dono preferir (exige plano Blaze); o Worker passaria a encaminhar `/api` para lá.
- **TEMPORÁRIO:** uma instância só do container (`max_instances: 1`) e site servido pelo container (não pelos assets do Worker). Motivo: o `server.js` guarda estado em memória (rate limit, execuções em andamento) e serve também páginas estáticas fora de `out/`. Risco: sem redundância; o container dorme após 30 min sem tráfego e acorda em alguns segundos (execução interrompida é retomada pelo botão "Retomar paradas", ADR-F11-03). Remoção: depois do piloto, com estado no Firestore e assets no Worker.
- **TEMPORÁRIO:** a chave de serviço do Firebase (`FIREBASE_SERVICE_ACCOUNT_BASE64`) vai como segredo do Worker. Motivo: fora do Google não há credencial automática. Risco: vazamento da chave dá acesso total ao projeto. Mitigação: só como segredo do Cloudflare, rotação no item 1 do runbook. Remoção: se a API migrar para Cloud Run ou com federação de identidade.
- **Não executado:** nenhum deploy. O Worker foi empacotado com `wrangler deploy --dry-run` (o passo do container exige Docker, que o runner do GitHub tem) e a imagem foi simulada passo a passo (instalação, build, `/health` 200).

## ADR-F12-01 — Ações fixadas por SHA por padrão; pipeline sem Render
- **Status:** ACEITA (2026-10-03). Resolve o TEMPORÁRIO da ADR-F9-01 e da ADR-F11-05.
- **Decisão:** o pipeline modelo usa sempre o commit da release (`DEFAULT_PINS` em `nexia-ai/cicd/pipeline.js`: `actions/checkout` v4.4.0, `actions/setup-node` v4.4.0, `google-github-actions/auth` v2.1.13), conferido com `git ls-remote` nos repositórios oficiais. `actionPins` do projeto continua podendo trocar. Os workflows do próprio NEXIA (`ci.yml`, `deploy-cloudflare.yml`) também passam a usar SHA, com a versão em comentário.
- O pipeline modelo deixa de gerar deploy para Render (ADR-HOST-01): destinos aceitos são Firebase Hosting e Cloudflare. O Vault e o onboarding continuam reconhecendo `render` só como dado de repositório de terceiro (registros antigos e detecção), sem nenhuma ação.
- **Manutenção:** atualizar os SHAs exige olhar a release nova e trocar os três valores (teste C6 garante que nenhuma ação fica por tag).

## ADR-F12-02 — Bridge testado no Windows
- **Status:** ACEITA (2026-10-03). Resolve parte da ADR-F11-06.
- **Decisão:** job `Bridge no Windows` no CI (`windows-latest`, Node 20) roda `tests/unit/bridge.test.js` (caminhos `D:\`, `npm.cmd`, processo MCP real). O primeiro run achou uma diferença real: no Windows o caminho aparecia com `\` nas confirmações e no registro; agora o caminho relativo é sempre normalizado para `/` (`nexia-bridge/lib/paths.js`). Continua sendo do dono testar na máquina dele com o `bridge.json` real.

## ADR-F12-03 — Retomada agendada de execuções (Cron do Cloudflare)
- **Status:** ACEITA (2026-10-03). Resolve o TEMPORÁRIO da ADR-F11-03 (sweep só sob demanda) e mitiga a ADR-F10-03.
- **Decisão:** o Worker tem um Cron Trigger (`7 * * * *`, de hora em hora) que chama `POST /api/nexia/internal/sweep` no container com o cabeçalho `X-Nexia-Cron`. A rota só existe se `NEXIA_CRON_SECRET` (segredo do Worker, 32+ caracteres) estiver configurado e compara em tempo constante. Percorre até 200 tenants e retoma até 20 execuções `planned`/`running` paradas há 10 min, cada uma em nome de quem a pediu (`requested_by`); a auditoria registra o sistema só como quem disparou a varredura.
- **Fora de propósito:** execuções `waiting_approval` não são retomadas pelo cron: continuar depois de aprovar é ação de pessoa (botão "Retomar paradas" ou "Retomar após aprovação").
- **Custo:** cada disparo acorda o container (que dorme após 30 min). Para mais frequência, trocar o cron em `wrangler.jsonc`.

## ADR-F12-04 — Log do NEXIA Bridge no Vault
- **Status:** ACEITA (2026-10-03). Resolve o TEMPORÁRIO da ADR-F7-03 e o último item da ADR-F11-06.
- **Credencial do Bridge:** token `nxb_<64 hex>` criado por master/admin do tenant em `/auditoria` (`POST /api/nexia/bridge-tokens`). O servidor guarda só o SHA-256 na coleção interna `bridge_tokens` (fechada a clientes pela regra padrão do Firestore, que nega tudo que não está listado); o token aparece uma vez. Até 20 ativos por tenant; revogação imediata (`DELETE /api/nexia/bridge-tokens/{id}`); `last_used_at` atualizado a cada uso. No computador, o token vive só na variável `NEXIA_BRIDGE_TOKEN` (o Bridge já não passa variáveis com `TOKEN` no nome para os comandos).
- **Envio:** `nexia-bridge/lib/sync.js` lê o `bridge-log.jsonl` a partir do ponto já enviado e manda lotes de até 100 linhas para `POST /api/nexia/bridge/events` (2 s depois de cada operação e na partida, ou `nexia-bridge sync`). O ponto só avança depois do 200; o id de cada linha é o hash dela, então reenvio não duplica (idempotência do Vault). `vault.url` só aceita `https://` (localhost liberado para teste) e nunca usuário/senha.
- **No Vault:** cada linha vira `ToolCall` `bridge.<ferramenta>` no projeto informado, em nome do agente (`bridge:<cliente MCP>`), com risco pela classe da operação, `denied`/`forbidden` para bloqueios do Bridge e `failed` para erro ou código de saída diferente de zero. Linhas de "aguardando confirmação" não sobem (a linha final chega depois da aprovação local). Projeto de outro tenant é recusado pelo Vault. Aparece em `/auditoria` e nas métricas sem mudança nelas.
- **Limite conhecido:** o tenant vem do token; um token vazado permite gravar registros falsos de Bridge naquele tenant (não permite ler nada nem executar ferramenta). Mitigação: revogar na tela; registros ficam marcados como `bridge.*` e com o agente.

## ADR-FREE-01 — Tudo no plano grátis: Worker do Cloudflare sem Container, Firebase sem firebase-admin
- **Status:** ACEITA (2026-10-04). Regra do dono: "esse projeto não usa nada pago; tudo que tiver que pagar, encontre uma alternativa gratuita". Substitui o Container da ADR-HOST-01.
- **Contexto:** o deploy de 2026-10-04 publicou o Worker mas falhou no envio da imagem do Container ("Unauthorized"): Containers só existe no Workers Paid. O `firebase-admin` não roda no Worker (usa gRPC e módulos do Node que o workerd não tem), e a alternativa do Google (Cloud Run/Functions) exige o plano Blaze.
- **Decisão:** o próprio Worker (`cloudflare/worker.js` + `cloudflare/app.js`) atende tudo, no plano grátis:
  - site React (`out/`) e páginas do legado pelo binding `ASSETS` (montado por `scripts/build-worker-assets.js`); os arquivos com hash em `/assets/*` saem direto do Cloudflare sem contar como pedido;
  - `/api/*` com os mesmos handlers do `server.js` (lista fixa em `cloudflare/functions.js`, carregados só quando usados);
  - mesmas regras de estáticos do `server.js` (só GET/HEAD, caminho normalizado, páginas de tenant, SPA, nada de arquivo privado), em `lib/routes.js` e `lib/safe-path.js`, compartilhados pelos dois.
- **Firebase sem firebase-admin:** `lib/firebase-lite` fala com o Firestore (API REST v1: `batchGet`, `runQuery`, `runAggregationQuery`, `commit` com transformações e pré-condições, transações com `newTransaction`/`rollback`) e com o Auth (verificação do ID token pelas chaves públicas `securetoken`, Identity Toolkit para `getUser`/`updateUser`/claims). O token do Google vem da chave de serviço assinada com Web Crypto (RS256). Mesma interface que o código já usava; os 117 testes de integração com os emuladores passam com o `firebase-admin` proibido. Firebase fica no plano **Spark** (grátis): Auth e Firestore com cota diária; o NEXIA não usa Cloud Storage (que hoje pede Blaze).
- **Limites do plano grátis do Worker:** 100 mil pedidos por dia, 10 ms de CPU por pedido (espera de rede não conta), 50 chamadas externas por pedido, 3 MB de código comprimido (o NEXIA usa ~0,33 MB). CRUD do Vault faz no máximo ~21 chamadas por pedido (medido); o que passa disso vai para a ADR-FREE-02.
- **TEMPORÁRIO:** estado em memória (rate limit por instância) não é compartilhado entre instâncias do Worker. Motivo: o Firestore grátis tem cota de escrita e o KV grátis tem só 1.000 escritas/dia. Risco: limite por usuário menos preciso. Remoção: se o uso crescer, contador no Firestore com TTL.
- **TEMPORÁRIO:** a chave de serviço do Firebase (`FIREBASE_SERVICE_ACCOUNT_BASE64`) continua como segredo (Worker e GitHub). Motivo: fora do Google não há credencial automática sem plano pago. Risco: vazamento dá acesso total ao projeto Firebase; o dono decidiu não trocar as chaves e assume o risco (2026-10-04). Remoção: só com federação de identidade.
- **Removido:** `Dockerfile`, `.dockerignore`, `cloudflare/env.js`, `@cloudflare/containers`, `firebase-admin`. O `server.js` continua funcionando (desenvolvimento local e testes).

## ADR-FREE-02 — Tarefas longas no GitHub Actions (grátis em repositório público)
- **Status:** ACEITA (2026-10-04).
- **Contexto:** uma execução de agentes ou um onboarding fazem centenas de chamadas (onboarding medido: ~120 por pedido, ~65 leituras do GitHub) e podem durar minutos; o Worker grátis permite 50 chamadas e não tem processo em segundo plano.
- **Decisão:** com `NEXIA_JOBS=github` (já no `wrangler.jsonc`), a API registra o pedido no Vault como sempre e dispara o workflow **NEXIA Jobs** (`.github/workflows/nexia-jobs.yml`, `workflow_dispatch`) com um JSON **só de ids** (tenant, usuário, execução, projeto, repositório). O workflow roda o mesmo código em Node (`scripts/nexia-job.js` → `nexia-ai/jobs/runner.js`) e grava no mesmo Vault. Tipos: `execution.run`, `execution.resume`, `execution.refresh`, `project.onboard`, `sweep`. Respostas da API: 202 com `job: { queued }`; a tela acompanha pelo Vault.
- **Cron:** o Cron do Worker (`7 * * * *`; desde a ADR-AUTO-01, `*/5 * * * *` com a retomada no primeiro tique de cada hora) só faz uma consulta; havendo execução `planned`/`running` parada há mais de 10 min, dispara um `sweep` no Actions. Não precisa mais do `NEXIA_CRON_SECRET` no Worker.
- **Segredos:** um lugar só, os segredos do repositório no GitHub. Os dois workflows passam cada segredo pelo nome do `.env.example` (o teste CF10 confere; o GitHub não aceita nome começando com `GITHUB_`, então `GITHUB_APP_*` e `GITHUB_REPO` ficam cadastrados como `NEXIA_GITHUB_APP_*` e `NEXIA_GITHUB_REPO`). Passar todos de uma vez (`toJSON(secrets)`) fez o GitHub parar os runs em `action_required` em 2026-10-04. O deploy copia para o Worker os que têm valor (`scripts/worker-secrets.js` + `wrangler secret bulk`; o log mostra só os nomes).
- **TEMPORÁRIO:** segredos por cliente da Fase 9 (`NEXIA_<FIREBASE|CLOUDFLARE>_<TENANT>_*`) precisam de uma linha em cada workflow ao cadastrar o cliente. Motivo: acima. Risco: integração do cliente sem credencial nas tarefas até a linha existir. Remoção: quando houver forma grátis de passar segredos por prefixo. O Worker precisa também de `NEXIA_JOBS_TOKEN` (token fine-grained grátis, só `gilcambe/nexia`, permissão Actions: leitura e escrita).
- **Custo:** zero. Repositório público tem minutos ilimitados no Actions. **Risco:** logs de Actions de repositório público são públicos; por isso o pedido leva só ids, o script imprime só um resumo curto e os segredos são mascarados pelo GitHub. Se o repositório virar privado, a cota grátis é de 2.000 minutos/mês.
- **TEMPORÁRIO:** cada tarefa leva ~30–60 s a mais para começar (fila do Actions). Remoção: não prevista no plano grátis.

## ADR-FREE-03 — IA sem custo por padrão
- **Status:** ACEITA (2026-10-04).
- **Decisão:** os agentes escolhem o primeiro modelo configurado de cada classe (`nexia-ai/orchestrator/models.js`). O Claude (Anthropic) continua na frente, mas só entra se `ANTHROPIC_API_KEY` existir, e ela é **paga por uso**. Sem ela, valem as opções grátis: Google Gemini (`GEMINI_API_KEY` do AI Studio, provedor `google` pelo endpoint compatível com OpenAI, com tool_call), Groq, Cerebras e modelos `:free` do OpenRouter. `NEXIA_MODELS_CODING`/`_REASONING`/`_FAST` trocam a lista sem mudar código.
- **Custo em qualidade:** os modelos grátis erram mais em tarefas longas de código, têm limite de pedidos por minuto e por dia, e no plano grátis do Gemini o Google pode usar os dados enviados para melhorar os produtos dele. Por isso o fluxo continua com revisão, CI e aprovação humana antes de produção, como antes.


## ADR-Q-01 — Qualidade do código gerado pelo Cortex
- **Status:** ACEITA (2026-10-04).
- **Contexto:** com modelos grátis (ADR-FREE-03) a primeira versão do código erra mais. Antes, uma revisão reprovada encerrava a execução; arquivos acima de ~8 KB chegavam cortados ao modelo, que então reescrevia o arquivo inteiro com o que não tinha lido; e os prompts pediam só "mudança mínima".
- **Decisão:** (1) os agentes que escrevem código e o Reviewer seguem um padrão de qualidade explícito (`QUALITY` em `nexia-ai/orchestrator/agents.js`): seguir a stack do repositório, entregar completo sem placeholder, HTML semântico/responsivo/acessível/SEO, validação e erros tratados, README em projeto novo, testes quando o projeto tem. (2) Nova ferramenta `github.edit_files` (HIGH, autonomia 2): troca trechos exatos (cada um precisa aparecer 1 vez) e grava num commit; arquivo com segredo redigido não é editado. (3) Resultado de ferramenta até 60 mil caracteres. (4) Quando Reviewer ou Security pedem mudanças, o agente que implementou recebe o que foi pedido e corrige na mesma branch (precisa de commit novo), e a revisão roda de novo, até 2 rodadas (`fix_rounds`, `fix_feedback` na Execution). Depois disso, falha como antes, sem PR.
- **Custo:** zero; mais chamadas de modelo por execução (orçamento padrão subiu para 80 passos, 160 ferramentas, 2 milhões de tokens e 30 minutos).

## ADR-Q-02 — Checagem estática dos arquivos web antes da revisão por IA
- **Status:** ACEITA (2026-10-05).
- **Contexto:** no primeiro site feito pelo Cortex com modelos grátis, o HTML saiu com um `</div>` trocado por aspas e uma imagem `hero.jpg` que não existia. Pedir isso a um Reviewer de IA gasta a cota grátis e nem sempre pega.
- **Decisão:** antes do Reviewer, o Orchestrator lê os `.html`, `.css` e `.js` alterados na branch e roda `nexia-ai/orchestrator/web-check.js`, que só lê o texto (nunca executa): tag sem fechar ou fechada fora de ordem, texto solto, id repetido, âncora sem alvo, `<img>` sem alt, CSS com chave sobrando/faltando, JS de script comum que não compila, e arquivo local referenciado que não existe na branch. Erro vira `changes_requested` direto para o agente que implementou (mesmas rodadas do ADR-Q-01), sem chamar o Reviewer. Avisos (campo sem label, img sem tamanho, link vazio, botão desabilitado) vão para o Reviewer conferir.
- **Custo:** zero; algumas leituras de arquivo a mais por execução.

## ADR-Q-03 — Padrão visual obrigatório, agente Designer e fotos grátis
- **Status:** ACEITA (2026-10-05).
- **Contexto:** o site de teste do Cortex funcionava, mas tinha cara de rascunho: fontes do sistema, nenhuma foto, nenhum movimento. O dono do projeto exige que todo site ou sistema criado pelo Cortex tenha qualidade de agência, sempre, sem serviço pago.
- **Decisão:** (1) Ferramentas `media.search_images` e `media.search_videos` (LOW, só leitura): Pexels quando há `PEXELS_API_KEY` (grátis), senão Openverse (licenças CC de uso comercial) e Wikimedia Commons, sem chave; devolvem link, tamanho, alt e crédito. (2) Pedido para criar site ou sistema ("crie um site", "desenvolva um sistema", detectado por `buildKind`) começa pelo novo agente Designer, que escolhe fontes do Google Fonts, paleta, seções e fotos reais e entrega um brief ao Frontend. (3) `DESIGN` em `agents.js` é o padrão visual de Frontend, Designer e Reviewer: fontes da web, variáveis no `:root`, fotos reais com crédito, animações e revelar ao rolar no lugar de GIF, layout responsivo e, em sistemas, menu lateral, tabelas com estados, gráficos e ícones grátis. (4) A checagem do ADR-Q-02 reprova páginas novas desses pedidos sem fonte da web, sem variáveis de cor, sem `@media`, sem movimento, site com menos de 4 fotos/vídeos ou sem header/footer, sistema sem menu, e foto ou vídeo externo que não abre.
- **Custo:** zero. Fotos ficam por link (hotlink) nos serviços de origem, com crédito no rodapé.

## ADR-Q-04 — NEXIA Site Kit: a IA escreve o conteúdo, o kit gera o código
- **Status:** ACEITA (2026-10-05).
- **Contexto:** com o ADR-Q-03 o padrão ficou claro, mas os modelos grátis (Groq, cerca de 8 mil tokens por minuto) não conseguem escrever um site inteiro de qualidade num laço de agente: os testes da clínica falharam por pedido grande demais (413) e por cota do minuto (429). Qualidade "às vezes" não serve; o dono do projeto exige qualidade sempre, em todo site e sistema.
- **Decisão:** pedido de site ou sistema novo (`buildKind`) segue o plano branch → `design_spec` → implement → revisão → PR. (1) O Designer faz UMA chamada sem ferramentas (`askModel`) e devolve só um JSON (`spec`): nome, textos, fontes do Google Fonts, paleta, estilo, contatos e as seções do site (hero, serviços, sobre, galeria, equipe, depoimentos, FAQ, CTA, contato) ou os cadastros do sistema (campos e exemplos). O JSON é lido com tolerância (`extractJson`) e validado (`normalizeSpec`); com erro, a IA recebe os erros uma vez. (2) O orquestrador busca uma foto para cada lugar com `media.search_*`, sem repetir e só links que abrem; vídeo de fundo só do Pexels. (3) O spec e as fotos ficam em `<pasta>/nexia-spec.json` na branch. (4) O implement gera o código com o kit (`nexia-ai/site-kit`): site com topo fixo, hero em tela cheia, cards com foto, contadores, galeria, depoimentos, FAQ, mapa, formulário que abre o WhatsApp, botão flutuante, créditos, animações e revelar ao rolar; sistema com menu lateral, painel com indicadores e gráfico (Chart.js), tabelas com busca, ordenação e CSV, cadastro em janela com validação, dados no navegador e modo escuro. (5) Código do kit sem edição de agente: Security não gasta modelo (código fixo, testado, sem backend e com todo texto escapado; o secret scan do CI continua) e o Reviewer confere só o spec (conteúdo), não o diff. No caminho do kit o código nunca é editado por modelo: se a revisão pedir mudança, o Designer corrige o spec (pequeno, cabe na cota grátis) e o kit gera tudo de novo; foto que deixa de abrir na checagem é trocada por outra da busca e o site é gerado de novo, sem modelo. Um 429 do servidor de fotos conta como foto existente.
- **Garantia:** os testes K4 e K5 renderizam site e sistema e exigem zero erro na checagem visual e estática (ADR-Q-02/03).
- **Custo:** zero; cabe no plano grátis porque a IA gera só alguns milhares de tokens por pedido.

## ADR-CLONE-01 — Clonar site (só o design, ou espelho autorizado) e duplicar tenant
- **Status:** ACEITA (2026-10-05).
- **Contexto:** o dono do projeto quer que o Cortex "clone" um site a partir da URL e que o master copie a configuração de um tenant para outro (como o `duplicate station` do Avaya CM). Copiar textos, imagens, logos e código de site de terceiros fere direito autoral e termos de uso; copiar tenant inteiro levaria segredos e dados pessoais.
- **Decisão — dois modos, separação obrigatória:**
  - **design** (padrão, qualquer site público): só tokens de design (cores por papel, fontes, tamanhos, pesos, cantos, sombras, espaçamentos, variáveis CSS) e a ordem das seções (hero, serviços, depoimentos, FAQ, contato... pela estrutura do DOM, nunca pelo texto), mapeados para a base do NEXIA Site Kit (`nexia-ai/cloner/design.js`: paleta primary/accent/bg/surface/text/muted/dark com contraste AA, fontes trocadas pela curada mais próxima da mesma família visual, style elegant/modern/bold/soft). Texto, imagem, logo e código do original nunca vão para o resultado; o conteúdo é do pedido do usuário (ou exemplo da IA para ele trocar). Site escuro vira fundo claro com o escuro em `dark`, porque o kit pressupõe fundo claro.
  - **espelho** (cópia fiel): só com `autorizado=SOU_DONO_OU_AUTORIZADO` (quem pede declara ser dono ou autorizado) e com o `robots.txt` permitindo (erro ao ler o robots.txt = não copia). Uma página por vez, ≥ 1 s entre páginas (ou o Crawl-delay, até 10 s), espera em 429/503 (Retry-After ou 5 s × 2ⁿ), no máximo `max_paginas` (padrão 20, teto 200), User-Agent `NEXIA-Clone/1.0 (+https://github.com/gilcambe/nexia)`. Nenhum cookie ou credencial: só GET/HEAD, pedido sem `cookie`/`authorization`, resposta sem `Set-Cookie`, `document.cookie` desligado. Formulários perdem `action`/`method`/`formaction` e ganham um aviso visível. Links e mídias (src, href, srcset, poster, style, `<style>`, CSS `url()`) viram caminhos relativos; o que não foi copiado aponta para o original.
- **Onde roda (grátis):** workflow `clonar-site.yml` (`workflow_dispatch`: url, modo, autorizado, pasta, max_paginas) com Playwright 1.59.1 + Chromium, como o `preview-site.yml`. Design → branch `clones-design` (`<pasta>/design.json`, `spec-base.json` e fotos de tela 375/768/1440 só de referência). Espelho → branch `nexia/clone-<host>-<run>` com `clones/<host>/` e PR em rascunho para `develop`; o resumo do run avisa que **o repositório é público, então o espelho fica público**. As entradas chegam ao script só por variável de ambiente; o log mostra só host e contagens.
- **Cortex:** "crie um site igual ao / com o design de / no estilo de https://..." (ou "clone o site https://...") segue o plano de site novo (ADR-Q-04); no passo `design_spec`, o orquestrador lê a base visual **sem navegador** (`fetchDesign`: HTML + até 6 folhas de estilo, cada endereço e redirecionamento validado), manda ao Designer junto com a regra de não copiar conteúdo e aplica cores, fontes, estilo e ordem das seções no spec validado. Sem acesso ao site, segue sem base (o resumo do passo diz). Endereços no pedido não contam para a intenção (`https://x.com/workflow` não é pipeline).
- **URL segura:** só http/https, sem usuário/senha na URL, portas 80/443/8080/8443, sem localhost/`.local`/`.internal` e sem IP interno (IPv4, IPv6, IPv4 mapeado, formas inteira/hex), conferido no texto e no DNS; no Worker (sem DNS) vale a checagem do texto.
- **Duplicar tenant:** `POST /api/nexia/tenants/:id/duplicate` (só master), corpo `{ new_tenant, name?, include?, dry_run? }`, `include` ⊂ settings, clients, projects, repositories, environments, tool-policies, robots (dependências entram sozinhas). Copia pelo próprio Vault (ids novos, validação, detector de segredo, auditoria por registro) e remapeia `client_id`, `project_id` e `primary_repository_id`. **Nunca copia:** segredos e credenciais (inclusive `secret_refs`, que apontam para segredos do tenant de origem), usuários/membros/convites, execuções e chamadas de ferramenta, auditoria, cobrança/plano/pagamentos (o novo nasce `free`), domínio próprio e dados pessoais (contatos e notas de cliente, e-mails, telefones e subcoleções como leads e inscritos). Do documento do tenant só entram campos de configuração listados (`settings`, `theme`, `branding`...), sem chaves sensíveis. Prévia (`dry_run`) devolve o plano sem gravar. Uma entrada `duplicate_create`/`duplicate_source` vai para `vault_audit` nos dois tenants (sem valores). No Worker grátis (`NEXIA_JOBS=github`) a API cria o tenant como `queued` e a cópia roda na tarefa `tenant.duplicate` do NEXIA Jobs (só ids); a mesma tarefa não roda duas vezes. Tela: `/projetos`, painel "Duplicar tenant" (só master).
- **Riscos:** a autorização do espelho é declarada, não verificada (registro no run e no PR). Scripts do site espelhado podem chamar serviços externos. As fotos de tela do modo design ficam públicas na branch `clones-design`; apagar a pasta remove do topo da branch, não do histórico. Cópia de tenant que falha no meio fica com `duplicationStatus: failed` e o que já foi criado.
- **Custo:** zero (Actions em repositório público; leitura leve sem navegador dentro da tarefa do Cortex).

## ADR-AUTO-01 — Robôs NEXIA: tarefas agendadas que rodam sozinhas, sem custo
- **Status:** ACEITA (2026-10-05).
- **Contexto:** o dono quer configurar uma vez um agente ("confira o site todo dia", "revise os PRs", "resuma o dia") e ver o trabalho feito 24 h por dia, com o computador desligado e sem pagar nada. Hoje só existe pedido manual em `/execucoes`.
- **Decisão:** nova entidade do Vault `Robot` (`vault_robots`, prefixo `rbt`, por tenant, com versão e auditoria como as outras): nome, projeto, tarefa em português (até 4.000 caracteres, com a varredura de segredos), modelo de origem, agenda, fuso (padrão `America/Sao_Paulo`), ligado, dono, `next_run_at`, `last_run_at`, `last_run_execution_id` e as últimas 10 rodadas (`recent_runs`). O robô não tem poder próprio: cada rodada é uma execução comum do Orchestrator, em nome do dono, com a autonomia do projeto, as aprovações em `/aprovacoes`, o CI e a aprovação de deploy de produção de sempre.
  - **Agenda** (`nexia-ai/robots/schedule.js`): `hourly` (minuto), `interval` (a cada 2, 3, 4, 6, 8 ou 12 h contadas da meia-noite local, mais o minuto), `daily` (HH:MM) e `weekly` (dias 0–6 + HH:MM). Validação estrita (campo de outro tipo é erro). O próximo horário é calculado no fuso pelo `Intl` (sem tabela própria): hora que não existe no início do horário de verão anda para frente; hora repetida no fim vale a primeira vez. Determinístico e testado com o horário de verão antigo do Brasil (2018/2019) e o de Nova York.
  - **API:** `GET|POST /api/nexia/robots`, `GET|PATCH|DELETE /robots/:id` (If-Match), `GET /robots/:id/history`, `POST /robots/:id/restore`, `GET /robots/templates` e `POST /robots/:id/run` ("Rodar agora": execução em nome de quem clicou, sem mexer na agenda). Mesma autorização do Vault (master qualquer tenant, admin o próprio). Dono, `next_run_at` e rodadas são só do servidor. Até 20 robôs por tenant. Excluir desliga antes do soft-delete.
  - **Agendamento:** o Cron do Worker passou para `*/5 * * * *`. Cada tique faz **uma** consulta de campo único (`next_run_at <= agora`, só os campos de controle); só robô ligado tem `next_run_at` (regra do schema), então não precisa de índice composto. Havendo vencido, dispara **uma** tarefa `robots.run` no GitHub Actions, sem tenant nem ids (log público). A retomada de execuções paradas continua de hora em hora (minutos 0–4). Nada vencido → nenhum minuto do Actions.
  - **Execução** (`runDueRobots`, até 10 por tarefa): para cada robô, primeiro reivindica (avança `next_run_at` com `expectedVersion`; outra tarefa que leu a mesma versão recebe `VERSION_CONFLICT` e pula), depois cria a execução (chave de idempotência `robot:<id>:<horário>`) e registra a rodada; por fim roda as execuções uma a uma. Se a tarefa cair no meio, as execuções criadas ficam `planned` e a retomada de hora em hora termina. A reivindicação é auditada como `system/robots`; as ferramentas, em nome do dono.
  - **Tela** `/robos`: lista, criar/editar (modelos prontos "Vigia do site", "Revisor de PRs" e "Relatório diário", que só preenchem o formulário), agenda, fuso, ligar/desligar, "Rodar agora" e as últimas rodadas com link para a execução (`/execucoes?projeto=&abrir=`).
- **Custo:** zero. Cron do Worker grátis (288 tiques/dia, cada um uma consulta ao Firestore Spark); Actions grátis em repositório público, e só quando há robô vencido; modelos grátis da ADR-FREE-03.
- **Índices:** a listagem por tenant usa dois índices compostos novos de `vault_robots` (gerados por `indexes.js`), que precisam ser publicados pelo workflow "Publicar índices do Firestore" antes de usar a tela em produção. A consulta do Cron usa o índice automático de campo único.
- **TEMPORÁRIO:** o robô roda em nome do dono mesmo que ele perca o acesso de admin depois. Motivo: o papel pode vir de claim do Auth, que o Actions não lê sem custo extra. Risco: robô de ex-admin continua rodando (sempre limitado pela autonomia do projeto e pelas aprovações). Remoção: desligar os robôs do usuário quando o papel dele mudar (tela de usuários).
- **TEMPORÁRIO:** a fila do Actions leva ~30–60 s para começar; o robô roda até ~5 min depois do horário. Remoção: não prevista no plano grátis.


## ADR-Q-05 — Padrão mínimo de qualidade do Cortex e mais mídia (vídeo, GIF, música, links)
- **Status:** ACEITA (2026-10-05).
- **Contexto:** o dono do projeto aprovou o 3º site da clínica (PR #57) e mandou que esse nível vire regra: "o mínimo de qualidade aceitável é isso". Pediu também vídeos, GIFs, fotos, música e links.
- **Decisão:** (1) `nexia-ai/site-kit/quality.js` (`qualityCheck`) é o piso. Site: pelo menos 7 seções com hero, serviços (3+), sobre, galeria (4+ fotos resolvidas), depoimentos (3+), FAQ (4+), CTA e contato; topo com foto ou vídeo; "sobre" com foto; 6+ fotos/vídeos no total; nenhum texto genérico ("Serviço 1", lorem ipsum); contato real. Sistema: cada cadastro com 3+ campos e 4+ linhas de exemplo, e um campo de opções para o gráfico. (2) O Designer tem até 3 tentativas para atingir o piso de conteúdo; correção da revisão que deixaria o spec abaixo do piso é recusada (fica o anterior). Faltando foto, o orquestrador busca de novo pelo tema; se ainda faltar, a execução falha com `QUALITY_BELOW_MIN` em vez de entregar algo pior. (3) Fontes só de uma lista curada do Google Fonts; fora dela, o kit usa o par do estilo. Paleta com contraste WCAG corrigido sozinho (texto 7:1, botão com texto branco 4.5:1). (4) Mídia nova, toda grátis e sem chave: `media.search_gifs` (Openverse `extension=gif` e Wikimedia), `media.search_audio` (Openverse áudio: Jamendo, Freesound, Wikimedia; licenças de uso comercial). Seções novas: `video` (YouTube do pedido, carregado só no clique, via youtube-nocookie; ou vídeo grátis com controles), `music` (player com play/pausa, nunca toca sozinho), `links` (botões com ícone) e GIFs na galeria. Redes: YouTube, TikTok e LinkedIn no rodapé.
- **Garantia:** testes K6 (piso, fontes, contraste), K7 (vídeo, GIF, música e links passam na checagem sem erro nem aviso) e MD5 (buscas de GIF e música).
- **Custo:** zero.

## ADR-FREE-04 — O Cortex nunca para por falta de IA (só provedores grátis)
- **Status:** ACEITA (2026-10-05).
- **Contexto:** regra do dono do projeto (2026-10-05): "o Cortex deve fazer tudo grátis, nunca usar nada pago e sempre ter tokens disponíveis; nunca para por falta de IA". Até aqui a lista grátis era quase só a Groq (cota por minuto) e, sem cota, a execução falhava com `MODEL_UPSTREAM`.
- **Decisão:** (1) Lista grátis com vários provedores de cotas separadas, na ordem: Groq (3 modelos, cota por modelo) → GitHub Models (`openai/gpt-4.1` e `-mini`, com o próprio token do GitHub Actions, permissão `models: read`, sem cadastro) → Gemini 2.5 Flash e Flash-Lite (AI Studio) → Cloudflare Workers AI (`CLOUDFLARE_AI_TOKEN` + `CLOUDFLARE_AI_ACCOUNT_ID`, cota diária grátis) → Mistral (plano Experiment grátis) → OpenRouter só modelos `:free`. Provedor sem chave é pulado. Nenhum provedor pago entra na lista grátis (teste U4). (2) Quando todos estão sem cota ou fora do ar, a execução não falha: volta para `planned` com `WAITING_AI_QUOTA`, o passo fica `pending` e a retomada agendada (cron do Worker → `sweep`) continua do mesmo passo depois, até 9 esperas; só então falha. Erro de configuração (sem chave nenhuma, `NO_MODEL`) continua falhando na hora, porque esperar não resolve.
- **Garantia:** testes U4 (só grátis, 5+ provedores), M12 (endpoints do GitHub Models e Workers AI) e O4/O4i (sem cota: espera e continua; nada de falso sucesso).
- **Custo:** zero.
