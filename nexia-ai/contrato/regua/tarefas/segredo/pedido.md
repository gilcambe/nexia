Crie `lerConfig(env)` que monta a configuração do servidor a partir das variáveis de ambiente (`env` é um objeto como process.env).
`segredo`: vem de `env.SEGREDO` e precisa ter pelo menos 32 caracteres. `porta`: `env.PORTA` como número (padrão 3000).
Modo demonstração (`env.DEMO === 'true'`) sem SEGREDO usa um segredo fixo só de teste. Fora do modo demo, sem segredo válido, lança um erro com `code = 'SEGREDO_FRACO'`.
Arquivos: `src/config.js`
Teste: `node --test tests/visivel.test.js`
