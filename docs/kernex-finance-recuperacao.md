# Recuperação do Serviço - Kernex Finance

## Como saber se está fora do ar
1. **Verificar Issues Abertas**: Consulte a aba de issues no GitHub do projeto para verificar se há alertas automáticos ou manuais sobre indisponibilidade (`gh issue list --state open`).
2. **Testar Endpoint de Saúde**: Verifique se o endpoint `/api/prumo` está respondendo corretamente. Caso retorne erro 5xx, timeout ou falha de conexão, o serviço está fora do ar.
   ```bash
   # tem que devolver 200
   curl -sS -o /dev/null -w "%{http_code}\n" https://nexia.cba.studio/api/prumo
   ```
3. **Monitoramento de Workflows**: Confira as execuções recentes no GitHub Actions para identificar falhas nos testes ou no deploy.

## Como voltar à versão anterior
1. **Rollback do Deployment**: No painel do provedor de hospedagem (Cloudflare Pages/Workers), faça o rollback imediato para o último deployment estável.
2. **Reverter Commit**: Execute `git revert <sha>` do commit problemático ou abra um PR de reversão para atualizar a versão em produção com segurança.

