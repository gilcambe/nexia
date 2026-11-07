# CLAUDE.md (NEXIA / Kernex) — leia isto antes de qualquer coisa

O dono é leigo, escreve em português. Responda em português simples, passo a passo curto.
Entregas para o dono precisam ser automáticas (botão na Central ou clique duplo), nunca "rode este comando".

## REGRA ZERO: economia de tokens do Claude
1. Claude = ARQUITETO E REVISOR. Quem escreve código é o Cortex (fila `cortex-fila`) com as IAs grátis.
2. Claude só: escreve a especificação curta (issue < 4.000 letras), revisa o PR pelo diff, testa.
3. Claude só escreve código numa tarefa difícil que o Cortex JÁ tentou e falhou; depois devolve ao Cortex.
4. Não ler arquivo grande inteiro. Use busca (grep / árvore do git) e leia só o trecho necessário.
5. Antes de tarefa grande, diga ao dono em 2 linhas: "vai para o Cortex" ou "eu faço, porque…".
6. Anote o gasto em `/mnt/project-files/regra-zero/ORCAMENTO_TOKENS.md`. Acima de 70%: modo econômico.
7. Estado de cada projeto: `/mnt/project-files/regra-zero/STATUS.md` (não releia o código para saber).

## Estrutura (só o que importa)
- `nexia-ai/` cérebro do Cortex. `nexia-ai/model-router/` escolhe a IA grátis:
  `cota.js` (placar de cota + disjuntor, salvo no D1), `vagas.js`, `providers/*` (gemini, openai-compatible…).
- `netlify/functions/central/*.js` APIs da Central (rodam no Worker Cloudflare). Ex.: `tokens.js` (uso por IA hoje),
  `ia-vagas.js`, `pedidos-*.js` (Pedir ao Cortex).
- `src/` telas (Vite). `src/pages/central/` = Central. `apps/body-coach/` = Body Coach.
- `.github/workflows/fila-cortex.yml` roda a fila a cada 15 min, 24h. `ia-vagas.yml` confere IAs 1x/dia.
- `docs/ESTADO-IA.md` e `docs/CONTEXTO-IA.md` = memória para qualquer IA. `docs/ESCADA-IA.md` = ordem das IAs.
- `lib/firebase-lite/` banco grátis (D1). Avaya GSD fica em OUTRO repo privado: gilcambe/avaya-gsd.

## Comandos
- Testes: `npm test` (unit, node --test). Tipos: `npm run typecheck`. Build: `npm run build`.
- Conferir IAs grátis: `npm run ias:conferir`.
- Branch padrão: `develop`. Ramo do Cortex: `nexia/*`.

## Regras do dono (não quebrar)
- Tudo GRÁTIS: Firebase + GitHub + Cloudflare. Nada pago, nunca (sem cartão, Blaze, Render).
- Ordem: 1) Cortex, 2) IAs grátis por chave de API (Groq, Gemini, OpenRouter, Mistral, Workers AI, NVIDIA, Jules),
  3) Claude só quando a cota grátis acabou. Nunca automatizar chat web com login (ChatGPT/Gemini site): viola termos.
- Cortex nunca para por falta de IA: se uma falha ou esgota, passa para a próxima sozinho.
- Mesclar sozinho só com rótulo `automerge`, CI verde, ramo `nexia/*`. Workers não mesclam pela API.
- Precisa da palavra do dono: regras do Firestore, chaves reais, reescrever histórico, apagar dados, irreversível.
- Nunca colocar `fila-pausada` numa issue só (pausa a fila inteira). Para tirar uma issue, tire `cortex-fila`.
- Nunca mostrar status falso na Central (verde/"operacional" sem checagem real).
- Toda vez que o Cortex travar: issue com a lição + lição salva (ele aprende com o erro).
- Todo projeto termina com teste completo "como pessoa".
- Marca pública = KERNEX; nomes técnicos (`nexia`, URLs) ficam. Ícone do app = inicial/logo do próprio produto.
- Nunca colocar chave ou senha em arquivo do repo.

## Onde estão as coisas
- Central: https://cortex.kernex.com.br/central · Cortex: https://cortex.kernex.com.br/cortex
- Worker: https://nexia.gcbezerra.workers.dev
- Diário de tudo = issues e PRs do GitHub. Relatórios = `/mnt/project-files/nexia-audit/`.
