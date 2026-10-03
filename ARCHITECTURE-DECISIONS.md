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

