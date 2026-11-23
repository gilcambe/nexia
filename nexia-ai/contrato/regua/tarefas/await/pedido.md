# Tarefa: validar um token assíncrono

A função `validarToken(token)` é assíncrona: ela retorna uma Promise que resolve em `true` quando o token é válido e `false` quando é inválido.

Implemente `processarToken(token, validarToken)` usando `await` (ou `return await`) para aguardar a Promise antes de devolver o resultado. Sem `await`, o código recebe a Promise em vez do booleano e a validação não funciona corretamente.
