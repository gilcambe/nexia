# Mapa vivo do projeto NEXIA

Documentação viva gerada do código (mapa de rotas, segredos e workflows).
Este arquivo é gerado a cada merge e o Cortex lê como contexto para falhar menos ao conhecer a arquitetura (liga com C1). Custo 0.

---

## 1. Stack e arquitetura

- Stack: node, firebase, react, typescript, cloudflare
- Frameworks/bibliotecas: anthropic-sdk, express, i18next, playwright, react, react-router, tailwindcss, vite
- Linguagens por número de arquivos: javascript, typescript
- Deploy: cloudflare
- Firebase: emulators, firestore, storage (projeto `nexia-c8710`)
- Node >= 20
- Repositório: `gilcambe/nexia` (branch padrão `develop`)
- Ambiente production: cloudflare

---

## 2. Mapa de rotas da API

Definidas em `lib/routes.js` (compartilhado pelo server.js Node e pelo Worker do Cloudflare — ADR-FREE-01).

| Rota | Função | Observação |
|------|--------|------------|
| `/api/cortex` | `cortex-chat` | |
| `/api/body-coach-ai` | `body-coach-ai` | |
| `/api/body-coach-chat` | `body-coach-chat` | |
| `/api/leads` | `leads` | Captura de leads (público) + painel `/leads` |
| `/api/pedidos` | `pedidos` | Cortex do dono: pedidos, histórico e publicar (só master) |
| `/api/central` | `central` | Central NEXIA do dono |
| `/api/conheca` | `conheca` | Link na bio do Instagram: conta o clique e manda para o Body Coach |
| `/api/agenda` | `agenda` | NEXIA Agenda: agendamento dos sites de clientes + painel da dona |
| `/api/leilao` | `leilao` | Central de Leilões (Bezsan): edital, matrícula, processo, parecer |
| `/api/ai-analysis` | `cortex-chat` | |
| `/api/auth` | `auth` | |
| `/api/memory` | `cortex-memory` | |
| `/api/rag` | `rag-engine` | |
| `/api/autodev` | `autodev-engine` | |
| `/api/models` | `multi-model-engine` | |
| `/api/swarm` | `swarm` | |
| `/api/agent-run` | `cortex-agent` | |
| `/api/agents` | `agents` | |
| `/api/actions` | `action-engine` | |
| `/api/logs` | `cortex-logs` | |
| `/api/events` | `event-processor` | |
| `/api/notifications` | `notifications` | |
| `/api/tenant` | `tenant-admin` | |
| `/api/crm` | `tenant-admin` | |
| `/api/usage` | `usage` | |
| `/api/billing` | `billing` | |
| `/api/observe` | `observability` | |
| `/api/observability` | `observability` | |
| `/api/learn` | `cortex-learn` | |
| `/api/pabx` | `pabx-handler` | |
| `/api/osint` | `osint-query` | |
| `/api/takedown` | `takedown-gen` | |
| `/api/payment` | `payment-engine` | |
| `/api/metrics` | `metrics-aggregator` | |
| `/api/architect` | `architect` | |
| `/api/whatsapp` | `whatsapp-business` | |
| `/api/nfe` | `nfe-engine` | |
| `/api/dynamic-pricing` | `dynamic-pricing` | |
| `/api/sentinel` | `sentinel-iot` | |
| `/api/sentinel-qa` | `sentinel` | |
| `/api/governance` | `middleware` | |
| `/api/tenant-domain` | `tenant-domain` | |
| `/api/dunning` | `dunning-scheduler` | |
| `/api/kpi` | `kpi-engine` | |
| `/api/churn` | `churn-predictor` | |
| `/api/sales` | `ai-sales-agent` | |
| `/api/financial` | `ai-financial` | |
| `/api/internal-agents` | `internal-agents` | |
| `/api/audit` | `audit-log` | |
| `/api/ads` | `ads-engine` | |
| `/api/recovery` | `account-recovery` | |
| `/api/strike` | `strike-engine` | |
| `/api/nexia` | `nexia-api` | NEXIA AI (Fase 3): nexia-ai/api |

Funções resolvidas por `resolveFunctionName(pathname)` que também aceita prefixo `/.netlify/functions/`.

---

## 3. Páginas públicas e de tenant

### Pastas servíveis publicamente (além de `out/`)
`core`, `ces`, `bezsan`, `splash`, `viajante-pro`

### Páginas HTML dos tenants (caminho → [pasta, arquivo])

| Caminho | Pasta | Arquivo | Tipo |
|---------|-------|---------|------|
| `/ces/landing` | ces | ces-landing.html | Landing |
| `/bezsan/landing` | bezsan | bezsan-landing.html | Landing |
| `/vp/landing` | viajante-pro | vp-landing.html | Landing |
| `/viajante-pro/landing` | viajante-pro | vp-landing.html | Landing |
| `/splash/landing` | splash | splash-landing.html | Landing |
| `/ces/admin` | ces | ces-admin.html | Admin |
| `/bezsan/admin` | bezsan | bezsan-admin.html | Admin |
| `/vp/admin` | viajante-pro | vp-admin.html | Admin |
| `/viajante-pro/admin` | viajante-pro | vp-admin.html | Admin |
| `/splash/admin` | splash | splash-admin.html | Admin |
| `/ces/checkin` | ces | checkin.html | App especial |
| `/ces/executivo` | ces | ces-app-executivo.html | App especial |
| `/vp/guia` | viajante-pro | vp-guide.html | App especial |
| `/vp/passageiro` | viajante-pro | vp-passenger.html | App especial |

