Crie `criarReserva(corpo)` para o salão de festas. `corpo` vem do usuário (pode ser qualquer coisa).
Campos: `unidade` (texto de 1 a 10 caracteres), `data` (texto AAAA-MM-DD, data que existe) e `convidados` (inteiro de 1 a 100).
Devolve `{ status: 201, json: { ok: true, reserva } }` quando válido, ou `{ status: 400, json: { erro: 'mensagem' } }` quando não. Nunca lança exceção.
Arquivos: `src/reserva.js`
Teste: `node --test tests/visivel.test.js`
