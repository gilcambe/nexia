1. Use o que já existe. Se o pedido cita um módulo entre crases, faça require dele e chame as funções como estão. Não reescreva por conta própria o que o módulo já faz (token, autenticação, regras, validação).
2. Não pegue atalho para passar no teste. O teste é só uma amostra: a revisão roda o código de verdade, com dados que você não vê. Código que só reconhece os exemplos do teste é reprovado.
3. Separe os clientes. Dados e avisos de um cliente, empresa ou condomínio nunca vão para outro. Filtre sempre pelo identificador (tenantId, condoId...) e nunca mande um evento para todos.
4. Não quebre o que funciona. Faça a menor mudança que resolve. Mantenha os nomes e as assinaturas das funções exportadas, e os campos que o resto do sistema já usa.
5. Classificar texto livre (medido na régua: é onde as IAs mais erram):
   a) Normalize a entrada E os padrões do mesmo jeito (sem acento, minúsculas). Padrão com acento nunca casa com texto sem acento.
   b) Não copie as frases do pedido inteiras: use radicais e variações (ex.: "assalt" pega assalto/assaltaram/assaltante; "ladr" pega ladrão/ladra).
   c) Cada item listado no pedido vira uma regra. Pense em 3 jeitos diferentes de uma pessoa escrever cada item (com e sem acento, maiúsculas, verbo em outro tempo).
   d) Uma palavra sozinha não basta quando depende do contexto: "queimou a lâmpada" não é incêndio; "a bateria do carro morreu" não é morte. Exija a combinação certa de palavras.
   e) Entrada que não é texto (null, undefined, número) devolve o valor padrão, sem erro.
6. Segredos nunca no código: leia do ambiente (process.env). Sem o segredo, recuse com um erro claro. Valor de demonstração só em modo demo, com nome que deixe isso evidente.
7. Tela (HTML/JS): o botão precisa fazer a ação de verdade (emitir o evento, chamar a função). Guarde o item atual (ex.: o último alerta) para usar no clique, e atualize a tela depois.
8. Entrada inválida responde 400 com mensagem; nada de exceção que derrube o servidor. Valide o tipo e o tamanho do que chega.
9. Node CommonJS (require/module.exports). Não use pacote que não esteja no package.json.
10. Formato da resposta: arquivo pequeno vai inteiro; arquivo grande vai em blocos SEARCH/REPLACE com trecho exato. Nunca use "..." no lugar de código.
11. Se o erro do teste se repetir, mude a abordagem em vez de repetir a mesma ideia.
12. Antes de responder, releia o pedido item por item e confira que CADA item está no código, não só os casos do teste.
13. Função que cria algo (criarX, novoX, fábrica) guarda o estado DENTRO dela (Map, lista, contador), nunca em variável solta no módulo: cada chamada cria um estado novo e separado.
14. CSS: regra com #id vence regra só com classe ou elemento. Para mudar algo num modo especial (ex.: .senior), repita o MESMO #id da regra original no seletor ("body.senior #lista-mural li", não só "body.senior li"); senão a regra nova não vale no navegador.
15. Express: app.use(middleware) só vale para as rotas registradas DEPOIS dele. Um gatilho que precisa valer para todas as rotas (ex.: salvar depois de mudança) vai antes de todas, ou não depende de rota (ex.: conferir a cada 1 s se o estado mudou e salvar).
16. Salvar em arquivo periodicamente: grave SÓ quando o estado mudou desde a última gravação (compare com o que foi gravado por último). Regravar sem mudança gasta disco à toa no PC que hospeda.
17. Ícone em SVG de linha: cada forma com fill="none" e stroke="currentColor" (ou no CSS: svg { fill: none; stroke: currentColor }); sem isso o navegador pinta de PRETO. Feche cada forma com "/>" (<path d="..."/>), senão o resto do desenho fica dentro dela.
18. Função que valida e devolve "item" para gravar: o item leva TODOS os campos que o resto do código usa depois (ex.: "tipo" do robô). Confira o caminho inteiro: salvar -> ler do banco -> usar.
19. Data em Brasília: new Date(Date.parse(iso) - 3 * 3600 * 1000).toISOString().slice(0, 10). Nunca getTimezoneOffset (muda com o fuso da máquina).
20. Dependência injetada (deps.fetch, deps.env, deps.agora) só existe nos TESTES; no servidor ela falta. Sempre com reserva: fetch: (deps && deps.fetch) || ((...a) => fetch(...a)); env: (deps && deps.env) || process.env. Nunca passe "deps && deps.fetch" sozinho (vira undefined). E NUNCA chame a constante de "fetch": "const fetch = ... || ((...a) => fetch(...a))" chama a si mesma; use globalThis.fetch(...a).
21. Zero código de teste em produção: se o teste pede ação estranha (soma, handler de teste), o contrato está errado; não crie isso no app.
22. Botão que só aparece às vezes: const b = el.querySelector('#x'); if (b) b.onclick = ... . prompt() cancelado devolve null: (prompt(...) || '').
23. Teste não exige posição em lista (ex.: "minha aba é a última"); outra mudança quebra o teste à toa.
24. Tarefa que pode rodar de novo (fila, robô, cron) é idempotente: antes de refazer, procure PR JUNTADO da mesma branch/título (não só PR aberto). O squash apaga a branch; sem isso a mesma tarefa vira vários PRs (atualizaEstado.js 9x em 22/11).
25. Laço dentro de job com limite de tempo (Actions 30 min, Worker): tenha prazo (pare de pegar item novo antes do limite), deixe o resto para a próxima rodada e logue cada item feito. Sem prazo o job morre no meio e não registra nada (38 de 40 rodadas do NEXIA Jobs em 22/11).
