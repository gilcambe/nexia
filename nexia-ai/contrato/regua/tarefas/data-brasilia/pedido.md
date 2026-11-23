# Tarefa: Obter Data de Brasília

O objetivo é obter a data e hora atual em Brasília (UTC-3).

### Requisito
- Não deve ser utilizado `getTimezoneOffset`.
- Deve subtrair 3 horas do tempo UTC.

### Implementação
A lógica deve ser: `new Date(Date.now() - 3 * 60 * 60 * 1000)`.
