'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { decidir } = require('../../cloudflare/jules-auto.js');

test('prDe / decidir: deve ignorar PRs vazios e PRs com rótulo revisor-recusou', () => {
  const issues = [
    { number: 10, title: 'Tarefa X', body: 'Refere-se ao #10', updated_at: new Date(Date.now() - 7200000).toISOString() },
    { number: 11, title: 'Tarefa Y', body: 'Refere-se ao #11', updated_at: new Date(Date.now() - 7200000).toISOString() }
  ];
  const prs = [
    { title: 'PR para #10', body: '', labels: [{ name: 'revisor-recusou' }] },
    { title: 'PR vazio sem mencao', body: '' }
  ];
  const agora = Date.now();
  const nomes = () => ['cortex-travado', 'jules-enviado'];
  
  const d = decidir(issues, prs, agora, nomes, { claudeLigado: true });
  // Como os PRs são ignorados (um é rejeitado e o outro é vazio/sem menção), 
  // as issues devem entrar no retorno de voltar (retomar) por estarem estagnadas > 1h.
  assert.ok(d.retomar.includes(10));
  assert.ok(d.retomar.includes(11));
});
