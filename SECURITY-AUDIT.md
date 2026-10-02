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
| A1 | ALTO | `autocommit` grava direto em `main` | **FIXED / TESTED** (desligado por flag) |
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
- Seis funções legadas e o resumo do `cortex-memory` ainda chamam provedores de IA diretamente (ADR-F5-03); migram na Fase 10.
- O Render roda `npm install` (instala também devDependencies); considerar `npm ci --omit=dev` numa fase de infraestrutura.
