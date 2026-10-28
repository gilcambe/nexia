'use strict';
// #2322: o mesmo passo falhando em 3+ tarefas = erro de ambiente (1 alerta, 0 tentativas).
// #2323: tarefa que mexe em .github/workflows/ vai direto ao Jules.
const test = require('node:test');
const assert = require('node:assert');
const { decidir, assinaturaDoSmoke, errosDeAmbiente } = require('../../scripts/cortex-fila');

const AGORA = Date.parse('2026-10-28T16:00:00Z');
const issue = (n, labels = [], extra = {}) => ({ number: n, body: `tarefa ${n}`, author_association: 'OWNER', updated_at: '2026-10-28T15:59:00Z', labels: ['cortex-fila', ...labels].map(name => ({ name })), ...extra });
const resumo = 'OK      Login com usuário de teste temporário\nOK      Execução: terminou — succeeded\nFALHOU  Apagar projeto de teste — 428\nFALHOU  Apagar cliente de teste — 428\n\n9/11 OK';

test('AMB1. assinatura ignora o detalhe e não conta falha da própria tarefa', () => {
  assert.equal(assinaturaDoSmoke(resumo), 'Apagar cliente de teste | Apagar projeto de teste');
  assert.equal(assinaturaDoSmoke('FALHOU  Execução: terminou — failed'), null);
  assert.equal(assinaturaDoSmoke('OK  tudo'), null);
});

test('AMB2. 3 tarefas com o mesmo erro: 1 alerta e nenhuma tentativa nova', () => {
  const runs = [1, 2, 3].map(n => ({ id: n * 10, name: `Cortex #${n}`, status: 'completed', conclusion: 'failure', updated_at: new Date(AGORA - 5 * 60000).toISOString(), assinatura: assinaturaDoSmoke(resumo) }));
  const alertas = errosDeAmbiente(runs, AGORA);
  assert.equal(alertas.length, 1);
  assert.deepEqual(alertas[0].tarefas, [1, 2, 3]);
  const a = decidir({ issues: [1, 2, 3].map(n => issue(n, ['cortex-rodando', 'tentativa-4'])), runs, agora: AGORA });
  assert.deepEqual(a.map(x => [x.tipo, x.tentativa, x.conclusao]), [1, 2, 3].map(() => ['reenfileirar', 4, 'erro de ambiente']));
});

test('AMB3. só 2 tarefas (ou erros velhos) não viram alerta', () => {
  const r = (n, min) => ({ id: n, name: `Cortex #${n}`, updated_at: new Date(AGORA - min * 60000).toISOString(), assinatura: 'X' });
  assert.equal(errosDeAmbiente([r(1, 5), r(2, 5)], AGORA).length, 0);
  assert.equal(errosDeAmbiente([r(1, 5), r(2, 5), r(3, 90)], AGORA).length, 0);
});

test('AMB4. tarefa que cita .github/workflows/ vai para o Jules, não para o Cortex', () => {
  const a = decidir({ issues: [issue(1, [], { body: 'Crie .github/workflows/vigia-no-ar.yml' }), issue(2)], runs: [], agora: AGORA });
  assert.deepEqual(a.map(x => [x.tipo, x.numero]), [['para-jules', 1], ['despachar', 2]]);
  const b = decidir({ issues: [issue(1, ['cortex-jules'], { body: 'Crie .github/workflows/x.yml', updated_at: '2026-10-28T08:00:00Z' })], runs: [], agora: AGORA });
  assert.deepEqual(b, [], 'tarefa de workflow com o Jules não volta para o Cortex');
});

test('AMB5. "não edite .github/workflows/" não manda para o Jules', () => {
  const a = decidir({ issues: [issue(1, [], { body: 'Arquivos: scripts/x.js. Não edite `.github/workflows/ci.yml`.' })], runs: [], agora: AGORA });
  assert.equal(a[0].tipo, 'despachar');
});
