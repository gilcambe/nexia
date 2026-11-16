Crie o módulo de sessão usando o módulo de token pronto do projeto, `lib/token.js` (funções `assinar` e `validar`).
`abrirSessao(usuarioId, segredo, minutos = 60)` devolve um token com `{ usuarioId, exp }` (exp em milissegundos).
`lerSessao(token, segredo)` devolve o `usuarioId` se o token for válido e não expirado, ou `null`.
Arquivos: `lib/sessao.js`
Teste: `node --test tests/visivel.test.js`
