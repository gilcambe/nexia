---
name: tela-finance
description: quando a tarefa mexe em telas do Kernex Finance em prumo/
---

# SKILL tela-finance

Use esta skill quando a tarefa mexe em telas do Kernex Finance em `prumo/`.

Regras de uso:

1. Nunca recrie `window.MB = {...}`. Isso apaga o que outros scripts já guardaram. Junte o que for preciso com:
   `window.MB = Object.assign(window.MB || {}, ...)`.

2. Antes de usar a resposta de `MB.api(acao)`, conferir o formato que o servidor devolve antes de usar (o `return [200, {...}]`). Quase sempre é um objeto com a lista dentro (ex.: `{ meses: [...] }` ou `{ itens: [...] }`), não a lista direta. `Array.isArray(resposta)` dá `false` e a tela fica vazia sem erro.

3. ligar botão só se o elemento existir:
   `const b = el.querySelector('#botao'); if (b) b.onclick = ...`.

4. CSS que entra depois vence o de antes com o mesmo peso. Para vencer `.linha{display:flex}` ou `.card{background}` use seletor mais forte (`.linha.kf-tres`, `.card.kf-hero`). Um `<div>` novo sem CSS tem tamanho zero; fundo escuro de menu precisa de `position:fixed; inset:0; background rgba; z-index` entre a página e a gaveta.

5. Cor pelo nome do token, não pelo nome da classe antiga: ganho = `var(--ganho)` (verde), perda = `var(--perda)` (vermelho). `--verde` no Finance é AZUL (cor da marca).
