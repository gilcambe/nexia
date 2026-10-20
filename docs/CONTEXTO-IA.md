# Contexto para qualquer IA (Claude, Gemini, ChatGPT, grátis ou paga)

Cole o texto abaixo no início da conversa, ou mande a IA ler este arquivo no GitHub (`gilcambe/nexia`, ramo `develop`, `docs/CONTEXTO-IA.md`). Com isso ela entende o projeto sem o dono precisar explicar tudo de novo. **Este arquivo nunca contém chave ou senha.**

## Quem e o quê
- Dono: Gildivan Bezerra (gcbezerra@gmail.com). Escreve em português, não é programador: respostas curtas, simples, passo a passo.
- NEXIA: plataforma com vários produtos. Repositório `gilcambe/nexia`, ramo principal `develop`.
- Marca pública: **Kernex** (kernex.com.br, frase 'Inteligência que resolve.'). Arte em `brand/kernex/`. Nomes internos continuam `nexia` para não quebrar nada.
- Produtos: **Body Coach** (app de treino, `/body-coach`, em produção, não pode quebrar), **Cortex** (IA que programa, `/cortex`), **Central** (`/central`, painel do dono), sites de clientes (Bezsan, Studio Lima), Divulga (robô de posts), Achados (afiliados). Clientes antigos: CES Brasil 2027 (`/ces`), Viajante Pro (`/vp`), Splash Eventos (`/splash`).
- Infra: SÓ Firebase + GitHub + Cloudflare. Nada pago, nada de Render, sem Blaze nem Workers Pago.

## Regras que valem sempre
1. **O Cortex vem na frente.** Toda função ou correção nova vira uma issue com o rótulo `cortex-fila`; o Cortex escreve o código. A IA só escreve código para uma tarefa difícil em que o Cortex falhou, e depois devolve ao Cortex.
2. Gastar poucos tokens: testes curtos, nada de build longo à mão.
3. Nenhuma função existente é removida. Tudo grátis.
4. Pode mesclar sem perguntar quando o CI está verde (rótulo `automerge`, ramo `nexia/*`). Precisa da palavra do dono: publicar regras do Firestore, chaves reais, reescrever histórico do git, qualquer coisa irreversível.
5. O dono recusou trocar chaves expostas: não insistir.
6. Ícone de app/site = inicial ou logo do PRÓPRIO produto; a marca **Kernex** aparece só na vinheta de 2 s e no selo 'Feito com Kernex'.
7. Todo projeto termina com teste completo "como pessoa".

## Como o Cortex funciona
- Fila = issues com o rótulo `cortex-fila` (`scripts/cortex-fila.js`, workflow "Fila do Cortex"). Rótulos: `cortex-rodando`, `cortex-feito`, `cortex-travado`, `cortex-dividido`, `cortex-parte`, `tentativa-N`.
- Na 3ª falha a tarefa é dividida em partes pequenas. A fila só fecha como feita quando existe PR de verdade (`entregouPr`).
- Worker no ar: https://nexia.gcbezerra.workers.dev (Cortex em `/cortex`, Central em `/central`).
- Reserva: se os créditos da Claude acabam, o workflow **Cortex Reserva** (`.github/workflows/cortex-reserva.yml`, entrada `numero` = número da issue) aplica a tarefa com uma conta grátis ligada (Gemini, OpenRouter, OpenAI, Anthropic).

## Onde achar o histórico (sem precisar do Vault)
- `docs/` e `nexia-audit/` (planos, ADRs, auditorias, guias). Melhorias: `nexia-audit/melhorias-2026-10-18/melhorias-45.md`. Reserva: `nexia-audit/melhorias-2026-10-18/cortex-reserva-contas-gratis.md`.
- Issues e PRs do GitHub são o diário de tudo que foi feito e decidido.
- O **Vault** do Cortex guarda CHAVES. A IA nova **não precisa dele** e **não deve receber acesso**: tudo que ela precisa saber está neste arquivo, nos docs e nas issues. Se precisar de uma chave, o dono a coloca como segredo do GitHub (a IA nunca vê o valor).

## Como ajudar o Cortex (passo a passo para a IA nova)
1. Leia este arquivo e `gh issue list --label cortex-fila,cortex-travado`.
2. Escolha uma issue travada, entenda o erro no último comentário, corrija com o menor diff possível, rode `npm test`.
3. Abra PR de ramo `nexia/...` com o rótulo `automerge`. Não mescle pela API.
4. Diga ao dono, em português simples, o que mudou e o que ele precisa testar.

## Instruções para Novas IAs
Este arquivo é o contexto padrão para qualquer IA externa (Gemini, ChatGPT, Claude gratuita). Basta colar o conteúdo acima (ou mandar a IA ler `docs/CONTEXTO-IA.md` no GitHub) que a IA já entende o funcionamento do Cortex e o histórico do usuário, sem necessidade de gastar tokens em explicações adicionais.
