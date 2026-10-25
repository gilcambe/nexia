# Plano de Venda do Cortex como Assinatura

## Objetivo
Vender o Cortex como assinatura (tipo Abacus.ai / Adapta.org). Hoje só o dono entra.

## Funcionalidades
- Página pública `/cortex/entrar` (pt simples, celular primeiro)
- Cadastro e login por e-mail/senha e Google
- Uso do Firebase Auth que já existe (`lib/firebase-lite`, `/api/firebase-config`)
- Ao criar a conta, gravar `cortexClientes/{uid}` com:
  - `{email, nome, plano:'gratis', criadoEm, idioma:'pt'}`
- Gravação pelo Worker (`cloudflare/app.js`), nunca pelo navegador direto

## Regras
- Tudo grátis (Worker free + Firebase Spark)
- Não mexer no acesso do dono (`/meu-cortex`)
- Se precisar mudar `firestore.rules`, só deixar no PR; publicar regras é com o dono

## Critérios de Pronto
- Uma pessoa nova cria conta
- Sai e entra de novo
- O documento do cliente existe
- Teste unitário da rota de criação

## Arquivos Modificados
- `cloudflare/app.js` - Adiciona rotas de autenticação e gravação de clientes
- `src/pages/cortex/entrar.tsx` - Página pública de login/cadastro
- `tests/unit/cortex-cliente.test.js` - Teste unitário da rota de criação