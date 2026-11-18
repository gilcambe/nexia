const { rodar, decidir, ultimaChance, mexeEmWorkflow } = require('./cloudflare/jules-auto.js');
const assert = require('assert');

// #3171: tarefa que NÃO mexe em workflow
const issue3171 = { title: 'Correção de bug simples', body: 'Ajuste no arquivo src/app.js' };
assert.strictEqual(mexeEmWorkflow(issue3171), false, 'Erro: #3171 deveria ser false');

// #2389: tarefa que MEXE em workflow
const issue2389 = { title: 'Pipeline', body: 'Atualização no .github/workflows/ci.yml' };
assert.strictEqual(mexeEmWorkflow(issue2389), true, 'Erro: #2389 deveria ser true');

console.log('Teste de mexeEmWorkflow passou!');
