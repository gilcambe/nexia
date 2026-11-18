const { decidir } = require('./cloudflare/jules-auto.js');
const assert = require('assert');

const agora = Date.now();
const nomes = (i) => i.labels ? i.labels.map(l => l.name) : [];

// PR Vazio
const prVazio = { title: '', body: '', labels: [] };
const issues = [{ number: 1, labels: [{ name: 'cortex-travado' }] }];

// PR com rótulo revisor-recusou
const prRecusado = { title: '#1', body: 'fix', labels: [{ name: 'revisor-recusou' }] };
const d1 = decidir(issues, [prRecusado], agora, nomes);
assert.strictEqual(d1.enviar, 1, 'Deveria enviar issue 1 porque o PR foi recusado');

// PR normal que bloqueia
const prOk = { title: '#1', body: 'fix', labels: [] };
const d2 = decidir(issues, [prOk], agora, nomes);
assert.strictEqual(d2.enviar, null, 'Não deveria enviar issue 1 porque já tem PR aberto');

console.log('Teste de prDe passou!');
