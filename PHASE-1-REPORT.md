# PHASE-1-REPORT.md — Fase 1: contenção de segurança e baseline

Repositório `gilcambe/nexia`, branch `nexia-ai/fase-1`, base `develop` @ `46fe332f549f2313bc215dd7d769b34f50483896`. **Sem deploy.** Fases 2 a 11 não implementadas.

Revisão 2 (após auditoria do PR #1): suíte original do READDY trazida inteira e checada contra o develop no CI, fluxo do Sentinel heal com a flag ligada testado, limpeza do Sentinel, `express` 4.22.3 (corrige `qs`), evidências de secrets/observability e tentativa de tag.

## 1. Estado inicial (baseline)
- Node 22.22.0 / npm 10.9.4 local (Render e CI usam Node 20).
- `tsc --noEmit`: OK. `vite build`: OK. Não havia testes, CI, `.gitignore`, `firestore.rules` nem `firebase.json` neste repositório.
- `npm audit` (com dev): 36 vulnerabilidades (1 crítica, 10 altas, 23 moderadas, 2 baixas).
- Backup lógico: branch `backup/pre-nexia-ai` publicada em `46fe332`. **A tag `pre-nexia-ai` NÃO existe no GitHub** (seção 9). O critério de saída "tag criada" **não está atendido**.

## 2. O que mudou
| Área | Mudança |
|---|---|
| C1 | `lib/safe-static.js` + `server.js`: estáticos só de raízes públicas, caminho canônico validado (`path.resolve` + `realpath`), symlinks resolvidos, allowlist de extensões, só GET/HEAD. `.html` inexistente cai no `index.html` do SPA, como antes (nunca serve o arquivo pedido) |
| C2 / M2 | `firestore.rules` endurecidas; `core/auth.js` cria perfil `guest` |
| C3 | `middleware.js`: sem promoções automáticas; `MASTER_EMAIL` sem padrão e com e-mail verificado; papel de membro limitado; fail-closed |
| C4 | `sentinel.js`: sem bypass por cabeçalho; POST exige admin; heal só com flag; sem override no Firestore; Deploy Hook não é mais lido nem chamado; sem auto-heal no scan; sem "modo demo" (GET sem DB → 503) |
| A1 | `autocommit.js`: desligado por flag; quando ligado, master + branch não protegido + caminho validado + auditoria |
| A2 | `observability.js`: exige admin, memória limitada, entrada validada |
| A3 | `middleware.js`: modo demo de autenticação removido |
| A5 | `lib/safe-error.js` com `correlationId` em `server.js`, `cortex-chat`, `cortex-agent`, `autocommit`, Sentinel |
| Isolamento | `tenant-admin`, `notifications`, `swarm`, `payment-engine`; `metrics-aggregator` com comparação em tempo constante |
| Correção funcional | `cortex-memory.js`: import ausente que fazia `/api/memory` responder 500 sempre |
| Secrets | Valores removidos do HEAD em `NEXIA_OS_MASTER_DOC_v61.md`; `.gitignore`, `.env.example`, `.gitleaks.toml` |
| READDY | `firestore.rules` (endurecido), `storage.rules` e `firestore.indexes.json` (iguais), `firebase.json` (novo, sem hosting), suíte Playwright original (89 testes, sem alteração nos testes) + suíte de regressão nova (48 testes) |
| Dependências | `npm audit fix` sem `--force` + `express` 4.22.1 → 4.22.3 (patch, corrige `qs`); devDependencies `@firebase/rules-unit-testing` e `@playwright/test` |
| CI | `.github/workflows/ci.yml`: secret scan, `npm ci`, typecheck, unitários, emulador, build, Playwright (regressão + READDY original com checagem de paridade) |

## 3. CI
Execuções no commit `373815e` (revisão 1), todos os passos com `success`:
- push: https://github.com/gilcambe/nexia/actions/runs/36951563418
- pull_request: https://github.com/gilcambe/nexia/actions/runs/36951866377

| Job / passo | push | pull_request |
|---|---|---|
| Secret scan: árvore atual | success | success |
| Secret scan: commits novos do PR | skipped (só roda em `pull_request`) | success |
| npm ci | success | success |
| Typecheck | success | success |
| Testes unitários | success (12/12) | success (12/12) |
| Firebase Emulator | success (18/18) | success (18/18) |
| Build | success | success |
| Playwright (servidor local) | success (48/48) | success (48/48) |
| Log do servidor em caso de falha | skipped (só roda se algo falhar) | skipped |

Revisão 2: no commit `f0f8233` o passo "Testes unitários" falhou (o teste novo de `.html` legado esperava `out/` compilado, e no CI os unitários rodam antes do build); corrigido em `196ffe0`, que passou com todos os passos em `success`:
- push: https://github.com/gilcambe/nexia/actions/runs/36954718605
- pull_request: https://github.com/gilcambe/nexia/actions/runs/36954723133

Contagens no log do CI (pull_request, `196ffe0`): unitários 12/12; emulador 19/19; build OK; Playwright regressão 48/48; READDY original 67 passam, 20 falham, 2 pulados, "Sem regressões em relação ao develop"; secret scan da árvore e dos commits do PR sem achados. Commits posteriores que só mudam documentação têm o CI no PR.

## 4. Testes locais da revisão 2
| Verificação | Comando | Resultado |
|---|---|---|
| Typecheck | `npm run typecheck` | OK |
| Build | `npm run build` | OK |
| Unitários e segurança | `npm test` | 12/12 |
| Firebase Emulator | `npm run test:rules` | 19/19 |
| Playwright regressão (nova) | `BASE_URL=http://127.0.0.1:<porta> npm run test:e2e` | 48/48 |
| Playwright READDY original | `BASE_URL=http://127.0.0.1:<porta> npm run test:e2e:readdy` | 67 passam, 20 falham, 2 pulados: idêntico ao develop @46fe332; 0 regressões |
| Secret scan | `gitleaks dir . --config .gitleaks.toml --redact` | 0 achados |

## 5. Playwright: mapeamento dos 89 testes do READDY
Nenhum teste foi removido. `tests/e2e/readdy-original.spec.js` é o `READDY/nexia.test.js` com o corpo dos testes idêntico (conferido por `diff`); mudou só o cabeçalho (`BASE_URL` obrigatório, sem e-mail pessoal como padrão de `TEST_EMAIL`). Os 48 testes de `tests/e2e/regression.spec.js` são **adicionais**, escritos para as rotas do v60; não substituem nenhum dos 89.

A mesma suíte original foi rodada, sem alteração, contra três servidores locais: o próprio READDY, o develop @46fe332 (antes da Fase 1) e este branch. Resultado: READDY 82/7/0, develop 67/20/2, Fase 1 67/20/2, com **o mesmo conjunto de testes** em cada estado entre develop e Fase 1. Na primeira rodada, a Fase 1 tinha 2 falhas a mais (#4 e #29: `/nexia/observability.html` passou a dar 404); a causa foi o novo 404 para caminhos com extensão, e foi corrigida (`.html` inexistente volta a cair no SPA, sem servir o arquivo pedido; teste unitário cobre).

`tests/e2e/check-readdy-parity.js` falha o CI se qualquer teste fora de `tests/e2e/readdy-known-failures.json` falhar, ou se não rodarem 89 testes. Testado com mutação: tirar um item da lista faz o comando sair com erro.

**Causa raiz das falhas conhecidas (pendência P-E2E, já existentes no develop):**
- 15 testes de UI (#30–32, #34, #38, #45–49, #67, #68 e, também falhando no READDY, #33, #35, #40): procuram as páginas HTML do READDY (`nexia/cortex.html`, `nexia/sentinel.html`, `nexia/observability.html`, ids `#btnSend`, `#inp`, `#modelSel`, `#btn-scan`, `#btn-heal`, variáveis CSS do design system e o widget de `core/nexia-theme.js`). O v60 é um SPA React sem rotas `/nexia/*`; a rota cai no NotFound do SPA. Correção possível: reescrever esses testes para as telas do SPA (`/cortex-app`, `/sentinel`) numa fase de UI, ou trazer as páginas, o que é feature e está fora da Fase 1.
- 5 testes de API (#58, #69, #70, #74, #81): sem Firebase configurado no ambiente de teste, `/api/firebase-config`, `/api/sentinel` e `/api/notifications` respondem 503 de propósito. Correção possível: rodar a suíte com projeto Firebase de teste (emulador com config web ou staging).
- 2 pulados (#39, #42): o próprio teste chama `test.skip` quando o widget de tema/idioma não existe (mesma causa da UI).

**As 10 falhas originais citadas na auditoria** (rodada de 02/10 às 00:40, 79/89 contra o READDY local, 10,3 min):
| Teste | Causa raiz | Situação hoje |
|---|---|---|
| Flow (/nexia/flow) — HTTP 200 | Não reproduziu na rodada de hoje (READDY 82/7, 2,1 min). A rodada da auditoria levou 10,3 min contra 2,1 min hoje, o que aponta para lentidão de recursos externos (CDN) naquele momento; **não comprovado** | Passa no READDY, no develop e na Fase 1 |
| Cortex: textarea #inp aceita texto | Idem (não reproduziu no READDY). No v60 falha porque a página não existe | READDY passa; develop e Fase 1 falham (P-E2E) |
| Cortex: input vazio não dispara request /api/cortex | Timeout na auditoria; não reproduziu hoje; **causa não comprovada** | Passa nos três |
| CSS var --text definida | Variável não existe no design system do READDY | Falha nos três (P-E2E) |
| CSS var --brd definida | Idem | Falha nos três (P-E2E) |
| --bg muda entre light e dark | Dark mode do READDY não altera `--bg` | Falha nos três (P-E2E) |
| GET /api/sentinel schema correto | 503 sem Firebase | Falha nos três (P-E2E) |
| GET /api/sentinel < 500 | 503 sem Firebase | Falha nos três (P-E2E) |
| GET /api/notifications < 500 | 503 sem Firebase | Falha nos três (P-E2E) |
| GET /api/observability schema | Rota não existe no `server.js` do READDY (404) | Passa no develop e na Fase 1 (a rota existe no v60; na Fase 1 responde 401 sem token, status aceito pelo teste) |

Tabela completa (¹ = uma das 10 falhas da auditoria):

| # | Grupo | Teste | READDY local | develop @46fe332 | Fase 1 | Destino |
|---|---|---|---|---|---|---|
| 1 | 1 | Login (/login) — HTTP 200, zero crash JS | passa | passa | passa | Mantido sem alteração |
| 2 | 1 | Cortex (/nexia/cortex) — HTTP 200, zero crash JS | passa | passa | passa | Mantido sem alteração |
| 3 | 1 | Sentinel (/nexia/sentinel) — HTTP 200, zero crash JS | passa | passa | passa | Mantido sem alteração |
| 4 | 1 | Observability (/nexia/observability.html) — HTTP 200, zero crash JS | passa | passa | passa | Mantido sem alteração |
| 5 | 1 | Architect (/nexia/architect) — HTTP 200, zero crash JS | passa | passa | passa | Mantido sem alteração |
| 6 | 1 | Flow (/nexia/flow) — HTTP 200, zero crash JS ¹ | passa | passa | passa | Mantido sem alteração |
| 7 | 1 | My Panel (/nexia/my-panel) — HTTP 200, zero crash JS | passa | passa | passa | Mantido sem alteração |
| 8 | 1 | Master Admin (/nexia/master-admin) — HTTP 200, zero crash JS | passa | passa | passa | Mantido sem alteração |
| 9 | 1 | Pay (/nexia/pay) — HTTP 200, zero crash JS | passa | passa | passa | Mantido sem alteração |
| 10 | 1 | Store (/nexia/store) — HTTP 200, zero crash JS | passa | passa | passa | Mantido sem alteração |
| 11 | 1 | Striker (/nexia/striker) — HTTP 200, zero crash JS | passa | passa | passa | Mantido sem alteração |
| 12 | 1 | OSINT (/nexia/osint-query) — HTTP 200, zero crash JS | passa | passa | passa | Mantido sem alteração |
| 13 | 1 | PABX (/nexia/pabx) — HTTP 200, zero crash JS | passa | passa | passa | Mantido sem alteração |
| 14 | 1 | PKI Scanner (/nexia/pki) — HTTP 200, zero crash JS | passa | passa | passa | Mantido sem alteração |
| 15 | 1 | QA Center (/nexia/qa-test-center) — HTTP 200, zero crash JS | passa | passa | passa | Mantido sem alteração |
| 16 | 1 | Social Media (/nexia/social-media) — HTTP 200, zero crash JS | passa | passa | passa | Mantido sem alteração |
| 17 | 1 | Strike Center (/nexia/strike-center) — HTTP 200, zero crash JS | passa | passa | passa | Mantido sem alteração |
| 18 | 1 | Studio (/nexia/studio) — HTTP 200, zero crash JS | passa | passa | passa | Mantido sem alteração |
| 19 | 1 | Swarm Control (/nexia/swarm) — HTTP 200, zero crash JS | passa | passa | passa | Mantido sem alteração |
| 20 | 1 | Tenant Hub (/nexia/tenant-hub) — HTTP 200, zero crash JS | passa | passa | passa | Mantido sem alteração |
| 21 | 1 | AutoDemo (/nexia/autodemo) — HTTP 200, zero crash JS | passa | passa | passa | Mantido sem alteração |
| 22 | 2 | Login: sem erro Firebase No-App | passa | passa | passa | Mantido sem alteração |
| 23 | 2 | Login: sem erro initializeApp duplicado | passa | passa | passa | Mantido sem alteração |
| 24 | 2 | Login: credencial inválida não redireciona para app | passa | passa | passa | Mantido sem alteração |
| 25 | 2 | Login: campos vazios não submetem | passa | passa | passa | Mantido sem alteração |
| 26 | 2 | Páginas protegidas: redirecionam para login sem auth | passa | passa | passa | Mantido sem alteração |
| 27 | 3 | Cortex: fonte Inter declarada no HTML | passa | passa | passa | Mantido sem alteração |
| 28 | 3 | Sentinel: fonte Inter declarada no HTML | passa | passa | passa | Mantido sem alteração |
| 29 | 3 | Observability: fonte Inter declarada no HTML | passa | passa | passa | Mantido sem alteração |
| 30 | 3 | Cortex: sidebar .sb presente no DOM | passa | falha | falha | Mantido; falha já existente no develop (pendência P-E2E) |
| 31 | 3 | Sentinel: sidebar .sb presente no DOM | passa | falha | falha | Mantido; falha já existente no develop (pendência P-E2E) |
| 32 | 3 | CSS var --bg definida e não vazia | passa | falha | falha | Mantido; falha já existente no develop (pendência P-E2E) |
| 33 | 3 | CSS var --text definida e não vazia ¹ | falha | falha | falha | Mantido; falha já existente no develop (pendência P-E2E) |
| 34 | 3 | CSS var --c1 ou --primary definida (cor primária) | passa | falha | falha | Mantido; falha já existente no develop (pendência P-E2E) |
| 35 | 3 | CSS var --brd definida e não vazia ¹ | falha | falha | falha | Mantido; falha já existente no develop (pendência P-E2E) |
| 36 | 3 | Páginas nexia: meta viewport presente | passa | passa | passa | Mantido sem alteração |
| 37 | 3 | Remixicon CDN referenciado no Cortex | passa | passa | passa | Mantido sem alteração |
| 38 | 4 | Widget #nx-theme-widget injetado no DOM | passa | falha | falha | Mantido; falha já existente no develop (pendência P-E2E) |
| 39 | 4 | Botão toggle (#nx-toggle-theme) muda data-theme | passa | pulado | pulado | Mantido; pulado pelo próprio teste (pendência P-E2E) |
| 40 | 4 | --bg muda de valor entre light e dark ¹ | falha | falha | falha | Mantido; falha já existente no develop (pendência P-E2E) |
| 41 | 4 | Tema persiste em localStorage após setTheme | passa | passa | passa | Mantido sem alteração |
| 42 | 5 | Botões PT, EN, ES presentes no widget | passa | pulado | pulado | Mantido; pulado pelo próprio teste (pendência P-E2E) |
| 43 | 5 | Clicar EN persiste nx_lang=en | passa | passa | passa | Mantido sem alteração |
| 44 | 5 | Clicar PT persiste nx_lang=pt | passa | passa | passa | Mantido sem alteração |
| 45 | 6 | Cortex: #btnSend presente e habilitado | passa | falha | falha | Mantido; falha já existente no develop (pendência P-E2E) |
| 46 | 6 | Cortex: textarea #inp aceita texto ¹ | passa | falha | falha | Mantido; falha já existente no develop (pendência P-E2E) |
| 47 | 6 | Cortex: seletor de modelo (#modelSel) tem > 1 opção | passa | falha | falha | Mantido; falha já existente no develop (pendência P-E2E) |
| 48 | 6 | Sentinel: #btn-scan presente | passa | falha | falha | Mantido; falha já existente no develop (pendência P-E2E) |
| 49 | 6 | Sentinel: #btn-heal disabled antes do scan | passa | falha | falha | Mantido; falha já existente no develop (pendência P-E2E) |
| 50 | 6 | Sentinel: clicar Full Scan não causa crash JS | passa | passa | passa | Mantido sem alteração |
| 51 | 6 | Login: tab Register exibe formulário de cadastro | passa | passa | passa | Mantido sem alteração |
| 52 | 6 | Cortex: input vazio não dispara request /api/cortex ¹ | passa | passa | passa | Mantido sem alteração |
| 53 | 7 | POST /api/cortex não retorna 500 | passa | passa | passa | Mantido sem alteração |
| 54 | 7 | POST /api/cortex: Content-Type é JSON, nunca HTML | passa | passa | passa | Mantido sem alteração |
| 55 | 7 | POST /api/cortex 200: reply é string não vazia | passa | passa | passa | Mantido sem alteração |
| 56 | 7 | POST /api/cortex 200: resposta leva > 200ms (não é fake) | passa | passa | passa | Mantido sem alteração |
| 57 | 7 | GET /api/models retorna estrutura válida | passa | passa | passa | Mantido sem alteração |
| 58 | 8 | GET /api/sentinel schema correto ¹ | falha | falha | falha | Mantido; falha já existente no develop (pendência P-E2E) |
| 59 | 8 | Sentinel: HEALTHY exige ms reais (> 5ms) | passa | passa | passa | Mantido sem alteração |
| 60 | 8 | Sentinel: resultados ok:false têm campo error preenchido | passa | passa | passa | Mantido sem alteração |
| 61 | 8 | Sentinel: cada resultado tem ms numérico | passa | passa | passa | Mantido sem alteração |
| 62 | 8 | Sentinel: ms não são todos idênticos (anti-fake) | passa | passa | passa | Mantido sem alteração |
| 63 | 8 | Sentinel: scan leva > 500ms (real, não cached) | passa | passa | passa | Mantido sem alteração |
| 64 | 8 | POST /api/sentinel-qa payload vazio retorna 400 ou 401 | passa | passa | passa | Mantido sem alteração |
| 65 | 9 | GET /api/observability schema de métricas ¹ | falha | passa | passa | Mantido sem alteração |
| 66 | 9 | GET /api/observe (alias) responde sem 500 | passa | passa | passa | Mantido sem alteração |
| 67 | 9 | Dashboard: cards de métrica renderizados | passa | falha | falha | Mantido; falha já existente no develop (pendência P-E2E) |
| 68 | 9 | Dashboard: log panel presente | passa | falha | falha | Mantido; falha já existente no develop (pendência P-E2E) |
| 69 | 10 | GET /api/firebase-config < 500 | passa | falha | falha | Mantido; falha já existente no develop (pendência P-E2E) |
| 70 | 10 | GET /api/sentinel < 500 ¹ | falha | falha | falha | Mantido; falha já existente no develop (pendência P-E2E) |
| 71 | 10 | GET /api/observability < 500 | passa | passa | passa | Mantido sem alteração |
| 72 | 10 | GET /api/models < 500 | passa | passa | passa | Mantido sem alteração |
| 73 | 10 | GET /api/usage < 500 | passa | passa | passa | Mantido sem alteração |
| 74 | 10 | GET /api/notifications < 500 ¹ | falha | falha | falha | Mantido; falha já existente no develop (pendência P-E2E) |
| 75 | 10 | GET /api/audit < 500 | passa | passa | passa | Mantido sem alteração |
| 76 | 10 | GET /api/sentinel-qa?action=ping < 500 | passa | passa | passa | Mantido sem alteração |
| 77 | 10 | POST /api/auth retorna JSON (não HTML) | passa | passa | passa | Mantido sem alteração |
| 78 | 10 | POST /api/logs retorna JSON (não HTML) | passa | passa | passa | Mantido sem alteração |
| 79 | 10 | POST /api/events retorna JSON (não HTML) | passa | passa | passa | Mantido sem alteração |
| 80 | 10 | POST /api/tenant retorna JSON (não HTML) | passa | passa | passa | Mantido sem alteração |
| 81 | 10 | /api/firebase-config retorna apiKey e projectId | passa | falha | falha | Mantido; falha já existente no develop (pendência P-E2E) |
| 82 | 10 | /api/auth check sem token retorna authenticated:false | passa | passa | passa | Mantido sem alteração |
| 83 | 11 | Cortex reply não é hardcoded "ok/true/mock" | passa | passa | passa | Mantido sem alteração |
| 84 | 11 | Nenhuma rota GET retorna HTML quando espera JSON | passa | passa | passa | Mantido sem alteração |
| 85 | 11 | Sentinel ok:false tem status 0 ou >= 400 | passa | passa | passa | Mantido sem alteração |
| 86 | 12 | Login carrega em < 10s | passa | passa | passa | Mantido sem alteração |
| 87 | 12 | Cortex carrega em < 12s | passa | passa | passa | Mantido sem alteração |
| 88 | 12 | /api/firebase-config responde em < 3s | passa | passa | passa | Mantido sem alteração |
| 89 | 12 | /api/observability responde em < 2s | passa | passa | passa | Mantido sem alteração |

## 6. Sentinel heal com `SENTINEL_HEAL_ENABLED=true`
Fluxo de `POST /api/sentinel-qa {mode:"heal", issues:[...]}` depois da Fase 1:
1. Sem token: 401 (o cabeçalho `x-netlify-event` não muda nada). Token sem papel admin: 403.
2. Flag diferente de `true`: 403. `issues` vazio: 400.
3. Diagnóstico pelo LLM (Groq ou Anthropic), como antes.
4. `applyFirestoreOverrides`: não escreve nada; devolve `{applied: 0, disabled: true}`.
5. Issue no GitHub só se `GITHUB_TOKEN` e `GITHUB_REPO` estiverem configurados e houver fix CRITICAL (comportamento legado mantido).
6. `triggerRedeploy`: não chama rede; devolve `{triggered: false}`. `RENDER_DEPLOY_HOOK` não é mais lido pelo módulo.
7. Registro: grava o relatório em `sentinel_heals` (add) e `system_status/last_heal` (set). São coleções fixas; o conteúdo inclui o texto do diagnóstico do LLM. O comentário do código foi corrigido para dizer isso. O modo scan também grava `sentinel_reports` e `system_status/sentinel`, como antes.

Teste `C4: heal LIGADO (SENTINEL_HEAL_ENABLED=true) não aplica override do LLM nem chama o Deploy Hook` (emulador): mock do LLM devolve overrides para `users/<alice>` (`role: master`, `tenantSlug`) e `tenants/tenant-a` (`plan`); com `RENDER_DEPLOY_HOOK` definido. Verifica 200, `applied: 0`, `triggered: false`, documentos inalterados, única chamada externa a `api.groq.com`, nenhuma ao Deploy Hook, +1 documento em `sentinel_heals`. Prova de mutação: com a gravação de overrides antiga reinserida, o teste falha (`actual: 2`).

Limpeza: removidos o ramo "DB não configurado — modo demo / health DEMO" (GET autenticado sem DB → 503 `Sentinel indisponível: banco de dados não configurado.`; sem Firebase Admin o GET responde 401 `Serviço de autenticação indisponível.`), a variável `isScheduled` e o bloco de auto-heal do scan que dependia dela.

## 7. npm audit (`npm audit --omit=dev`)
Antes da Fase 1 (com dev): 36 (1 crítica, 10 altas, 23 moderadas, 2 baixas). Agora, produção: **24 (0 críticas, 8 altas, 16 moderadas)**; com dev: 25 (9 altas, a extra é `@firebase/rules-unit-testing`).

| Severidade | Pacote | Origem | Fix oferecido | Por que exige versão maior |
|---|---|---|---|---|
| high | `firebase-admin` 12.7.0 | direta | 14.5.0 | major 12 → 14 (Node e API do Admin SDK mudam) |
| high | `node-forge` 1.4.0 | `firebase-admin` | via `firebase-admin` 14 | 1.4.0 é a última versão publicada e ainda é afetada (GHSA-86w9-cpqp-85rv) |
| high | `firebase` (cliente) 10.x | direta | "9.14.0" | o npm sugere downgrade major; sem fix na linha 10 |
| high | `@firebase/firestore`, `@firebase/firestore-compat` | `firebase` | idem | idem |
| high | `@grpc/grpc-js` 1.9.16 | `@firebase/firestore` | idem | a linha 1.9 é a que o SDK 10 fixa; fix só em ≥1.13.6 |
| high | `undici` 6.19.7 | `@firebase/*` | idem | versão fixada pelo SDK 10; fix em ≥6.28.1 |
| high | `vite` 5.4.21 | direta | 8.3.2 | major 5 → 8. As falhas são do servidor de desenvolvimento; o build de produção é estático |

Moderadas restantes: `esbuild` (via vite), `react-router`/`react-router-dom` (7.x), `@google-cloud/firestore`, `@google-cloud/storage`, `google-gax`, `retry-request`, `teeny-request`, `uuid` (via `firebase-admin` 14), `@firebase/auth*`, `@firebase/functions*`, `@firebase/storage*` (via SDK cliente), `gaxios` 6.7.1 (já é a última 6.x; o npm marca fix sem major, mas não há versão 6 corrigida). Não há crítica.

## 8. Observability: emissores de POST
```
$ git grep -nE "api/(observe|observability)" -- server.js src core ces bezsan splash viajante-pro netlify index.html
netlify/functions/observability.js:2:/* GET /api/observability — real-time metrics from in-process store */
server.js:119:  '/api/observe':         'observability',
server.js:120:  '/api/observability':   'observability',
$ git grep -nE "api\.observe" -- src core
(exit 1)
```
Nenhum código do repositório envia POST para `/api/observe` ou `/api/observability`. O SPA define `api.observe()` (GET, `src/services/api.ts:217`), mas nada o chama. Nenhum fluxo legítimo depende do POST anônimo.

## 9. Tag `pre-nexia-ai`
Três caminhos tentados nesta sessão, todos bloqueados:
```
$ git push origin refs/tags/pre-nexia-ai
fatal: the remote end hung up unexpectedly
$ gh api -X POST repos/gilcambe/nexia/git/refs -f ref=refs/tags/pre-nexia-ai -f sha=46fe332f549f2313bc215dd7d769b34f50483896
gh: Write access to this GitHub API path is not permitted through this proxy. (HTTP 403)
$ gh api -X POST repos/gilcambe/nexia/releases -f tag_name=pre-nexia-ai -f target_commitish=46fe332f549f2313bc215dd7d769b34f50483896 ...
gh: Creating, editing, or deleting releases is not permitted for this session type. (HTTP 403)
```
Comando para o dono rodar:
```
git fetch origin develop && git tag pre-nexia-ai 46fe332f549f2313bc215dd7d769b34f50483896 && git push origin pre-nexia-ai
```
Depois disso a branch `backup/pre-nexia-ai` pode ser apagada. **Critério de saída da tag: NÃO atendido** até esse comando rodar.

## 10. Secrets no HEAD
`git grep --cached -c` no índice deste branch (exclui `package-lock.json`):
| Padrão | Resultado |
|---|---|
| `-----BEGIN ... PRIVATE KEY-----` / `PRIVATE KEY` | nenhum |
| `"private_key":` | nenhum |
| JSON de service account (campo `type` com valor `service_account`) | nenhum |
| service account em base64 | só `.gitleaks.toml` (é o padrão da regra, não um valor) |
| token Mercado Pago (`APP_USR-`/`TEST-`) | nenhum |
| Groq `gsk_`, OpenAI/Anthropic `sk-`, GitHub `ghp_`/`github_pat_`, Slack `xox*`, AWS `AKIA` | nenhum |
| chave web Google `AIza…` | `bezsan/bezsan-admin.html`, `ces/ces-app-executivo.html`, `viajante-pro/vp-admin.html` (1 cada; config web pública do Firebase, allowlist do gitleaks só nesses arquivos) |
| arquivos `.env*`, `.pem`, `.key`, `.p12`, service account `.json` versionados | só `.env.example` (placeholders) |

## 11. O que NÃO foi testado
- Nada em produção: nenhum teste contra `nexia-os.onrender.com`, Firebase `nexia-c8710` ou Cloudflare.
- As regras do Firestore/Storage só no emulador; **não publicadas**. `storage.rules` não tem teste automatizado.
- Playwright sem Firebase real: login, cadastro e telas autenticadas não foram exercitados de ponta a ponta; os endpoints que dependem do Firestore respondem 503 nesse ambiente.
- Chamadas reais a provedores de LLM (Claude, Groq, Gemini, OpenAI etc.): só com mock; o streaming do `cortex-chat` com erro de provedor foi verificado por leitura de código, não por teste.
- `autocommit` ligado (`AUTOCOMMIT_ENABLED=true`) escrevendo no GitHub: não exercitado (só o bloqueio por flag e as validações).
- Criação de issue no GitHub pelo Sentinel heal: não exercitada.
- Pagamentos (`payment-engine`, Mercado Pago), WhatsApp, PABX e demais integrações externas: não testados.
- Fluxos de onboarding/convite com as regras novas publicadas: não testados em navegador.
- Comportamento no Node 20 do Render: só via CI (Node 20); localmente Node 22.
- O repositório de produção `NEXIA_OS`/`NEXIA-OS` (D2) não foi visto.

## 12. Pendências (dono ou fases seguintes)
1. **Criar a tag `pre-nexia-ai`** (seção 9).
2. **Rotacionar credenciais** listadas em `SECURITY-AUDIT.md` (C5). Não foi feito automaticamente.
3. **Restringir a chave web do Firebase por referrer no Google Cloud e ativar App Check** (ação do dono).
4. **Decidir sobre o histórico do Git** (contém valores antigos). Reescrever exige autorização explícita.
5. **Restaurar masters legítimos e publicar as regras** em janela controlada (procedimento abaixo).
6. **P-E2E**: 20 falhas e 2 pulados da suíte original do READDY (seção 5), já existentes no develop.
7. Itens abertos: M1, M3, M4, M5, M6, B1; `swarm` com tenant padrão `nexia`; `sentinel-iot` sem checagem de papel/tenant; outras funções que ainda possam devolver `e.message`; Render instala devDependencies.
8. Atualizações maiores de dependência (seção 7) em fase própria.

### Procedimento manual para restaurar masters legítimos (não executado)
Depois desta fase, uma conta só é `master` por um destes caminhos, todos fora do alcance do próprio usuário:
- **Custom claim (recomendado):** com o Admin SDK e credencial rotacionada, `admin.auth().setCustomUserClaims(uid, { role: 'master' })`; o usuário precisa sair e entrar de novo.
- **Campo `users/{uid}.role = 'master'`:** editado pelo console do Firebase ou pelo Admin SDK.
- **`MASTER_EMAIL`:** definido explicitamente no ambiente do Render; só vale com e-mail verificado.

Antes de publicar as regras novas, conferir no console quem tem `role: 'master'` hoje em `users/` e remover os promovidos pelas falhas C2/C3.

## 13. Riscos remanescentes
Ver `SECURITY-AUDIT.md`, "Riscos remanescentes". O principal: até a rotação das credenciais e o deploy destas correções, a produção continua exposta aos achados originais.

## 14. Fora do escopo (não implementado)
Fases 2 a 11: estrutura `nexia-ai/`, Vault, Model Router, SDK Claude, streaming novo, Tool Gateway, Policy Engine, Bridge/MCP, GitHub App, adapters Firebase/Cloudflare, Orchestrator, agentes, deploy automático e novas funcionalidades de negócio.
