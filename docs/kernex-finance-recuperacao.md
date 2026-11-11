# Recuperação do Serviço - Kernex Finance

## Como saber se está fora do ar
1. **Verificar Issues Abertas**: Consulte a aba de issues no GitHub do projeto para verificar se há alertas automáticos ou manuais sobre indisponibilidade.
2. **Testar Endpoint de Saúde**: Verifique se o endpoint `/api/prumo` está respondendo corretamente. Caso retorne erro 5xx, timeout ou falha de conexão, o serviço está fora do ar.
   ```bash
   # tem que devolver 200
   curl -sS -o /dev/null -w "%{http_code}\n" https://nexia.cba.studio/api/prumo
   ```
3. **Issues abertas**: se alguém já abriu alerta, ele aparece aqui.
   ```bash
   gh issue list --state open
   ```
3. **Monitoramento de Workflows**: Confira as execuções recentes no GitHub Actions para identificar falhas nos testes ou no deploy.
5. **Alertas de Segurança**: Verifique se o workflow `gitleaks.yml` ou alertas de segurança do GitHub (aba Security > Code scanning) acusaram exposição de segredos ou falha crítica.

## Como voltar à versão anterior
1. **Rollback do Deployment**: No painel do provedor de hospedagem (Cloudflare Pages/Workers), faça o rollback imediato para o último deployment estável.
2. **Reverter Commit**: Execute `git revert <sha>` do commit problemático na branch principal ou abra um PR de reversão para atualizar a versão em produção com segurança.
3. **Boas práticas de segurança**: Sempre trabalhe em branches `nexia/...`, abra um Pull Request para revisão e realize o deploy apenas via pipeline automatizado para evitar instabilidades.

## Comandos rápidos de recuperação
- **Ver último deployment estável**: abra o painel do Cloudflare (Workers & Pages) e confira a data/hora de cada publicação.
- **Voltar uma versão**: use o botão "Rollback" do deployment anterior no painel.
- **Reverter um commit**: `git revert <sha>` e depois abra um PR para `develop`.
- **Acionar o deploy**: só o pipeline (`deploy-cloudflare.yml`) publica; não faça deploy manual.
- **Segurança**: Nunca force push (`git push --force`) na branch padrão; nunca altere secrets ou regras do Firestore sem autorização explícita do dono.

## Checklist final
1. Endpoint `/api/prumo` respondeu OK após a ação?
2. Nenhuma issue de alerta ficou aberta sem resposta?
3. PR de reversão revisado e registrado no Vault?
