# Recuperação de Falha – Kernex Finance

## Como saber se está fora do ar

- Verifique se há uma issue aberta no repositório indicando indisponibilidade.
- Teste o endpoint de health: `GET https://<SEU_DOMÍNIO>/api/prumo`. Qualquer erro (5xx, timeout ou código diferente de 200) indica que o serviço está fora do ar.

## Como voltar à versão anterior

- **Rollback do deployment**: no painel da Cloudflare → *Workers* → *Deployments*, selecione a última versão estável e clique em **Rollback**.
- **Reverter commit**: no GitHub, identifique o SHA do commit problemático e execute `git revert <SHA>`; abra PR para mesclar a reversão na branch padrão.

Após a restauração, teste novamente o endpoint `/api/prumo` para confirmar que o serviço está ativo.
