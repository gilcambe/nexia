# Kernex Finance: Open Finance (Fase 6)

Situação em 07/11/2026: **nenhum provedor ligado e nada contratado.** A aba "Bancos" mostra "em breve" e manda a pessoa usar a aba Documentos (foto, print ou PDF). O app nunca pede nem guarda senha de banco.

## Por que não dá para ligar de graça

Para ler dados do Open Finance regulado é preciso ser instituição autorizada pelo Banco Central ou contratar um agregador que é. Todos os agregadores achados cobram mensalidade para uso em produção. O que é grátis é só o ambiente de teste (sandbox), com dados falsos.

## Opções e preços

| Opção | Preço em produção | Grátis? | Fonte e data |
|---|---|---|---|
| Pluggy | cerca de R$ 2.500/mês | Só sandbox de teste | Relato de desenvolvedor no TabNews, consultado em 07/11/2026: https://www.tabnews.com.br/GuilhermeVieira/estou-desenvolvendo-um-app-de-financas-pessoais-e-nao-consigo-pagar-o-open-finance-pluggy-r2-5k-mes-belvo-r6k-mes-tecnospeed-r1-5k-de-entrada-r540 |
| Belvo | cerca de R$ 6.000/mês | Só sandbox de teste | Mesmo relato; tabela oficial em https://belvo.com/plans-and-pricing/ (consultada em 07/11/2026) |
| Tecnospeed | R$ 1.500 de entrada + cerca de R$ 540/mês | Não | Mesmo relato do TabNews (07/11/2026) |
| Virar instituição autorizada no Banco Central | Custo de empresa regulada (capital, auditoria, certificados) | Não | Regras do Open Finance Brasil |

Os preços acima vêm de um relato público e da página da Belvo. Antes de contratar, peça proposta oficial: preço muda e pode haver desconto para startup.

## O que já está pronto no código

- `netlify/functions/prumo-lib/openfinance.js`: adaptador vazio (`conectar`, `desconectar`, `sincronizar`) e ações `openfinance_status`, `openfinance_conectar`, `openfinance_desconectar`. Senha é sempre recusada.
- `prumo/conexoes.js`: aba "Bancos" com estado, lista de conexões, última atualização, prazo da autorização e botão de desconectar.
- Para ligar um provedor no futuro: escrever um adaptador com a mesma forma e chamar `usarProvedor(adaptador)`. **Só com a palavra do dono**, porque é pago.

## Recomendação

Ficar com Documentos (foto, print e PDF), que é grátis e já funciona. Ligar Open Finance só quando o Kernex Finance tiver clientes pagantes que cubram a mensalidade do agregador.
