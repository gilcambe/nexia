# ARCHITECTURE-DECISIONS.md — Registro de decisões (NEXIA AI)

Cada decisão tem status: **ACEITA** (em vigor neste branch), **PROPOSTA** (aguardando aprovação do dono) ou **PENDENTE** (fase futura). As decisões D1–D8 vêm do `MIGRATION-PLAN.md` da auditoria de 02/10/2026.

## Decisões de base (MIGRATION-PLAN §1)

| # | Decisão | Status |
|---|---|---|
| D1 | Repositório canônico = `gilcambe/nexia`, branch `develop` | **ACEITA** na Fase 1 (o PR da Fase 1 é aberto contra `develop`) |
| D2 | Acesso ao repositório de produção `NEXIA_OS`/`NEXIA-OS` | PENDENTE (não acessível a esta sessão) |
| D3 | Vault no Firestore `nexia-c8710`, coleções `vault_*` | PROPOSTA (Fase 2) |
| D4 | Código novo em `nexia-ai/`, rotas `/api/nexia/*` | PROPOSTA (Fase 2+). **Nada foi criado na Fase 1** |
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
