# SECURITY-AUDIT.md — Auditoria de segurança e status da Fase 1

Auditoria original: 02/10/2026 (somente leitura, testes de exploração só em servidor local). Status atualizado na Fase 1, branch `nexia-ai/fase-1`, base `develop` @ `46fe332`.

**Nenhum valor de secret aparece neste documento.** Secrets são citados por arquivo, tipo e localização.

Legenda de status: **FIXED / TESTED** (corrigido no código e coberto por teste automatizado), **MITIGATED** (risco reduzido, pendência registrada), **OPEN** (não tratado nesta fase), **OWNER ACTION** (só o dono das contas resolve).

> Importante: as correções estão no repositório, **não em produção**. Esta fase não fez deploy. As regras do Firestore (`firestore.rules`) só passam a valer depois de publicadas manualmente no projeto `nexia-c8710`.

## Resumo

| ID | Severidade | Achado | Status |
|---|---|---|---|
| C1 | CRÍTICO | Path traversal / leitura de arquivos no `server.js` | **FIXED / TESTED** |
| C2 | CRÍTICO | Usuário vira `master` ou troca de tenant pelas regras do Firestore | **FIXED / TESTED** (no repo; publicação das regras pendente) |
| C3 | CRÍTICO | Promoção automática a `master` no backend | **FIXED / TESTED** |
| C4 | CRÍTICO | Sentinel heal grava no Firestore via LLM e bypass por cabeçalho | **FIXED / TESTED** |
| C5 | CRÍTICO | Secrets reais em repositórios públicos | **MITIGATED** no HEAD + varredura no CI; **OWNER ACTION** (rotação, histórico) |
| A1 | ALTO | `autocommit` grava direto em `main` | **FIXED / TESTED** (desligado por flag na Fase 1; **removido** na Fase 8) |
| A2 | ALTO | `observability` sem auth e sem limite de memória | **FIXED / TESTED** |
| A3 | ALTO | Modo demo de autenticação | **FIXED / TESTED** |
| A4 | ALTO | Dependências vulneráveis | **MITIGATED** (0 críticas; 8 altas só com versão maior, listadas) |
| A5 | ALTO | Erro bruto de provedor/exceção repassado ao cliente | **FIXED / TESTED** |
| M1 | MÉDIO | CORS cai para `*` | OPEN |
| M2 | MÉDIO | Memória do Cortex legível por todo o tenant | **FIXED / TESTED** (regras) |
| M3 | MÉDIO | Filtro de prompt injection por regex | OPEN |
| M4 | MÉDIO | Rate limit fail-open e em memória | OPEN |
| M5 | MÉDIO | Build executado no boot | OPEN (o build no boot agora só roda quando `server.js` é o processo principal) |
| M6 | MÉDIO | Sem cabeçalhos de segurança | OPEN |
| B1 | BAIXO | `audit_log` aceita escrita de membros | OPEN |
| X1 | ALTO | Isolamento de tenant em endpoints (achado na Fase 1) | **FIXED / TESTED** |
| X2 | ALTO | Catch-all das regras afrouxava subcoleções restritas (achado na Fase 1) | **FIXED / TESTED** |
| X3 | MÉDIO | `/api/memory` sempre 500 (import ausente) (achado na Fase 1) | **FIXED / TESTED** |

## Detalhe por achado

