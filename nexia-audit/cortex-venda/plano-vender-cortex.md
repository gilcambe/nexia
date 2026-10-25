# Plano de venda do Cortex

Depende de: **Cortex Venda 2**

## Planos

| Plano | Preço | O que inclui |
|-------|-------|--------------|
| Grátis | R$ 0 / US$ 0 | 20 mensagens por dia, só IAs rápidas, até 3 agentes |
| Básico | R$ 29 / US$ 9 | 1.500 créditos por mês |
| Pró | R$ 79 / US$ 19 | 5.000 créditos por mês, IAs fortes, 1 site por mês |
| Negócio | R$ 199 / US$ 49 | 15.000 créditos, 3 usuários, 3 sites |
| Revenda | R$ 499 / US$ 129 | 10 contas filhas |

## Como os créditos são gastos

Cada mensagem gasta créditos conforme o tamanho da mensagem e o modelo de IA usado. O uso é contado em `cortexClientes/{uid}/uso/{AAAA-MM}` (reaproveitando `lib/cotas.js` para medição).

## Quando os créditos acabam

O usuário recebe um aviso amigável com um botão "mudar de plano". Nunca é mostrado um erro feio. O sistema bloqueia novas mensagens até o plano ser alterado ou o mês/cota ser renovado.

## Arquivos envolvidos

- `lib/cortex-planos.js` — definição dos planos, custo por mensagem, verificação e consumo de créditos, aviso e bloqueio.
- `lib/cotas.js` — medição de uso e freio de cota (reaproveitado).
- `tests/unit/cortex-planos.test.js` — testes de gasto, limite diário do grátis, virada do mês e bloqueio ao acabar.

---

*Feito com Kernex*