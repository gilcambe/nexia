# Roteiro do piloto NEXIA AI (spec §30, fases 23–25)

Para o dono executar. Cada passo depende do anterior. Nada aqui foi feito automaticamente.

## Antes (uma vez)

1. **Rotacione os secrets expostos** listados no SECURITY-AUDIT (Fase 1). Coloque os novos valores só no Render.
2. **Firebase:** restrinja a chave web por referrer e ligue o App Check.
3. **Masters:** restaure as contas master legítimas (custom claims). Só depois publique as regras e os índices:
   `npx firebase-tools deploy --only firestore:rules,firestore:indexes --project nexia-c8710`
4. **GitHub App:** crie a NEXIA GitHub App (passos no PHASE-8-REPORT), instale só no repositório do piloto e coloque `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` e `GITHUB_APP_INSTALLATION_ID` no Render.
5. **Modelo:** coloque `ANTHROPIC_API_KEY` no Render.
6. **Deploy do NEXIA** no Render (branch `develop` → produção do NEXIA), depois dos itens 1–3.

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
- Pendentes para essa etapa: log do Bridge no Vault, Bridge no Windows, agendador da retomada de execuções, SHAs das ações no pipeline.