### C1 — Path traversal · FIXED / TESTED
- Antes: `server.js` juntava o caminho da URL com a raiz do repo e servia código-fonte, `.env*` e arquivos do sistema.
- Correção: `lib/safe-static.js` valida o caminho **resolvido e canônico** (`path.resolve` + `realpath`, inclusive symlinks) dentro de raízes públicas explícitas (`out/`, `core`, `ces`, `bezsan`, `splash`, `viajante-pro`); rejeita `%2f`/`%5c`, `\`, byte nulo, codificação dupla e segmentos com ponto; allowlist de extensões; só `GET`/`HEAD`; sem fallback para a raiz do repositório. Não é um filtro textual de `..`.
- Testes: `tests/unit/safe-static.test.js` (2), `tests/unit/server-static.test.js` (2: dezenas de variações de ataque, `.env`/`.env.local` plantados, symlink para fora, páginas legítimas continuam 200), Playwright `Segurança — Fase 1`.

### C2 — Escalada pelas regras do Firestore · FIXED / TESTED
- Correção: `firestore.rules` (trazido do `READDY` e endurecido). O usuário não altera `role`, `tenantSlug`, `tenant`, `plan`, `email`, `uid`, `permissions`, `isAdmin`, `isMaster`, `customClaims`, `claims`; perfil novo só como `role: user` / `tenantSlug: guest`; tenant criado/apagado só por master; admin de tenant não altera campos de cobrança/estado.
- Testes no emulador (`tests/integration/firestore-rules.test.js`): (1) usuário não altera `role`; (2) não altera `tenantSlug` nem outros campos de privilégio; (2b) perfil novo não nasce privilegiado; (3) membro não acessa memória/dados de outro tenant nem memória de colegas; (3b) admin de tenant não altera plano; (4) operações legítimas continuam; (5) master legítimo mantém acesso; (6) catch-all não afrouxa subcoleções. Contra as regras originais do `READDY`, 6 de 8 falham, o que mostra que os testes detectam as falhas.
- Pendência: publicar as regras (ação manual, fora desta fase).

### C3 — Promoção automática a master · FIXED / TESTED
- Correção (`netlify/functions/middleware.js`): removidos o padrão de `MASTER_EMAIL`, a promoção por tenant `nexia` e o auto-reparo guest → nexia; `MASTER_EMAIL` exige `email_verified`; papel de `members` limitado a papéis de tenant; validação de tenant fail-closed sem Firestore. Também removidos bypasses `tenantSlug === 'nexia'` em `payment-engine.js`; `core/auth.js` cria perfil como `guest`.
- Testes: `tests/unit/auth-guards.test.js` (`resolveRole`) e `tests/integration/api-authz.test.js` (3 testes C3 com tokens reais do Auth Emulator).

### C4 — Sentinel heal · FIXED / TESTED
- Correção (`netlify/functions/sentinel.js`): sem bypass por `x-netlify-event`; `POST` exige papel admin; `heal` desligado (`SENTINEL_HEAL_ENABLED`); a aplicação de overrides do LLM no Firestore e o redeploy automático foram desativados (funções que não escrevem nem chamam rede; `RENDER_DEPLOY_HOOK` não é mais lido); removidos o auto-heal do scan, a variável `isScheduled` e o "modo demo" do GET (sem DB → 503). Não há bypass substituto.
- Com `SENTINEL_HEAL_ENABLED=true` o heal ainda: chama o LLM para diagnóstico; abre issue no GitHub se `GITHUB_TOKEN`/`GITHUB_REPO` existirem; grava o relatório em `sentinel_heals` e `system_status/last_heal` (coleções fixas, conteúdo inclui o texto do diagnóstico). Fluxo completo em `PHASE-1-REPORT.md` §6.
- Testes: unitário do cabeçalho; integração "cabeçalho de agendamento não dá acesso e heal fica bloqueado", "overrides não gravam nada, mesmo com fix malicioso" e "heal LIGADO não aplica override do LLM nem chama o Deploy Hook" (com mock do LLM devolvendo overrides para `users` e `tenants`; prova de mutação: falha se a gravação antiga voltar).

### C5 — Secrets em repositórios públicos · MITIGATED + OWNER ACTION
- No HEAD deste repo: removidos de `NEXIA_OS_MASTER_DOC_v61.md` os valores de quatro variáveis (tipos: chave web Firebase rotulada `FIREBASE_API_KEY`, chave Gemini, access token do Mercado Pago, public key do Mercado Pago) e prefixos parciais de chaves OpenAI/Groq. Correção ao relatório original: a linha que a auditoria atribuiu ao access token do Mercado Pago era a public key; o access token estava em linha adjacente, com valor parcial. Ambos foram removidos.
- Proteção nova: `.gitignore` (antes inexistente) cobre `.env*`, chaves, JSON de service account, `download`, relatórios; `.env.example` só com placeholders; `.gitleaks.toml` + job de CI que bloqueia chaves privadas, tokens, API keys, service accounts e arquivos `.env`.
- Mantido: config web pública do Firebase (`nexia-c8710`) em `bezsan/bezsan-admin.html`, `ces/ces-app-executivo.html`, `viajante-pro/vp-admin.html`. É pública por natureza (o próprio `/api/firebase-config` a entrega); removê-la quebraria as páginas legadas. Liberada no gitleaks só nesses arquivos.
- Histórico do Git: **ainda contém valores antigos** (a varredura do histórico encontrou ocorrências). Não reescrito; exige autorização explícita.
- **PENDÊNCIA DO DONO — chave web do Firebase:** as três chaves `AIza…` em `bezsan/bezsan-admin.html`, `ces/ces-app-executivo.html` e `viajante-pro/vp-admin.html` foram mantidas e estão na allowlist do gitleaks só nesses arquivos. A proteção delas depende de duas ações no console, **não executadas nesta fase**: (1) restringir a chave por HTTP referrer (domínios do app) e por API no Google Cloud; (2) ativar o Firebase App Check para Firestore/Storage/Auth.
- Verificação do HEAD por `git grep`: nenhuma chave privada, `"private_key"`, service account JSON/base64, token Mercado Pago, Groq, OpenAI/Anthropic, GitHub, Slack ou AWS; únicos `AIza…` são as três chaves acima; único arquivo `.env*` é `.env.example`. Saída em `PHASE-1-REPORT.md` §10.
- OWNER ACTION (não executado por esta fase): rotacionar service account Firebase, Groq, Mercado Pago, Gemini e `METRICS_SECRET`; restrição por referrer + App Check (acima); decidir sobre tornar os repos privados e sobre reescrever o histórico.

### A1 — autocommit · FIXED / TESTED
- Desligado por padrão (`AUTOCOMMIT_ENABLED`); quando ligado: master, branch explícito e não protegido, caminho validado, trilha em `audit_log_global`. Teste: "autocommit desligado por padrão, mesmo para master".

### A2 — observability · FIXED / TESTED
- Exige papel admin; amostras limitadas a 1000 por caminho e 200 caminhos; entrada validada. Testes unitário e de integração.
- Nenhum emissor de POST no repositório (`server.js`, `src/`, `core/`, HTMLs de tenant); o SPA define `api.observe()` (GET) sem chamadas. Nenhum fluxo legítimo quebra. Evidência em `PHASE-1-REPORT.md` §8.

### A3 — modo demo · FIXED / TESTED
- Removido. Sem Admin SDK inicializado, nenhum token é aceito. Teste unitário com tokens arbitrários e JWT `alg: none`.

### A4 — dependências · MITIGATED
- Antes: 36 vulnerabilidades (1 crítica, 10 altas, 23 moderadas, 2 baixas). Depois de `npm audit fix` sem `--force` e `express` 4.22.1 → 4.22.3 (patch, corrige `qs`): `npm audit --omit=dev` = 24 (0 críticas, 8 altas, 16 moderadas); com dev = 25.
- Altas restantes, todas só com versão maior: `firebase-admin` (→14), `node-forge` (1.4.0 é a última publicada e segue afetada), SDK cliente `firebase` e `@firebase/firestore(-compat)`, `@grpc/grpc-js`, `undici` (fixados pelo SDK 10), `vite` (→8; falhas do servidor de desenvolvimento). Tabela em `PHASE-1-REPORT.md` §7. `@firebase/rules-unit-testing` é só de desenvolvimento.

### A5 — erros brutos · FIXED / TESTED
- `lib/safe-error.js`: detalhe no log, cliente recebe `{ error, correlationId }`. Aplicado em `server.js`, `cortex-chat` (incluindo as mensagens de stream dos seis provedores), `cortex-agent`, `autocommit`, Sentinel. Testes unitários.

### X1 — Isolamento de tenant (mesma classe de C3) · FIXED / TESTED
- `tenant-admin`: busca por telefone só master; leitura e `checkLimit` validam tenant; `create` força dono = chamador e plano `free` para não-master; `invite` exige admin/manager do tenant e saneia o papel; `updatePlan` só master. `notifications`: só as próprias, envio para outros só admin/master. `swarm`: valida tenant. Teste: "isolamento de tenant: alice (tenant-a) não lê nem altera tenant-b".

### X2 — Catch-all das regras · FIXED / TESTED
- As regras do Firestore combinam permissões por OU; o `match /{sub=**}` do tenant liberava `cortex_memory`, cobrança, auditoria e Sentinel. Agora exclui as subcoleções com regra própria. Teste 6.

### X3 — `/api/memory` · FIXED / TESTED
- `cortex-memory.js` usava `assertTenantAccess` sem importar e respondia 500 sempre. Import adicionado; coberto pelos testes de operação legítima.

## Fase 2 — Vault (`vault_*`)

Nenhum achado anterior mudou de status. A Fase 2 acrescenta superfície nova, coberta assim:

| ID | Tema | Controle | Teste |
|---|---|---|---|
| V1 | Secret gravado no Vault (spec §15) | `secret_refs` só com nome/store/ref; `detectSecret` em todo texto de todas as entidades; erro sem valor | `tests/unit/vault-schemas.test.js` (9 tipos × 3 campos); `tests/integration/vault-repository.test.js` teste 12 |
| V2 | Escrita do Vault pelo cliente | `allow write: if false` em `vault_*` | `tests/integration/vault-rules.test.js` V4 (usuário, admin e master negados) |
| V3 | Leitura por usuário comum / entre tenants | leitura só master ou admin do próprio tenant; consulta sem filtro de tenant negada | V1, V2, V3 |
| V4 | Coleções internas expostas | `vault_idempotency` e `vault_unique` sem leitura | V5 |
| V5 | Acesso cruzado na camada de servidor | `tenant_id` conferido em toda leitura/escrita; outro tenant = `NOT_FOUND`; referências de outro tenant rejeitadas | `vault-repository` testes 5 e 13 |
| V6 | Vazamento por auditoria/log | auditoria só com nomes de campo, versão e hash; chave de idempotência só como hash | `vault-repository` testes 9 e 11 |

As regras `vault_*` seguem **não publicadas**, como as da Fase 1. Com mutação das regras (leitura liberada a qualquer autenticado e escrita liberada), 4 dos 6 testes de regras do Vault falham (saída em `PHASE-2-REPORT.md`).

## Fase 3 — API `/api/nexia/*` e onboarding

| ID | Tema | Controle | Teste |
|---|---|---|---|
| N1 | Acesso à API do Vault | token Firebase obrigatório; master ou admin do próprio tenant; outros 403 | `tests/integration/nexia-api.test.js` A1; Playwright "NEXIA AI — Fase 3" (401 sem token) |
| N2 | Acesso entre tenants pela API | admin não escolhe tenant; id de outro tenant → 404 | A1, A5 |
| N3 | Escrita concorrente/repetida | `If-Match` obrigatório, `Idempotency-Key` | A2 |
| N4 | Secret enviado pela API | 422 sem ecoar o valor | A3 |
| N5 | Onboarding lendo arquivos sensíveis | fonte nunca lê `.env*`, `*.pem`, `*.key`, JSON de service account; só nomes de `.env.example` | `tests/unit/onboarding-detect.test.js` |
| N6 | SSRF/injeção no onboarding | owner/repo/ref validados por regex antes de qualquer chamada; host fixo `api.github.com` | unitário "fonte GitHub: valida owner/repo/ref" |

## Fase 5 — Model Router

| ID | Tema | Controle | Teste |
|---|---|---|---|
| R1 | Chave de API na URL (Gemini) | chave no header `x-goog-api-key`; URL sem `key=` | `tests/unit/model-router.test.js` M5 |
| R2 | Chamada sem chave configurada | `NO_API_KEY` antes de qualquer requisição de rede | M6 |
| R3 | Vazamento de erro do provedor ao cliente | `ModelError` com mensagem curta (provedor + status); trecho do corpo só em `details.upstream`, nunca no SSE | M7; `tests/integration/cortex-stream.test.js` S4 |
| R4 | Chamada que continua depois que o cliente sai | `writeStream` encerra o iterador no `close`, o que aborta a chamada ao provedor | M10 |
| R5 | Dependência nova | `@anthropic-ai/sdk` com versão exata (0.131.0) no `package.json` e `package-lock.json` | CI (`npm ci`) |
| R6 | Saída estruturada sem validação | `structuredOutput` valida contra o schema e falha com `INVALID_OUTPUT` | M8 |

## Fase 6 — Tool Gateway e Policy Engine

| ID | Tema | Controle | Teste |
|---|---|---|---|
| T1 | Ferramenta sem risco declarado ou desconhecida | registro valida nome e risco; desconhecida → `UNKNOWN_TOOL`/`forbidden` | `tests/unit/policy-engine.test.js` P3; `tests/integration/tool-gateway.test.js` G2 |
| T2 | Ação de risco sem confirmação | matriz risco × autonomia × ambiente; CRITICAL e produção sempre pedem pessoa | P1, P2, P4 |
| T3 | Agente aprovando a própria ação | aprovação só por ator `user`; master/admin do tenant na API | G3, G8 |
| T4 | Execução dupla da mesma aprovação | `If-Match` + versão do `ToolCall`; segunda aprovação → `NOT_PENDING` | G3, G8 |
| T5 | Ferramenta lendo dados de outro projeto | escopo por projeto em `vault.*`; GitHub só no repositório cadastrado do projeto | G2, G7 |
| T6 | Entrada sensível gravada no log | Vault guarda só resumo + hash; entrada completa só na fila do servidor, apagada ao decidir | G3, G9 |
| T7 | Política alterada depois do pedido | reavaliação na aprovação; proibida → rejeitada sem executar | G5 |
| T8 | Forjar registro de chamada | `tool-calls` só leitura na API; `vault_tool_calls` sem escrita pelo cliente | G8, G9 |
| T9 | Path traversal no `ref` do GitHub | `ref` validado (sem `..`) e codificado por segmento | G7 |

## Fase 7 — NEXIA Bridge (máquina local)

| ID | Tema | Controle | Teste |
|---|---|---|---|
| L1 | Path traversal (`..`, absoluto fora, UNC, drive relativo, byte nulo) | `resolveInRoots` contra as raízes do projeto | `tests/unit/bridge.test.js` W1 |
| L2 | Symlink para fora do workspace | `realpath` do alvo (ou do ancestral existente) tem que estar dentro da raiz | W2 |
| L3 | `.env`/credenciais enviados ao modelo | arquivos sensíveis nunca lidos, listados com marca, nem escritos, nem commitados; secrets em arquivo comum redigidos | W3, W9 |
| L4 | Comando perigoso ou deploy pelo terminal | sem shell; classes read/test/write/dangerous/denied; deploy, privilégio e shell bloqueados ou com pessoa | W4, W8 |
| L5 | Modelo aprovando a própria operação | elicitation ou código só no stderr do Bridge; pedido amarrado ao hash da operação, uso único, 15 min | W6, W12 |
| L6 | Secrets no ambiente dos comandos | `childEnv` remove variáveis com nome de segredo | W8 |
| L7 | Workspace amplo demais | config recusa raiz do disco, pasta do usuário e ancestrais, caminho relativo, `stateDir` dentro do workspace | W11 |
| L8 | Operação sem rastro | log JSONL de cada chamada (agente, comando, pasta, resultado), sem conteúdo | W10 |
| L9 | Commit parcial com arquivo sensível | stage inteiro é limpo e nada é commitado | W9 |

Risco aceito: se o mesmo cliente tiver terminal livre na máquina (Bash do Claude Code sem restrição), o modelo poderia ler o stderr do Bridge nos logs de MCP do cliente e o próprio `stateDir`. As garantias do Bridge valem para o acesso feito **pelo Bridge**; o README orienta negar esses caminhos nas permissões do Claude Code ou usar o Claude Desktop.

## Fase 8 — GitHub Adapter

| ID | Tema | Controle | Teste |
|---|---|---|---|
| H1 | Credencial ampla/longa para escrever | escrita só com GitHub App; token de instalação de 1 h restrito ao repositório e à permissão da operação | `tests/unit/github-adapter.test.js` H1, H2; `tests/integration/github-tools.test.js` GH5 |
| H2 | Agente escrevendo na branch padrão/protegida | só `nexia/...`, nunca a padrão; commit sem force; SHA esperado | H3, H4; GH3 |
| H3 | Escrita sem autonomia | risco + autonomia mínima por ferramenta; abaixo disso, aprovação humana; produção sempre pede pessoa | GH1, GH2, GH4 |
| H4 | `.env`/secret no repositório ou enviado ao modelo | arquivos sensíveis bloqueados na leitura e no commit; conteúdo, mensagem e PR com secret recusados; leitura e diff redigidos | H5; GH3 |
| H5 | Deploy disparado por agente | `dispatch_workflow` recusa workflow/input de deploy ou produção e branch fora de `nexia/`/padrão | H7; GH3 |
| H6 | Conteúdo de código no log de auditoria | Vault guarda só caminhos e hash; conteúdo só na fila do servidor até a decisão | GH2 |
| H7 | Vazamento de token/chave em erro | erros com mensagem fixa ou mensagem curta e filtrada do GitHub | H8 |
| H8 | Endpoint legado de commit | `autocommit` removido | `api-authz` A1/Fase 8; e2e Fase 8 |

## Fase 9 — CI/CD, Firebase e Cloudflare

| ID | Tema | Controle | Teste |
|---|---|---|---|
| D1 | Deploy improvisado pelo agente | deploy só pelo pipeline do Actions; `deploy.staging` dispara o workflow, produção não tem ferramenta nesta fase | `tests/integration/deploy-tools.test.js` D4 |
| D2 | Staging sem autonomia | `deploy.staging` HIGH nível 4; nível 3 vai para aprovação; dispatch genérico do pipeline proibido | D4; `github-adapter` H7 |
| D3 | Produção sem pessoa | job de produção no environment `production` (revisores no GitHub) e só por `target=production` manual | `cicd-integrations` C1 |
| D4 | Credencial de outro tenant | nome `NEXIA_<PROVEDOR>_<TENANT>_*` obrigatório; `SCOPE` antes de chamar o provedor | C5; D2 |
| D5 | Credencial com escrita | Firebase com escopos só de leitura; adapters sem método de escrita | C3 |
| D6 | Segredo no pipeline gerado | segredos só como `${{ secrets.* }}` do environment; Firebase por OIDC; entradas do gerador validadas (sem injeção em `run`) | C1, C2 |
| D7 | Dado sensível no DNS | conteúdo de TXT omitido | C4 |
| D8 | Registro de deploy perdido | `Deployment.release` (antes colidia com o metadado `version`) | D4; `vault-schemas` |

## Fase 10 — Orchestrator, agentes e gates

| ID | Tema | Controle | Teste |
|---|---|---|---|
| O1 | Agente se dá mais poder | cada agente só vê as ferramentas da sua lista (Architect, Reviewer e Security só leitura; só o DevOps abre PR e dispara staging; nenhum tem produção nem terminal local); o Policy Engine decide cada chamada | `tests/unit/orchestrator.test.js` U4; `tests/integration/orchestrator.test.js` O1 |
| O2 | Falso sucesso | `succeeded` só com gates verdes por evidência de ferramenta; agente que diz "feito" sem commit falha com `NO_CHANGES`; revisão reprovada não abre PR | U2; O1, O4 |
| O3 | Ação sem pessoa | ações acima da autonomia do projeto ficam em `/aprovacoes`; `resume` só segue com a `ToolCall` aprovada e executada; rejeição termina a execução | O3, O4 |
| O4 | Produção pelo Orchestrator | intenção de produção não executa nada (`needs_input`, gate 11 pendente) | O6 |
| O5 | Custo descontrolado | orçamento por execução (passos, ferramentas, tokens, tempo) | U3; O5 |
| O6 | Projeto errado | pedido ambíguo pergunta e não cria execução | O2 |
| O7 | Acesso à API | `/api/nexia/executions` exige login, master ou admin do próprio tenant | O8; E2E Fase 10 |
| O8 | Conteúdo de arquivo instruindo o modelo | ferramentas restritas por agente + política + verificação pela ferramenta (ADR-F10-04) | O1, O4 |

## Fase 11 — Produção com aprovação, observabilidade e aceitação

| ID | Tema | Controle | Teste |
|---|---|---|---|
| P1 | Produção sem pessoa | `deploy.production` CRITICAL (sempre fila, em qualquer autonomia); executa só com ator pessoa; agente que pede vai para a fila | `acceptance` G1, G2; `orchestrator` O6 |
| P2 | Commit não validado em produção | exige `Deployment` de staging `succeeded` do mesmo SHA; `expectedSha` no dispatch | G1; `github-adapter` H9 |
| P3 | Produção por outro caminho | adapter só aceita `target=production` com `allowProduction` (só a ferramenta passa); `dispatch_workflow` continua recusando o pipeline e inputs de deploy | H7, H9 |
| P4 | Status trocado entre staging e produção | `run-name` com alvo e filtro por alvo no `sync_status` | H9; C6 |
| P5 | Gate 11 sem evidência | passa só com `approved_by` de pessoa e deploy concluído | U2 |
| P6 | Auditoria incompleta | métricas e trilha vêm só do Vault; nenhum conteúdo de entrada exposto | O9; Observabilidade |
| P7 | Integração inventada | onboarding cria `pending` sem credencial; não altera existentes | E |
| P8 | Ação de terceiro trocada (supply chain) | `action_pins` por SHA validado | C6 |

## Hospedagem — Cloudflare + Firebase + GitHub, sem Render (ADR-HOST-01)

| ID | Tema | Controle | Teste |
|---|---|---|---|
| H1 | Endereço de terceiro fixo no código | removido `nexia-os.onrender.com` do frontend, `server.js`, Sentinel, `index.html` e CES; API no mesmo endereço do site | `cloudflare-host` CF2 |
| H2 | CORS aberto por padrão | sem `NEXIA_APP_URL`, nenhuma outra origem é liberada (antes caía em `nexia-os.onrender.com`; lista vazia liberava `*`) | E2E (mesma origem) |
| H3 | Deploy acidental | workflow `Deploy Cloudflare` só manual, exige digitar `DEPLOY` e o environment `production` com revisor; roda `npm test` antes | CF2 |
| H4 | Segredo no repositório ou na imagem | segredos só como secrets do Worker, passados ao container em tempo de execução; `.dockerignore` exclui `.env*`, testes e Bridge; imagem sem devDependencies | CF1; gitleaks |
| H5 | Processo como root | container roda como usuário `node` | revisão do `Dockerfile` |

## Riscos remanescentes
- Credenciais expostas continuam válidas até o dono rotacionar; histórico público ainda contém valores.
- Correções só valem em produção depois de deploy e publicação das regras, que não fazem parte desta fase.
- Telas legadas que gravavam `role`/`tenantSlug` pelo cliente passam a receber "permission denied" quando as regras forem publicadas (comportamento desejado, mas pode exigir ajuste de fluxo).
- `swarm` ainda usa `tenantId` padrão `nexia` quando o corpo não informa; agora o acesso é validado contra o tenant do usuário, mas o padrão deve ser removido numa fase futura.
- `sentinel-iot` (`/api/sentinel`) exige login, mas não valida o tenant nem papel; revisar na Fase 6 (Policy Engine).
- Coleções `usage` e `audit_log` ainda aceitam escrita de membros (B1).
- M1, M3, M4, M5, M6 abertos.
- Vault: `detectSecret` é heurístico; um formato de secret desconhecido e de baixa entropia pode passar. A defesa principal é o schema não ter campo de valor.
- Outras funções podem ainda devolver `e.message` em caminhos não cobertos; as tratadas estão listadas acima.
- Orchestrator: execução em segundo plano no próprio processo; retomada só sob demanda (ADR-F11-03). Gates por nome de check quando o projeto não tem `qa_checks` (ADR-F11-04).
- Pipeline modelo com ações na major até o dono informar os SHAs (ADR-F11-05).
- Hospedagem (ADR-HOST-01): chave de serviço do Firebase como segredo do Worker; uma instância só do container. Render removido (o item antigo sobre `npm install` no Render deixa de valer; a imagem usa `npm ci --omit=dev`).
- Bridge: com terminal livre no mesmo cliente, a aprovação local pode ser contornada (ver Fase 7); log local ainda não vai ao Vault.
- GitHub: leitura ainda usa o `GITHUB_TOKEN` legado até a GitHub App ser criada (ADR-F8-01); bloqueio de workflow de deploy por nome é heurístico até a Fase 9.
- Pipeline modelo: ações fixadas por versão major, não por SHA (ADR-F9-01); bloqueio de workflow de deploy no dispatch genérico continua heurístico para workflows que não são o modelo.
