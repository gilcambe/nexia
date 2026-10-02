# PHASE-3-REPORT.md — Fase 3: cadastro e onboarding de projeto (leitura externa)

Branch `nexia-ai/fase-3`, base `develop` @ `61fcbec` (merge da Fase 2). Executada sob a delegação do dono (ADR-F3-01). Sem deploy, sem regras/índices publicados, sem credencial nova, sem escrita fora do Vault.

## Entregas

| Pedido (MIGRATION-PLAN Fase 3) | Arquivo · função | Teste |
|---|---|---|
| Endpoints `/api/nexia/clients\|projects\|repos\|environments` | `nexia-ai/api/index.js` · `createHandler`; `server.js` (rota `/api/nexia` + `require`, 4 linhas) | `tests/integration/nexia-api.test.js` A1–A5; Playwright "NEXIA AI — Fase 3" |
| Onboarding §20 em modo leitura: associa repo GitHub | `nexia-ai/onboarding/index.js` · `onboardProject`; `sources.js` · `createGithubSource` | A7 (HTTP, GitHub real: `gilcambe/nexia`) |
| Detecta stack/scripts/Firebase/Cloudflare pelos arquivos | `nexia-ai/onboarding/detect.js` · `detect` | `tests/unit/onboarding-detect.test.js` 1–3 (arquivos reais deste repositório) |
| Cria Environments, indexa docs, cria Project Snapshot | `onboardProject` | A6 (inclui repetição sem duplicar e Execution ID único por execução), A7 |
| Tela simples no SPA | `src/pages/projetos/page.tsx`, rota `/projetos` | Playwright `/projetos` (200 sem crash; sem login pede login e não chama o Vault) |
| Saída: projeto real cadastrado com snapshot, autonomia 0 | A7 cadastra `gilcambe/nexia` lendo o GitHub e lê o snapshot por `GET /projects/{id}/snapshot`; `autonomy_level` padrão 0 | A7 |

Resultado da detecção neste repositório (A6/A7): stack `node, firebase, react, typescript`; frameworks `express, i18next, playwright, react, react-router, tailwindcss, vite`; comandos `npm run dev|build`, `npm test`, `npm start`; Node `>=20`; Firebase `emulators, firestore, storage`, projeto `nexia-c8710` (config web pública nas páginas legadas); deploy `render` com `https://nexia-os.onrender.com` (`render.yaml`); CI `.github/workflows/ci.yml`; 25 nomes de variáveis do `.env.example`.

## Saídas cruas (local)

```
$ npm test
# tests 41
# pass 41
# fail 0

$ NODE_USE_ENV_PROXY=1 npm run test:rules
ok 20 - A1. autenticação e papel: sem token 401; usuário comum e manager 403; /me informa o acesso
ok 21 - A2. CRUD com ETag, If-Match, Execution ID e idempotência
ok 22 - A3. Environment: secret rejeitado (422) sem ecoar o valor; nomes de variável aceitos
ok 23 - A4. soft-delete e restore pela API; dependentes bloqueiam (409)
ok 24 - A5. isolamento: admin do tenant B não vê nem altera registros do tenant A
ok 25 - A6. onboarding (módulo, fonte local = este repositório): repo, ambiente, docs, snapshot; repetição sem duplicar
ok 26 - A7. onboarding HTTP lendo gilcambe/nexia no GitHub (projeto real cadastrado com snapshot)
# tests 62
# pass 62
# fail 0
# skipped 0

$ npm run typecheck   (sem erros)
$ npm run build       ✓ built

$ BASE_URL=http://127.0.0.1:3457 npm run test:e2e
  51 passed

$ BASE_URL=http://127.0.0.1:3457 npm run test:e2e:readdy
  67 passed, 20 failed, 2 skipped
READDY original: 89 testes, 67 passaram, 20 falharam, 2 pulados, 22 conhecidos.
Sem regressões em relação ao develop.
```

`NODE_USE_ENV_PROXY=1` só é necessário no contêiner desta sessão (saída HTTPS por proxy). No CI, A7 usa o token efêmero do Actions (`contents: read`) em `NEXIA_TEST_GITHUB_TOKEN`, aplicado só durante o teste. Pelo proxy desta sessão, um repositório inexistente volta 403 (o proxy bloqueia), então o teste aceita 404 ou 502 só quando o proxy está ligado; no CI exige 404.

## TEMPORÁRIO / limitações

| Item | Motivo | Risco | Remoção |
|---|---|---|---|
| Smoke tests do onboarding (passo 12) não executados | Fase de leitura; não há execução no workspace | Snapshot não prova que o projeto roda | Fase 7 (Bridge) / Fase 9 (CI por projeto) |
| Workspace local (passo 4) só como campo do Project | Bridge é da Fase 7 | Nenhum | Fase 7 |
| Projeto real cadastrado só no emulador | Gravar no Firestore de produção exige deploy desta versão e regras publicadas (ação do dono) | Produção não tem o cadastro ainda | Depois do deploy autorizado: `POST /api/nexia/projects/{id}/onboard` com `gilcambe/nexia` |
| Preflight CORS do `server.js` sem `PATCH`/`If-Match` | Não alterar o legado sem necessidade; SPA é mesma origem | Cliente de outra origem não consegue `PATCH` | Quando houver cliente externo |
| Repositório privado depende de `GITHUB_TOKEN` existente | Sem credencial nova (instrução) | Sem token, onboarding de repo privado retorna 502 | Fase 8 (GitHub App, D8) |

## Fora de escopo
Project Resolver, Context Engine, Model Router, Tool Gateway, Policy Engine, Bridge, GitHub App, adapters Firebase/Cloudflare, Orchestrator e agentes (fases seguintes).
