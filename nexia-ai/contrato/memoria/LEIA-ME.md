# Memória do Cortex (melhoria 15)

As IAs grátis não lembram de nada entre um pedido e outro. Quem lembra é o Cortex: a cada contrato, ele põe no pedido o que aprendeu.

| Camada | Arquivo | Quem grava | Entra no pedido |
|---|---|---|---|
| Lições (procedural) | `licoes.md` | só pessoas (Claude/dono), a partir de falha real | sempre, no sistema |
| Exemplos (episódica) | `exemplos/<n>.json` | o Cortex, quando o teste passa (vai no PR) | os 2 mais parecidos (busca com peso IDF) |
| Régua (avaliação) | `../regua/tarefas/<id>/` | pessoas | não entra: mede o Cortex |

## Como o Cortex melhora (ciclo)
1. Uma tarefa falhou ou saiu errada → descobrir a causa.
2. Corrigir na camada mais barata que resolve: lição → exemplo → contrato/teste → executor.
3. A falha vira tarefa da régua (pedido + teste visível + teste oculto), para nunca voltar.
4. Rodar a régua antes e depois: `node scripts/cortex-regua.js --modelos kilo:auto:1 [--sem-memoria]`.

## Regras
- Lição curta, geral e sem dado de cliente (o repositório nexia é público).
- Exemplo só de PR juntado: PR rejeitado leva o exemplo junto e ele não entra.
- Nada de segredo: diff com cara de chave não vira exemplo.
- Semear exemplos de PRs já juntados: `node scripts/cortex-memoria-semear.js dono/repo`.
- Tarefa nova da régua: conferir que tem solução e que os testes não se contradizem (`--solucao <pasta>`).
