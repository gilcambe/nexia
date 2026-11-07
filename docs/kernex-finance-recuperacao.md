# Recuperação do Serviço Kernex Finance

## Como saber se está fora do ar

- Verifique se há uma *issue* aberta no repositório do projeto que indique indisponibilidade do serviço.
- Teste o endpoint de saúde:
  ```bash
  curl -f https://<SEU_DOMÍNIO>/api/prumo
  ```
  O comando deve retornar **200 OK**. Qualquer outro código de status ou erro de conexão indica que o serviço está fora do ar.

## Como voltar à versão anterior

1. **Rollback via Cloudflare**
   - Acesse o painel da Cloudflare → *Workers* → *Deployments*.
   - Encontre a última implantação bem‑sucedida.
   - Clique em **Rollback** para restaurar essa versão.

2. **Reverter commit no GitHub**
   - Localize o SHA do último commit que introduziu a mudança problemática (`git log` ou na interface web).
   - Execute:
     ```bash
     git revert <SHA_DO_COMMIT>
     git push origin <sua-branch>
     ```
   - Abra um Pull Request para que a reversão seja mesclada na branch padrão.

Esses passos permitem identificar rapidamente a indisponibilidade e restaurar a versão estável do serviço.
