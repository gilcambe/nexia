'use strict';
// Correções achadas pela bateria NO AR de 07/11/2026 (scripts/kf-bateria-ao-vivo.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const a = require('../../netlify/functions/prumo-lib/assistente');
const d = require('../../netlify/functions/prumo-lib/documentos');

const dados = { mes: '2026-11', agoraIso: '2026-11-07T12:00:00Z', despesas: 1380.75, receitas: 6500, qtd: 5, por_categoria: {}, saldo: null };

test('assistente entende "Quanto gastei este mês?"', () => {
  for (const q of ['Quanto gastei este mês?', 'quanto gastei?', 'Quanto eu gastei no mês', 'total de gastos']) {
    const r = a.responder(q, dados);
    assert.ok(r, q);
    assert.match(r.resposta, /1\.380,75/, q);
  }
});

test('"Quanto gastei com alimentação?" continua indo para a categoria', () => {
  const r = a.responder('Quanto gastei com alimentação?', { ...dados, por_categoria: { alimentacao: 300 } });
  assert.match(r.resposta, /300/);
});

test('regras do leitor: Pix para outra pessoa é despesa; conta a pagar vira lançamento', () => {
  assert.match(d.LER_DOC, /OUTRA pessoa ou empresa é "despesa"/);
  assert.match(d.LER_DOC, /AINDA A PAGAR/);
});

test('documentos usam também a pista Workers AI (sem chave)', async () => {
  const p = require('../../netlify/functions/prumo.js');
  const chamados = [];
  const ai = { run: async (modelo, req) => { chamados.push(req.messages[0].content.slice(0, 30)); return { response: '{"tipo_documento":"comprovante","lancamentos":[{"data":"2026-10-15","descricao":"Pet Shop","valor":89.9,"tipo":"despesa"}]}' }; } };
  const deps = { ...p.deps, ai, getRouter: () => ({ capabilities: () => ({ available: false }) }), listFor: () => [] };
  const [j] = await d.lerComVisao([{ mime: 'image/jpeg', data: 'AA==' }], deps);
  assert.equal(j.lancamentos[0].valor, 89.9);
  assert.match(chamados[0], /documentos financeiros/);
});
