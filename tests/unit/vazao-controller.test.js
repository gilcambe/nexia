'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { VazaoController, calcularPrioridade } = require('../../src/durable/VazaoController.js');

const hojeUtc = () => new Date().toISOString().slice(0, 10);

// Helper para criar mock de SQLite em memória para o test runner
function criarMockSqlite() {
  const tabelas = {
    respostas_andamento: new Map(),
    contadores_provedor: new Map(),
    fila_espera: new Map(),
  };

  return {
    exec(query, ...params) {
      const sql = query.trim().replace(/\s+/g, ' ');

      if (sql.startsWith('CREATE TABLE')) {
        return [];
      }

      // --- respostas_andamento ---
      if (sql.includes('SELECT usuario_id, started_at, request_id FROM respostas_andamento WHERE usuario_id = ?')) {
        const uId = params[0];
        const row = tabelas.respostas_andamento.get(uId);
        return row ? [row] : [];
      }

      if (sql.includes('INSERT INTO respostas_andamento')) {
        const [usuario_id, started_at, request_id] = params;
        tabelas.respostas_andamento.set(usuario_id, { usuario_id, started_at, request_id });
        return [];
      }

      if (sql.includes('DELETE FROM respostas_andamento WHERE usuario_id = ?')) {
        const uId = params[0];
        tabelas.respostas_andamento.delete(uId);
        return [];
      }

      // --- contadores_provedor ---
      if (sql.includes('INSERT INTO contadores_provedor')) {
        const [provedor, data, qtd] = params;
        const chave = `${provedor}:${data}`;
        const atual = (tabelas.contadores_provedor.get(chave) || { provedor, data, contagem: 0 }).contagem;
        tabelas.contadores_provedor.set(chave, { provedor, data, contagem: atual + qtd });
        return [];
      }

      if (sql.includes('SELECT contagem FROM contadores_provedor WHERE provedor = ? AND data = ?')) {
        const [provedor, data] = params;
        const row = tabelas.contadores_provedor.get(`${provedor}:${data}`);
        return row ? [{ contagem: row.contagem }] : [];
      }

      if (sql.includes('SELECT provedor, contagem FROM contadores_provedor WHERE data = ?')) {
        const data = params[0];
        const rows = [];
        for (const row of tabelas.contadores_provedor.values()) {
          if (row.data === data) rows.push({ provedor: row.provedor, contagem: row.contagem });
        }
        return rows;
      }

      // --- fila_espera ---
      if (sql.includes('INSERT INTO fila_espera')) {
        const [id, usuario_id, plano, prioridade, chegada, payload] = params;
        tabelas.fila_espera.set(id, { id, usuario_id, plano, prioridade, chegada, status: 'aguardando', payload });
        return [];
      }

      if (sql.includes('SELECT COUNT(*) as pos FROM fila_espera WHERE status = \'aguardando\'')) {
        let count = 0;
        for (const row of tabelas.fila_espera.values()) {
          if (row.status === 'aguardando') count++;
        }
        return [{ pos: count }];
      }

      if (sql.includes('SELECT id, usuario_id, plano, prioridade, chegada, payload FROM fila_espera WHERE status = \'aguardando\' ORDER BY prioridade DESC, chegada ASC LIMIT 1')) {
        const rows = Array.from(tabelas.fila_espera.values())
          .filter(r => r.status === 'aguardando')
          .sort((a, b) => b.prioridade - a.prioridade || a.chegada - b.chegada);
        return rows.length > 0 ? [rows[0]] : [];
      }

      if (sql.includes('UPDATE fila_espera SET status = \'processando\' WHERE id = ?')) {
        const id = params[0];
        const row = tabelas.fila_espera.get(id);
        if (row) row.status = 'processando';
        return [];
      }

      if (sql.includes('DELETE FROM fila_espera WHERE id = ?')) {
        const id = params[0];
        tabelas.fila_espera.delete(id);
        return [];
      }

      if (sql.includes('SELECT id, usuario_id, plano, prioridade, chegada, status, payload FROM fila_espera WHERE status = ?')) {
        const status = params[0];
        return Array.from(tabelas.fila_espera.values())
          .filter(r => r.status === status)
          .sort((a, b) => b.prioridade - a.prioridade || a.chegada - b.chegada);
      }

      if (sql.includes('SELECT COUNT(*) as total FROM fila_espera WHERE status = ?')) {
        const status = params[0];
        const count = Array.from(tabelas.fila_espera.values()).filter(r => r.status === status).length;
        return [{ total: count }];
      }

      return [];
    },
  };
}

test('VazaoController: prioridade por plano', () => {
  assert.strictEqual(calcularPrioridade('enterprise'), 100);
  assert.strictEqual(calcularPrioridade('pro'), 50);
  assert.strictEqual(calcularPrioridade('pago'), 50);
  assert.strictEqual(calcularPrioridade('gratis'), 10);
  assert.strictEqual(calcularPrioridade('free'), 10);
  assert.strictEqual(calcularPrioridade('desconhecido'), 10);
  assert.strictEqual(calcularPrioridade(85), 85);
});

