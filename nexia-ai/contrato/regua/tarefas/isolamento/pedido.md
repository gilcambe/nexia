Crie o módulo de avisos em tempo real. `criarAvisos()` devolve `{ registrar(clienteId, conexao), avisar(clienteId, mensagem) }`.
`conexao` é um objeto com `enviar(mensagem)`. Um cliente pode ter várias conexões abertas.
`avisar` entrega a mensagem a todas as conexões daquele cliente e devolve quantas receberam.
Arquivos: `src/avisos.js`
Teste: `node --test tests/visivel.test.js`
