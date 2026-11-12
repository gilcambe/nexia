'use strict';
// 12/11/2026: contrato com problema (teste não existe / já passa) não pode ir direto ao Claude Pro sem motivo.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { executar } = require('../../nexia-ai/contrato/executor');

test('CST1. teste que não existe: executor para sem chamar IA e devolve o motivo', async () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'cst-'));
  let chamadas = 0;
  const r = await executar({ contrato: { ok: true, arquivos: ['a.js'], testes: ['tests/nao-existe.test.js'], teste: 'node --test tests/nao-existe.test.js' }, raiz,
    router: { chat: async () => { chamadas++; return { text: '' }; } }, modelos: [{ provider: 'x', model: 'y' }], rodarTeste: async () => ({ ok: false, saida: '' }) });
  assert.equal(r.ok, false);
  assert.equal(r.tentativas, 0);
  assert.match(r.motivo, /não existe/);
  assert.equal(chamadas, 0);
});

test('CST2. o script do contrato trata tentativas 0 ANTES do degrau Claude Pro', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', '..', 'scripts', 'cortex-contrato.js'), 'utf8');
  const guarda = s.indexOf('r.tentativas === 0');
  const claude = s.indexOf('await degrauClaudePro(c, issue)');
  assert.ok(guarda > 0 && claude > 0 && guarda < claude);
  assert.match(s, /console\.log\('  executor: ' \+ r\.motivo\)/);
});
