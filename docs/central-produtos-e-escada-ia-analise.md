# Análise de central/produtos.js e docs/ESCADA-IA.md

## Data: 26/10/2026
## Branch: nexia/ler-central-produtos-js-para-entender-a--eb226a

## Resumo da Análise

### central/produtos.js
- **Objetivo**: Estrutura completa de produtos e clientes da Central Kernex
- **Elementos principais**:
  - PRODUTOS: Array com produtos/clientes (id, logo, segmento, nome, icone, frase, site, painel, tipo)
  - NO_AR: Produtos com site ativo (filtrados por p.site && !p.pendente)
  - LINKS: Links úteis para ferramentas externas
  - ROBOS: Robôs disponíveis via GitHub Actions
  - BASE: URL base https://nexia.gcbezerra.workers.dev
- **Uso para sentinel.js**: Determina quais produtos/clientes recebem monitoramento

### docs/ESCADA-IA.md
- **Objetivo**: Lógica da escada de IAs em 3 degrais
- **Degrais**:
  1. Cortex primeiro (cadeia de IAs grátis)
  2. IAs grátis ajudantes (Jules, Gemini CLI)
  3. Claude Code por último
- **Regras**: Nada pago, rótulos GitHub, comentários automáticos, revisor grátis, Jules, Claude
- **Meta**: Fase B quando teste humano ≥9,5 por 7 dias + 90% tarefas por degrau 1
- **Uso para sentinel.js**: Define qual modelo IA usar e quando promover de degrau

## Conclusão
Ambos os arquivos fornecem a base necessária para implementar as checagens corretas no sentinel.js:
- A estrutura de produtos determina quais itens receberão monitoramento
- A escada IA define qual modelo usar e quando promover de degrau