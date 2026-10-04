# Roteiro do piloto NEXIA AI (spec §30, fases 23–25)

Para o dono executar. Cada passo depende do anterior. Nada aqui foi feito automaticamente.

## Onde o NEXIA roda (ADR-FREE-01 a 03): tudo grátis

Só **Cloudflare + Firebase + GitHub**, todos no plano gratuito. Não há Render, Container, Blaze nem Workers Paid.

- **Cloudflare (Workers Free):** o Worker `nexia` atende o site e a API (`/api/*`). Configuração em `wrangler.jsonc` e `cloudflare/`.
- **GitHub Actions (grátis em repositório público):** o workflow **NEXIA Jobs** roda as tarefas longas (agentes, onboarding, retomada), disparado pelo Worker.
- **Firebase (Spark):** login (Auth) e banco (Firestore), projeto `nexia-c8710`.
- **IA:** sem custo com as chaves grátis (Gemini, Groq, Cerebras, OpenRouter `:free`). `ANTHROPIC_API_KEY` é paga por uso: só coloque se quiser pagar.

## Antes (uma vez)

1. **Firebase:** restrinja a chave web por referrer (o endereço do Worker) e ligue o App Check. O projeto pode ficar no plano Spark.
2. **Masters:** restaure as contas master legítimas (custom claims). Só depois publique as regras e os índices:
   `npx firebase-tools deploy --only firestore:rules,firestore:indexes --project nexia-c8710`
3. **Segredos do NEXIA, num lugar só:** em `gilcambe/nexia` → *Settings → Secrets and variables → Actions → New repository secret*. Crie um por nome (lista completa no `.env.example`):
   1. `FIREBASE_SERVICE_ACCOUNT_BASE64`, `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`, `MASTER_EMAIL`.
   2. IA grátis: `GEMINI_API_KEY` (crie em aistudio.google.com, "Get API key"). Opcional: `GROQ_API_KEY`, `CEREBRAS_API_KEY`, `OPENROUTER_API_KEY`.
   3. `NEXIA_JOBS_TOKEN`: em GitHub → *Settings (da sua conta) → Developer settings → Fine-grained tokens → Generate*. Repositório: só `gilcambe/nexia`. Permissão: **Actions: Read and write**. Sem validade longa demais.
   4. Opcional: `NEXIA_GITHUB_TOKEN` (ler repositórios privados no onboarding).
   O deploy (passo 6) copia esses segredos para o Worker sozinho; o NEXIA Jobs usa os mesmos.
4. **GitHub App:** crie a NEXIA GitHub App (passos no PHASE-8-REPORT), instale só no repositório do piloto e crie `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` e `GITHUB_APP_INSTALLATION_ID` como segredos do repositório (mesmo lugar do passo 3).
5. **Botão de deploy:** em `gilcambe/nexia` → *Settings → Environments → production*:
   1. Marque **Required reviewers** e coloque você (hoje o deploy passa sem aprovação).
   2. `CLOUDFLARE_API_TOKEN` (segredo) e `CLOUDFLARE_ACCOUNT_ID` (variável) já existem. O token precisa só da permissão "Edit Cloudflare Workers"; nada pago.
6. **Deploy:** *Actions → Deploy Cloudflare → Run workflow*, digite `DEPLOY` e aprove. O workflow roda os testes, publica o Worker e copia os segredos (o log mostra só os nomes). Depois abra `https://nexia.<sua-conta>.workers.dev/health`.

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
- Itens técnicos adiados da Fase 11 já resolvidos: SHAs das ações, Bridge no Windows, retomada agendada e log do Bridge no Vault (ADR-F12-01 a 04).
- **Bridge no seu computador (opcional):** para ver as operações locais em `/auditoria`, siga a seção 7 do `nexia-bridge/README.md` (token criado na própria tela).
- Limites do plano grátis (ADR-FREE-01): se o uso passar de 100 mil pedidos por dia ou das cotas diárias do Firestore, o serviço para até o dia seguinte; nada é cobrado.
