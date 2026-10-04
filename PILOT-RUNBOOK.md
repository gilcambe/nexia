# Roteiro do piloto NEXIA AI (spec §30, fases 23–25)

Para o dono executar. Cada passo depende do anterior. Nada aqui foi feito automaticamente.

## Onde o NEXIA roda (ADR-HOST-01)

Só **Cloudflare + Firebase + GitHub**. Não há Render.

- **Cloudflare:** um Worker chamado `nexia` recebe todo o tráfego do domínio e repassa a um Cloudflare Container que roda o `server.js` (site React, páginas estáticas e `/api/*`). Configuração em `wrangler.jsonc`, `Dockerfile` e `cloudflare/worker.js`.
- **Firebase:** login (Auth), banco (Firestore) e Storage, projeto `nexia-c8710`.
- **GitHub:** código, CI e o botão de deploy (workflow manual "Deploy Cloudflare").

## Antes (uma vez)

1. **Rotacione os secrets expostos** listados no SECURITY-AUDIT (Fase 1). Os novos valores vão só nos segredos do Worker no Cloudflare (passo 5), nunca no código.
2. **Firebase:** restrinja a chave web por referrer (o domínio do Cloudflare) e ligue o App Check.
3. **Masters:** restaure as contas master legítimas (custom claims). Só depois publique as regras e os índices:
   `npx firebase-tools deploy --only firestore:rules,firestore:indexes --project nexia-c8710`
4. **Cloudflare (conta):** o Containers exige o plano **Workers Paid**. No painel do Cloudflare:
   1. Anote o **Account ID** (página inicial da conta, coluna da direita).
   2. Crie um **API Token** em *My Profile → API Tokens → Create Token → modelo "Edit Cloudflare Workers"*.
5. **Segredos do NEXIA no Cloudflare:** no seu computador, dentro da pasta do repositório, rode um comando por variável e cole o valor quando ele pedir (os nomes estão em `.env.example`):
   `npx wrangler secret put FIREBASE_SERVICE_ACCOUNT_BASE64`
   Faça o mesmo para `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`, `MASTER_EMAIL`, `ANTHROPIC_API_KEY` e os demais que você usa. `NEXIA_APP_URL` só é preciso se outro domínio for chamar a API.
6. **GitHub App:** crie a NEXIA GitHub App (passos no PHASE-8-REPORT), instale só no repositório do piloto e coloque `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` e `GITHUB_APP_INSTALLATION_ID` como segredos do Worker (mesmo comando do passo 5).
7. **Botão de deploy no GitHub:** em `gilcambe/nexia` → *Settings → Environments → New environment* `production`:
   1. Marque **Required reviewers** e coloque você.
   2. Em *Environment secrets*, crie `CLOUDFLARE_API_TOKEN` (o token do passo 4).
   3. Em *Environment variables*, crie `CLOUDFLARE_ACCOUNT_ID`.
8. **Deploy do NEXIA**, depois dos itens 1–3: *Actions → Deploy Cloudflare → Run workflow*, digite `DEPLOY` e aprove. O workflow roda os testes e publica o Worker e o Container. Depois abra `https://nexia.<sua-conta>.workers.dev/health` (ou o domínio que você ligar ao Worker em *Workers → nexia → Settings → Domains*).

## Piloto com um cliente

1. Em `/projetos`, cadastre o cliente e o projeto e rode o onboarding do repositório. Confira o snapshot e as integrações (ficam "pending").
2. No repositório do cliente: crie os environments `staging` e `production` (Settings → Environments) e coloque você como revisor obrigatório em `production`. Configure os segredos do provedor em cada environment (lista no PHASE-9-REPORT).
3. Deixe o projeto com **autonomia 3** (PR automático, sem deploy automático).
4. Em `/execucoes`, peça: "gere o pipeline de CI/CD". Revise e faça o merge do PR você mesmo.
5. Opcional: em `qa_checks` do projeto, informe o nome exato dos checks de teste, build e segurança (mais preciso que a correspondência por nome).
6. Peça uma correção simples. Acompanhe em `/execucoes` e confira o PR. Faça o merge você mesmo.
7. Suba para **autonomia 4** e peça "publique em staging". Confira o site de staging.
8. Peça "publique em produção". Aprove em `/aprovacoes` **e** no environment `production` do GitHub. Confira o site.
9. Acompanhe custos, falhas e aprovações em `/auditoria`. Anote o que deu errado.

## Depois do piloto (fases 24–25)

- Corrigir o que o piloto mostrar (cada correção como fase com PR, testes e relatório).
- Só então considerar autonomia maior e outros clientes. Produção continua sempre com aprovação humana.
- Pendentes para essa etapa: log do Bridge no Vault e agendador da retomada de execuções (SHAs das ações e teste do Bridge no Windows já resolvidos, ADR-F12-01/02).
- Hospedagem: avaliar servir o site direto pelos assets do Worker (hoje passa pelo container) e mais de uma instância do container (hoje uma só, ADR-HOST-01).
