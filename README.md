# README

Este é o projeto NEXIA, uma plataforma de IA e automação.

## Segurança e Varredura de Segredos

Este projeto utiliza o gitleaks através do CI (GitHub Actions) para impedir novos vazamentos de segredos no código. A detecção é automática e acontece durante o processo de Pull Request, analisando apenas os commits novos do PR (base..head), sem varrer o histórico completo do repositório.

**Importante:** Não há rotação forçada de segredos por ferramenta. Qualquer chave ou segredo identado no histórico do Git deve ser revogada manualmente pelo administrador do sistema. A detecção pelo gitleaks serve como alerta, mas a responsabilidade pela segurança das credenciais é manual.

Para mais informações sobre o gitleaks, consulte a [documentação oficial](https://gitleaks.io/).
