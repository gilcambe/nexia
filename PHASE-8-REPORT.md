# PHASE-8-REPORT.md — Fase 8: GitHub Adapter

Branch `nexia-ai/fase-8`, base `develop` @ `b568442`. Sem deploy, sem credencial nova, sem regras publicadas. Nenhuma escrita foi feita no GitHub real: escrita testada contra um GitHub falso em memória (`tests/fake-github.js`); leitura também contra `gilcambe/nexia` real.

## Entregas

| Pedido (MIGRATION-PLAN Fase 8 / spec §9, §13, §23) | Arquivo | Teste |
|---|---|---|
| GitHub App (JWT → token de instalação curto e restrito) | `nexia-ai/github-adapter/auth.js` | H1, H2, GH5 |
| Ler branches, arquivos, diff, histórico, issues, PRs, checks, Actions | `nexia-ai/github-adapter/index.js`; ferramentas `github.*` em `nexia-ai/tool-gateway/tools/github.js` | H5, H6; GH7 (real) |
| Criar branch, commit, push, PR | `createBranch`, `commitFiles` (Git Data API, fast-forward), `createPull` | H3, H4, H6; GH1–GH3 |
| `workflow_dispatch` (sem deploy) | `dispatchWorkflow` | H7; GH3 |
| Autonomia até nível 3 (PR) por projeto | risco + `min_autonomy` por ferramenta no Policy Engine | GH1–GH4, GH6 |
| `autocommit` legado substituído e removido com registro | ADR-F8-03; `netlify/functions/autocommit.js` e rota apagados | `api-authz` A1/Fase 8; e2e Fase 8 |
| Filtro de `.env`/secret | `nexia-ai/github-adapter/guards.js` | H5; GH3 |

Autonomia por ferramenta: leitura LOW (sempre automática); `create_branch` MEDIUM nível 2; `commit_files` HIGH nível 2; `create_pr` e `dispatch_workflow` HIGH nível 3. Produção sempre pede pessoa.

## Saídas cruas (local)

```
$ node --test tests/unit/github-adapter.test.js
ok 1 - H1. GitHub App: JWT RS256 assinado, token de instalação restrito ao repositório e às permissões da operação, com cache
ok 2 - H2. sem GitHub App: leitura com GITHUB_TOKEN legado ou anônima; escrita recusada
ok 3 - H3. branch: só "nexia/...", nunca a padrão, nome validado, sem sobrescrever
ok 4 - H4. commit: um commit fast-forward com vários arquivos, só em "nexia/...", com SHA esperado
ok 5 - H5. arquivos sensíveis e secrets: nunca lidos nem commitados; leitura redige
ok 6 - H6. PR: de "nexia/..." para a padrão, rascunho por padrão; head inválido recusado
ok 7 - H7. workflow_dispatch: CI sim; deploy, produção e branch qualquer não
ok 8 - H8. erros não vazam token, chave nem corpo da requisição
# tests 8
# pass 8
# fail 0

$ npm test
# tests 83
# pass 83
# fail 0

$ NODE_USE_ENV_PROXY=1 npm run test:rules
ok 1 - C3: guest não é promovido ao chamar o tenant nexia (sem auto-reparo)
ok 2 - C3: pertencer ao tenant nexia, e-mail admin@nexia.com sem verificação ou papel master em members não dão master
ok 3 - C3: MASTER_EMAIL só vale com e-mail verificado
ok 4 - A1 / Fase 8: o autocommit legado foi removido (escrita no GitHub só pelo Tool Gateway)
ok 23 - GH1. autonomia 0: leitura roda; criar branch e commit vão para aprovação e só executam com pessoa
ok 24 - GH2. autonomia 2: branch e commit automáticos; PR ainda pede pessoa; conteúdo do commit não vai para o Vault
ok 25 - GH3. autonomia 3: PR e CI automáticos; deploy, branch padrão e arquivo sensível falham mesmo assim
ok 26 - GH4. produção e política do projeto: escrita em production sempre pede pessoa; regra forbidden bloqueia
ok 27 - GH5. sem GitHub App: escrita falha com GITHUB_APP_REQUIRED; leitura continua
ok 28 - GH6. catálogo: risco e autonomia mínima de cada ferramenta do GitHub em /api/nexia/tools
ok 29 - GH7. GitHub real (gilcambe/nexia): branches, arquivo, histórico, diff, PRs e Actions pelo gateway
# tests 91
# pass 91
# fail 0

$ npm run test:e2e
  57 passed (24.9s)
```

GH7 roda contra o GitHub real (`gilcambe/nexia`) com token só de leitura: branches, `package.json`, 5 commits, diff entre dois commits, PRs fechados e execuções do Actions; uma tentativa de criar branch na autonomia 0 ficou pendente e foi rejeitada (nada escrito).

## Pendências do dono (não feitas nesta fase)

1. Criar a GitHub App do NEXIA com as permissões: Contents R/W, Pull requests R/W, Actions R/W, Checks R, Issues R, Metadata R.
2. Instalar a App em `gilcambe/nexia`.
3. Configurar no Render: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` e (opcional) `GITHUB_APP_INSTALLATION_ID`.
4. Depois disso, apagar o `GITHUB_TOKEN` legado do Render (já está na lista de rotação).

Sem a App, a escrita no GitHub responde `GITHUB_APP_REQUIRED` e a leitura segue funcionando.

## TEMPORÁRIO / limitações

| Item | Motivo | Risco | Remoção |
|---|---|---|---|
| Leitura com `GITHUB_TOKEN` legado sem App | App ainda não criada | PAT amplo e longo | Quando a App estiver instalada |
| Bloqueio de workflow de deploy pelo nome do arquivo | Adapter não conhece environments | Workflow de deploy com nome neutro | Fase 9 |
| Commit sem exclusão de arquivo | Exclusão é CRITICAL (spec §15) | Agente não remove arquivo; pessoa faz no PR | Fase 10, com ferramenta CRITICAL própria |
| Detector de secret no código só por formato conhecido | Heurísticos davam falso positivo em código e lockfile | Secret de formato desconhecido passa | Revisão com Security Agent (Fase 10) |
| Cache de token de instalação em memória | Servidor único no Render | Cada reinício pede token novo (só custo) | — |
