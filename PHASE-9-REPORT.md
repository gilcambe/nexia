# PHASE-9-REPORT.md — Fase 9: CI/CD por projeto, Firebase e Cloudflare

Branch `nexia-ai/fase-9`, base `develop` @ `f89666d`. Sem deploy, sem credencial nova, sem regras publicadas. Nenhuma chamada real ao Google, à Cloudflare ou a deploy: tudo contra falsos em memória (`tests/fake-cloud.js`, `tests/fake-github.js`). O pipeline modelo **não** foi instalado neste repositório.

## Entregas

| Pedido (MIGRATION-PLAN Fase 9 / spec §10–§12, §23) | Arquivo | Teste |
|---|---|---|
| Workflow modelo (lint, testes, build, segurança, staging, smoke, produção com environment protegido) | `nexia-ai/cicd/pipeline.js`; ferramenta `cicd.render_pipeline`; exemplo em `docs/nexia-ai/exemplo-nexia-pipeline.yml` | C1, C2; D3 |
| Adapter Firebase (projeto, Hosting, regras, Firestore, Functions), só quando o projeto usa | `nexia-ai/firebase-adapter`; `firebase.get_project`, `firebase.get_status` | C3; D1 |
| Adapter Cloudflare (Pages, Workers, DNS, domínios, status de deploy) | `nexia-ai/cloudflare-adapter`; `cloudflare.get_deployment_status`, `cloudflare.list_dns` | C4; D1 |
| Staging automático (nível 4) para projetos com política | `deploy.staging`, `deploy.sync_status` (`nexia-ai/tool-gateway/tools/deploy.js`) | D4, D5, D6 |
| Credencial por tenant, só referência no Vault | `nexia-ai/integrations` | C5; D2 |
| Correção: `Deployment.version` colidia com o metadado do registro | `Deployment.release`; Context Engine | D4; `vault-schemas` |

## Saídas cruas (local)

```
$ node --test tests/unit/cicd-integrations.test.js
ok 1 - C1. pipeline modelo: CI em push/PR; staging e produção só por workflow_dispatch; produção depois do smoke de staging
ok 2 - C2. provedores: Cloudflare e Render com segredos do environment; entradas inválidas recusadas
ok 3 - C3. Firebase: service account assina JWT, token de leitura em cache; produto sem acesso aparece como não usado
ok 4 - C4. Cloudflare: Pages, Workers e DNS por external_ref; TXT omitido; token inválido não vaza
ok 5 - C5. credencial só com o nome do próprio tenant (NEXIA_<PROVEDOR>_<TENANT>_...)
# tests 5
# pass 5
# fail 0

$ npm test
# tests 89
# pass 89
# fail 0

$ NODE_USE_ENV_PROXY=1 npm run test:rules
ok 15 - D1. Firebase e Cloudflare: leitura automática (LOW) só com integração do projeto; valor da credencial fora do Vault
ok 16 - D2. credencial de outro tenant ou ausente: nada é chamado
ok 17 - D3. pipeline modelo a partir do Vault e entrega por commit + PR (autonomia 3)
ok 18 - D4. deploy.staging: nível 3 pede pessoa; nível 4 dispara o pipeline e registra o Deployment; dispatch genérico do pipeline é proibido
ok 19 - D5. deploy.sync_status espelha o Actions no Vault (fila → em andamento → sucesso)
ok 20 - D6. sem staging no Vault ou com provedor não suportado: deploy.staging não dispara
# tests 97
# pass 97
# fail 0

$ npm run test:e2e
  57 passed (24.2s)
```

## Pendências do dono (quando for usar com um cliente)

1. No repositório do cliente: criar os environments `staging` e `production` (Settings → Environments) e colocar revisores obrigatórios em `production`.
2. Configurar as variáveis/segredos do provedor em cada environment (Firebase: `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`, `FIREBASE_PROJECT_ID`; Cloudflare: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_PAGES_PROJECT`; Render: `RENDER_DEPLOY_HOOK`).
3. Nos segredos do Worker do NEXIA no Cloudflare (ADR-HOST-01; antes dizia Render): credenciais só de leitura com o nome `NEXIA_<PROVEDOR>_<TENANT>_<SUFIXO>` para as consultas de Firebase/Cloudflare.

## TEMPORÁRIO / limitações

| Item | Motivo | Risco | Remoção |
|---|---|---|---|
| Ações do modelo fixadas por major, não por SHA | Legibilidade | Tag movida por terceiro | Fase 11 |
| App Check, Auth e Storage fora do `firebase.get_status` | Escopos extras, não necessários para deploy | Visão parcial | Fase 10, se preciso |
| Pipeline só para Firebase Hosting, Cloudflare Pages e Render | Destinos do NEXIA e dos clientes atuais | Outros provedores recusados com mensagem | Quando houver cliente com outro destino |
| `deploy.sync_status` é consultado sob demanda (sem webhook) | Sem endpoint público de webhook nesta fase | Deployment no Vault atrasa até alguém consultar | Fase 10 (Orchestrator acompanha a execução) |
| Testes do Bridge sem runner Windows | A suíte usa comandos POSIX (`echo`, `touch`) | Comportamento Windows só por testes de função | Fase 11 (piloto na máquina do dono) |
