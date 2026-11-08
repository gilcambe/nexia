# Recuperação do Serviço - Kernex Finance

## Como saber se está fora do ar
- **Verificar Issues**: Acesse o repositório no GitHub e verifique se há issue aberta reportando indisponibilidade.
- **Testar Endpoint**: Faça uma requisição para `/api/prumo`. Se falhar (erro 5xx ou timeout), o serviço está fora do ar.

## Como voltar à versão anterior
- **Rollback do Deployment**: Faça o rollback para o deployment estável anterior no painel de hospedagem.
- **Reverter Commit**: Reverta o commit problemático no repositório e envie para atualizar a branch.
