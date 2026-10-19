# README

## Segurança e Varredura de Segredos

O projeto utiliza gitleaks através do CI para impedir novos vazamentos de segredos. A detecção é automática e faz parte do fluxo de integração contínua.

Importante: não há rotação forçada de segredos por ferramenta. Qualquer chave identificada no histórico do Git deve ser revogada manualmente pelo administrador do sistema.

Para mais informações sobre a ferramenta utilizada, consulte a [documentação oficial do gitleaks](https://github.com/zricethezav/gitleaks).