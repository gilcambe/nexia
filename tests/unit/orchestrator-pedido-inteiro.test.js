'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// O orquestrador trabalhava só com request_summary (500 letras): tarefas longas chegavam cortadas ao modelo.
const raiz = path.join(__dirname, '..', '..', 'nexia-ai');
const orq = fs.readFileSync(path.join(raiz, 'orchestrator', 'index.js'), 'utf8');
const esquema = fs.readFileSync(path.join(raiz, 'vault', 'schemas.js'), 'utf8');

test('PINT1. o pedido inteiro (até 4000) é guardado na execução e usado nos passos', () => {
  assert.match(esquema, /request_text: t\.string\(\{ max: 4000(, scanIgnore: \[[^\]]*\])? \}\)/);
  assert.match(orq, /request_text: message\.slice\(0, 4000\)/);
  assert.match(orq, /const message = exe\.request_text \|\| exe\.request_summary;/);
  assert.match(orq, /planFor\(exe\.intent, exe\.request_text \|\| exe\.request_summary\)/);
});
