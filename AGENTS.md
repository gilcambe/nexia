# Regras para qualquer IA que trabalhe neste repositório

Este arquivo vale para Jules, Codex, Copilot, Antigravity/Gemini, Claude ou qualquer outra IA. Leia também `docs/CONTEXTO-IA.md`.

## Quem é o dono
Gildivan (gcbezerra@gmail.com). Não é programador e escreve em português. Responda curto, simples e em passos numerados.

## Regras que nunca mudam
0. **Escada de trabalho (regra do dono):** primeiro o Cortex, depois as IAs grátis ajudantes (Jules, Gemini CLI), e só por último o Claude Code, que termina a tarefa e se retira. Detalhes e rótulos em `docs/ESCADA-IA.md`.
1. **O Cortex escreve o código.** Funcionalidade nova ou correção simples vira uma issue com o rótulo `cortex-fila`. Escreva código direto só para tarefa difícil em que o Cortex já falhou, e depois devolva ao Cortex. Exceção: no Body Coach, quando o Cortex faria o dono esperar, a IA pode fazer e depois fecha a issue do Cortex.
2. **Nada pago.** Use só planos grátis: Firebase sem Blaze, Cloudflare Workers grátis e GitHub Actions. Nunca ligue um provedor ou serviço que cobre.
3. **Nunca mostre, peça ou grave segredos.** Chaves ficam só em GitHub Secrets ou nas variáveis do Cloudflare. Se precisar de uma chave nova, diga o nome do segredo, e o dono coloca.
4. **Nada irreversível sem a palavra do dono:** publicar regras do Firestore, trocar chaves reais, reescrever o histórico do git, apagar dados e mexer em DNS ou domínios.
5. **O que está no ar não pode quebrar:** Body Coach, Cortex/Central, Studio Lima e Bezsan. Mudança arriscada entra desligada, atrás de uma chave.
6. **Nunca remova uma função que já existe.**
7. Nunca mande mensagem nem teste o WhatsApp 5511999994185.

## Como entregar
- Branch `nexia/<assunto>` a partir de `develop`. O PR vai para `develop` com o rótulo `automerge`. Ele entra sozinho quando o CI fica verde, então não mescle pela API.
- Rode `npm test` antes de abrir o PR. Mantenha o PR pequeno, com um assunto só.
- A descrição do PR tem os parágrafos "Antes:", "Depois:" e "Como:".
- Infra: só Firebase, GitHub e Cloudflare.
