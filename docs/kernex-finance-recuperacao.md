# Recuperação de Falha – Kernex Finance

## Como saber se está fora do ar

- Verifique se há uma issue aberta no repositório indicando indisponibilidade.
- Teste o endpoint: faça uma requisição `GET /api/prumo`. Respostas com erro 5xx, timeout ou falha na resposta indicam que o serviço está fora do ar.

## Como voltar à versão anterior

- **Rollback do deployment**: Acesse o painel da plataforma de hospedagem (Cloudflare Pages/Workers ou provedor de deploy) na seção de *Deployments* e faça o rollback para a versão estável anterior.
- **Reverter commit**: Reverta o commit problemático na branch principal através de um commit de reversão (`git revert`) ou abra um Pull Request revertendo a alteração que causou a falha.
