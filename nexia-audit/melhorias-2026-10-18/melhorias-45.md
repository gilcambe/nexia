# Melhoria 45 — Limpeza de segredos e varredura contínua (gitleaks no CI)

## Objetivo
Impedir que novos segredos entrem no repositório e acusar chaves expostas no histórico, sem rotação forçada de segredos existentes.

## Por que
Uma chave já foi exposta no passado (Instagram). A varredura contínua custa zero (gitleaks de graça no GitHub Actions) e evita que o incidente se repita.

## O que foi feito
- `.github/workflows/ci.yml` — job `secrets` (Secret scan) roda em todo push e pull request:
  - baixa o repositório com `fetch-depth: 0` para varrer o histórico completo;
  - instala o gitleaks 8.24.3 com verificação de checksum SHA-256;
  - varre a árvore atual (`gitleaks dir .`) — impede novos vazamentos antes de entrar na branch;
  - varre os commits novos do PR (`gitleaks git .` no intervalo base..head) — acusa chaves no histórico introduzidas pela mudança.
- `.gitleaks.toml` — regras do gitleaks: regras padrão + regras locais (Mercado Pago, Firebase/GCP service account, service account em base64, arquivo .env, chave GCP/API genérica) com allowlists restritas a arquivos legados conhecidos e valores fictícios de teste.
- `.gitignore` — impede versionar `.env`, `.env.*`, chaves privadas, service accounts do Firebase e pastas de build/credenciais.

## Regras do projeto
- Sem rotação forçada: segredos já expostos não são rotacionados automaticamente por esta melhoria.
- A varredura impede novos vazamentos e acusa chaves no histórico introduzidas por novas mudanças.
- Não mexe em regras do Firestore nem em segredos existentes.
- Tudo grátis: gitleaks é open source e roda no GitHub Actions sem custo.
- `npm test` deve continuar passando.

## Arquivos envolvidos
- `.github/workflows/ci.yml` (job `secrets`)
- `.gitleaks.toml`
- `.gitignore`
- `nexia-audit/melhorias-2026-10-18/melhorias-45.md` (este documento)