test('VazaoController: 1 resposta em andamento por usuário', () => {
  const ctrl = new VazaoController();

  const r1 = ctrl.iniciarResposta('usr-1', 'req-100');
  assert.strictEqual(r1.ok, true);
  assert.strictEqual(r1.usuario_id, 'usr-1');

  // Segunda tentativa do mesmo usuário deve ser recusada
  const r2 = ctrl.iniciarResposta('usr-1', 'req-101');
  assert.strictEqual(r2.ok, false);
  assert.strictEqual(r2.motivo, 'resposta_em_andamento');

  // Consulta andamento
  const andamento = ctrl.obterRespostaAndamento('usr-1');
  assert.strictEqual(andamento.usuario_id, 'usr-1');
  assert.strictEqual(andamento.request_id, 'req-100');

  // Finaliza resposta
  const r3 = ctrl.finalizarResposta('usr-1');
  assert.strictEqual(r3.ok, true);
  assert.strictEqual(ctrl.obterRespostaAndamento('usr-1'), null);

  // Agora pode iniciar novamente
  const r4 = ctrl.iniciarResposta('usr-1', 'req-102');
  assert.strictEqual(r4.ok, true);
});

test('VazaoController: contadores por provedor e verificação de cotas', () => {
  const ctrl = new VazaoController();
  const d = hojeUtc();

  const inc1 = ctrl.incrementarProvedor('openai', 500, d);
  assert.strictEqual(inc1.ok, true);
  assert.strictEqual(inc1.contagem, 500);

  const inc2 = ctrl.incrementarProvedor('openai', 300, d);
  assert.strictEqual(inc2.contagem, 800);

  const contadores = ctrl.obterContadores(d);
  assert.strictEqual(contadores.openai, 800);

  const cota = ctrl.verificarCota('openai', 1000);
  assert.strictEqual(cota.usado, 800);
  assert.strictEqual(cota.perto, true); // 800 >= 80% de 1000
  assert.strictEqual(cota.excedido, false);
});

test('VazaoController: fila de espera ordenada por plano e chegada', () => {
  const ctrl = new VazaoController();
  const t0 = 1000;

  ctrl.enfileirar({ id: 'item-1', usuario_id: 'usr-gratis', plano: 'gratis' }, t0);
  ctrl.enfileirar({ id: 'item-2', usuario_id: 'usr-enterprise', plano: 'enterprise' }, t0 + 10);
  ctrl.enfileirar({ id: 'item-3', usuario_id: 'usr-pro', plano: 'pro' }, t0 + 5);

  assert.strictEqual(ctrl.tamanhoFila(), 3);

  // Primeiro a sair deve ser Enterprise (maior prioridade: 100)
  const p1 = ctrl.proximoDaFila();
  assert.strictEqual(p1.id, 'item-2');
  assert.strictEqual(p1.plano, 'enterprise');

  // Segundo a sair deve ser Pro (prioridade: 50)
  const p2 = ctrl.proximoDaFila();
  assert.strictEqual(p2.id, 'item-3');
  assert.strictEqual(p2.plano, 'pro');

  // Terceiro a sair deve ser Gratis (prioridade: 10)
  const p3 = ctrl.proximoDaFila();
  assert.strictEqual(p3.id, 'item-1');
  assert.strictEqual(p3.plano, 'gratis');

  assert.strictEqual(ctrl.proximoDaFila(), null);
});

test('VazaoController: persistência com SQLite mock', () => {
  const state = { storage: { sql: criarMockSqlite() } };
  const ctrl = new VazaoController(state);
  const d = hojeUtc();

  // 1. Resposta em andamento com SQLite
  assert.strictEqual(ctrl.iniciarResposta('u-sql', 'req-sql').ok, true);
  assert.strictEqual(ctrl.iniciarResposta('u-sql').ok, false);
  assert.strictEqual(ctrl.finalizarResposta('u-sql').ok, true);

  // 2. Contadores com SQLite
  ctrl.incrementarProvedor('anthropic', 100, d);
  assert.strictEqual(ctrl.obterContadores(d).anthropic, 100);

  // 3. Fila com SQLite
  ctrl.enfileirar({ id: 'sql-f1', usuario_id: 'u1', plano: 'gratis' }, 100);
  ctrl.enfileirar({ id: 'sql-f2', usuario_id: 'u2', plano: 'enterprise' }, 105);

  const prox = ctrl.proximoDaFila();
  assert.strictEqual(prox.id, 'sql-f2');
  assert.strictEqual(prox.plano, 'enterprise');
});

test('VazaoController: handler HTTP fetch', async () => {
  const ctrl = new VazaoController();

  // GET /status
  const stRes = await ctrl.fetch(new Request('https://do.local/status'));
  assert.strictEqual(stRes.status, 200);
  const stData = await stRes.json();
  assert.strictEqual(stData.durable, 'VazaoController');

  // POST /iniciar
  const iniRes = await ctrl.fetch(new Request('https://do.local/iniciar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario_id: 'u-fetch', request_id: 'r-fetch' }),
  }));
  assert.strictEqual(iniRes.status, 200);

  // POST /iniciar conflito
  const confRes = await ctrl.fetch(new Request('https://do.local/iniciar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario_id: 'u-fetch' }),
  }));
  assert.strictEqual(confRes.status, 409);

  // POST /finalizar
  const finRes = await ctrl.fetch(new Request('https://do.local/finalizar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario_id: 'u-fetch' }),
  }));
  assert.strictEqual(finRes.status, 200);

  // POST /fila/enfileirar e /fila/proximo
  await ctrl.fetch(new Request('https://do.local/fila/enfileirar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'fetch-f1', usuario_id: 'u-f', plano: 'pro' }),
  }));

  const proxRes = await ctrl.fetch(new Request('https://do.local/fila/proximo', { method: 'POST' }));
  const proxData = await proxRes.json();
  assert.strictEqual(proxData.item.id, 'fetch-f1');
});
