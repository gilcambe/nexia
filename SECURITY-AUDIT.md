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
| A4 | ALTO | Dependências vulneráveis | **MITIGATED** (sem saltos maiores; restantes listadas) |
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
- Correção (`netlify/functions/sentinel.js`): sem bypass por `x-netlify-event`; `POST` exige papel admin; `heal` desligado (`SENTINEL_HEAL_ENABLED`); a gravação de overrides no Firestore e o redeploy automático foram desativados (stubs que não escrevem nada). Não há bypass substituto.
- Testes: unitário do cabeçalho; integração "cabeçalho de agendamento não dá acesso e heal fica bloqueado" e "overrides não gravam nada, mesmo com fix malicioso".

### C5 — Secrets em repositórios públicos · MITIGATED + OWNER ACTION
- No HEAD deste repo: removidos de `NEXIA_OS_MASTER_DOC_v61.md` os valores de quatro variáveis (tipos: chave web Firebase rotulada `FIREBASE_API_KEY`, chave Gemini, access token do Mercado Pago, public key do Mercado Pago) e prefixos parciais de chaves OpenAI/Groq. Correção ao relatório original: a linha que a auditoria atribuiu ao access token do Mercado Pago era a public key; o access token estava em linha adjacente, com valor parcial. Ambos foram removidos.
- Proteção nova: `.gitignore` (antes inexistente) cobre `.env*`, chaves, JSON de service account, `download`, relatórios; `.env.example` só com placeholders; `.gitleaks.toml` + job de CI que bloqueia chaves privadas, tokens, API keys, service accounts e arquivos `.env`.
- Mantido: config web pública do Firebase (`nexia-c8710`) em `bezsan/bezsan-admin.html`, `ces/ces-app-executivo.html`, `viajante-pro/vp-admin.html`. É pública por natureza (o próprio `/api/firebase-config` a entrega); removê-la quebraria as páginas legadas. Liberada no gitleaks só nesses arquivos.
- Histórico do Git: **ainda contém valores antigos** (a varredura do histórico encontrou ocorrências). Não reescrito; exige autorização explícita.
- OWNER ACTION (não executado por esta fase): rotacionar service account Firebase, Groq, Mercado Pago, Gemini e `METRICS_SECRET`; restringir a chave web por referrer e ativar App Check; decidir sobre tornar os repos privados e sobre reescrever o histórico.

### A1 — autocommit · FIXED / TESTED
- Desligado por padrão (`AUTOCOMMIT_ENABLED`); quando ligado: master, branch explícito e não protegido, caminho validado, trilha em `audit_log_global`. Teste: "autocommit desligado por padrão, mesmo para master".

### A2 — observability · FIXED / TESTED
- Exige papel admin; amostras limitadas a 1000 por caminho e 200 caminhos; entrada validada. Testes unitário e de integração.

### A3 — modo demo · FIXED / TESTED
- Removido. Sem Admin SDK inicializado, nenhum token é aceito. Teste unitário com tokens arbitrários e JWT `alg: none`.

### A4 — dependências · MITIGATED
- Antes: 36 vulnerabilidades (1 crítica, 10 altas, 23 moderadas, 2 baixas). Depois de `npm audit fix` sem `--force`: 26 (0 críticas, 9 altas, 17 moderadas); 25 considerando só produção.
- Restantes exigem versão maior: `firebase-admin` 14 (arrasta `node-forge`, `@google-cloud/*`, `google-gax`, `uuid`), `vite` 6+ (`esbuild`), SDK cliente `firebase` (arrasta `undici`, `@grpc/grpc-js`, `@firebase/*`), `react-router-dom` 7; `qs` e `gaxios` presos por faixas de `express` 4 e `google-auth-library`. `@firebase/rules-unit-testing` é só de desenvolvimento.

### A5 — erros brutos · FIXED / TESTED
- `lib/safe-error.js`: detalhe no log, cliente recebe `{ error, correlationId }`. Aplicado em `server.js`, `cortex-chat` (incluindo as mensagens de stream dos seis provedores), `cortex-agent`, `autocommit`, Sentinel. Testes unitários.

### X1 — Isolamento de tenant (mesma classe de C3) · FIXED / TESTED
- `tenant-admin`: busca por telefone só master; leitura e `checkLimit` validam tenant; `create` força dono = chamador e plano `free` para não-master; `invite` exige admin/manager do tenant e saneia o papel; `updatePlan` só master. `notifications`: só as próprias, envio para outros só admin/master. `swarm`: valida tenant. Teste: "isolamento de tenant: alice (tenant-a) não lê nem altera tenant-b".

### X2 — Catch-all das regras · FIXED / TESTED
- As regras do Firestore combinam permissões por OU; o `match /{sub=**}` do tenant liberava `cortex_memory`, cobrança, auditoria e Sentinel. Agora exclui as subcoleções com regra própria. Teste 6.

### X3 — `/api/memory` · FIXED / TESTED
- `cortex-memory.js` usava `assertTenantAccess` sem importar e respondia 500 sempre. Import adicionado; coberto pelos testes de operação legítima.

## Riscos remanescentes
- Credenciais expostas continuam válidas até o dono rotacionar; histórico público ainda contém valores.
- Correções só valem em produção depois de deploy e publicação das regras, que não fazem parte desta fase.
- Telas legadas que gravavam `role`/`tenantSlug` pelo cliente passam a receber "permission denied" quando as regras forem publicadas (comportamento desejado, mas pode exigir ajuste de fluxo).
- `swarm` ainda usa `tenantId` padrão `nexia` quando o corpo não informa; agora o acesso é validado contra o tenant do usuário, mas o padrão deve ser removido numa fase futura.
- `sentinel-iot` (`/api/sentinel`) exige login, mas não valida o tenant nem papel; revisar na Fase 6 (Policy Engine).
- Coleções `usage` e `audit_log` ainda aceitam escrita de membros (B1).
- M1, M3, M4, M5, M6 abertos.
- Outras funções podem ainda devolver `e.message` em caminhos não cobertos; as tratadas estão listadas acima.
- O Render roda `npm install` (instala também devDependencies); considerar `npm ci --omit=dev` numa fase de infraestrutura.