---

## 4. Segredos e variáveis de ambiente

Nunca escrever secrets em arquivo, commit, PR ou resposta. Lista de nomes (sem valores):

| Variável | Escopo | Observação |
|----------|--------|------------|
| `NODE_ENV` | Produção (Cloudflare) | |
| `PORT` | Produção (Cloudflare) | |
| `NEXIA_APP_URL` | Produção (Cloudflare) | |
| `NEXIA_CNAME_TARGET` | Produção (Cloudflare) | |
| `NEXIA_CRON_SECRET` | Produção (Cloudflare) | |
| `NEXIA_JOBS_TOKEN` | Produção (Cloudflare) | |
| `NEXIA_GITHUB_TOKEN` | Produção (Cloudflare) | |
| `FIREBASE_SERVICE_ACCOUNT_BASE64` | Produção (Cloudflare) | |
| `FIREBASE_SERVICE_ACCOUNT_B` | Produção (Cloudflare) | |
| `FIREBASE_SERVICE_ACCOUNT_C` | Produção (Cloudflare) | |
| `NEXIA_D1_TOKEN` | Produção (Cloudflare) | |
| `NEXIA_D1_ACCOUNT_ID` | Produção (Cloudflare) | |
| `AUTH_DOMINIO_PROPRIO` | Cloudflare Worker / produção | Melhoria 45: login com Google no domínio próprio |
| `FIREBASE_AUTH_PROXY_DOMAIN` | Cloudflare Worker / produção | Melhoria 45: domínio próprio do Firebase Auth |
| `BREVO_API_KEY` | Produção | Alerta de queda por e-mail (Melhoria 47) |

Regras de segurança: não mexer em regras do Firestore nem em segredos. Nenhuma função existente removida.

---

## 5. Melhorias de processo (nexia-audit/melhorias-2026-10-18/)

### Melhoria 45 — Login com Google no endereço do próprio produto
- Status: Implementado e configurado
- Ação manual do dono: cadastrar a URL de redirecionamento do domínio próprio no Console do Google / Firebase
- Configuração: `AUTH_DOMINIO_PROPRIO=1` e `FIREBASE_AUTH_PROXY_DOMAIN` no Cloudflare Worker / produção
- Implementação: Cloudflare Worker repassa `/__/auth/` e `/__/firebase/init.json` (`proxyAuth`) e usa `authDomainProprio` ocultando `nexia-c8710.firebaseapp.com` na escolha de conta Google

### Melhoria 46 — Respostas diretas sem abrir issue
- Status: Implementado
- Regra: perguntas ("como estamos?", "o que falta?") respondidas na hora por modelo rápido lendo a Central; só pedidos de código viram issue
- Custo: 0

### Melhoria 47 — Divisão automática de tarefa grande + alerta de queda
- Status: Implementado (regra de processo)
- Regra: pedido grande (já na 3ª falha) divide em tarefas pequenas antes de executar; estimativa na entrada; se toca mais de 4 arquivos, dividir logo no começo
- Alerta automático de queda por e-mail (Brevo grátis) e na Central: monitora `/health` e Body Coach; falha duas vezes consecutivas → e-mail via Brevo + evento na Central
- Implementação: `src/monitoring/healthWatcher.js` (polling a cada minuto), `src/notification/brevoClient.js` (variável `BREVO_API_KEY`), iniciado em `src/server.js`
- Garantia: nenhum teste existente quebrado (`npm test` continua passando)

---

## 6. Workflows e CI

- `npm test` — deve passar após qualquer mudança
- `npm run build` — build do projeto
- `npm run dev` — ambiente de desenvolvimento
- `npm start` — servidor de produção
- Deploy: Cloudflare (pipeline)
- Toda escrita no GitHub só em branches `nexia/...`; branch padrão só muda por PR
- Deploy só pelo pipeline

---

## 7. Documentos de referência do projeto

| Documento | Caminho |
|-----------|---------|
| Schemas do Vault | `VAULT-SCHEMAS.md` |
| Auditoria de segurança | `SECURITY-AUDIT.md` |
| Runbook do piloto | `PILOT-RUNBOOK.md` |
| Relatório Fase 9 | `PHASE-9-REPORT.md` |
| Relatório Fase 8 | `PHASE-8-REPORT.md` |
| Lista completa de melhorias | `nexia-audit/melhorias-2026-10-18/melhorias-45.md` |

---

## 8. Regras obrigatórias (qualidade)

- Antes de escrever, ler arquivos vizinhos e seguir stack, estrutura de pastas, nomes e estilo existentes
- Arquivo existente: usar edição por trecho exato; nunca reescrever arquivo não lido inteiro
- Nenhuma função existente removida
- Não mexer em regras do Firestore nem em segredos
- `npm test` deve passar
- Sem `TODO`, `lorem ipsum`, `...` no lugar de código, links quebrados, imports inexistentes ou dados inventados apresentados como reais
- Toda escrita em branches `nexia/...`; deploy só pelo pipeline
- Se uma ferramenta ficar aguardando aprovação humana, parar e reportar o que está pendente

---

_Atualizado automaticamente a cada merge. O Cortex lê este arquivo como contexto do projeto._
