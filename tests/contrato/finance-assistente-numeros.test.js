'use strict';
// Contrato (épico #4013, fase 11; manual seções 7 e 11): o assistente responde número só com o cálculo do servidor.
// "Quanto posso gastar até receber?" = o MESMO tres_numeros do Início (saldo − contas previstas − reserva), com período
// e premissas. Lançamento com data futura não entra em "quanto gastei" (só conta quando acontece, dono 17/11).
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../netlify/functions/prumo.js');
function bancoFalso() {
  const dados = new Map();
  const col = (caminho) => ({
    doc: (id) => ({
      collection: (n) => col(`${caminho}/${id}/${n}`),
      set: async (v) => { dados.set(`${caminho}/${id}`, v); },
      delete: async () => { dados.delete(`${caminho}/${id}`); },
      get: async () => { const v = dados.get(`${caminho}/${id}`); return { exists: !!v, data: () => v }; },
    }),
    get: async () => ({ docs: [...dados.entries()].filter(([k]) => k.startsWith(caminho + '/') && !k.slice(caminho.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }),
    where: () => col(caminho), orderBy: () => col(caminho), limit: () => col(caminho),
  });
  return { collection: col, dados };
}
async function preparar() {
  const banco = bancoFalso(); p.deps.db = () => banco; p.deps.agora = () => new Date('2026-11-20T12:00:00Z');
  return banco;
}
const perguntar = (texto) => p.agir('u1', { acao: 'assistente_perguntar', texto });

test('"quanto posso gastar" bate com o Início e explica o desconto', async () => {
  await preparar();
  assert.equal((await p.agir('u1', { acao: 'conta_salvar', nome: 'Banco', tipo: 'corrente', saldo: 5000 }))[0], 200);
  assert.equal((await p.agir('u1', { acao: 'doc_confirmar', lancamentos: [{ data: '2026-11-28', descricao: 'Aluguel', valor: 1800, tipo: 'despesa', categoria: 'moradia' }] }))[0], 200);
  const ini = await p.agir('u1', { acao: 'inicio_resumo' });
  const tres = ini[1].tres_numeros;
  assert.ok(tres && tres.posso_gastar !== null, 'Início tem tres_numeros');
  const r = await perguntar('Quanto posso gastar até receber?');
  assert.equal(r[0], 200);
  assert.equal(r[1].tipo, 'resposta');
  const valor = 'R$ ' + tres.posso_gastar.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  assert.ok(r[1].resposta.includes(valor), `mesmo valor do Início (${valor}): ${r[1].resposta}`);
  assert.match(r[1].resposta, /30\/11/, 'diz o período');
  assert.match(r[1].fonte, /mesmo cálculo do Início/);
});

test('sem contas: não chuta número', async () => {
  await preparar();
  const r = await perguntar('quanto posso gastar?');
  assert.match(r[1].resposta, /Ainda não sei/);
});

test('despesa com data futura não entra em "quanto gastei"', async () => {
  await preparar();
  await p.agir('u1', { acao: 'doc_confirmar', lancamentos: [
    { data: '2026-11-10', descricao: 'Mercado', valor: 300, tipo: 'despesa', categoria: 'alimentacao' },
    { data: '2026-11-28', descricao: 'Aluguel', valor: 1800, tipo: 'despesa', categoria: 'moradia' }] });
  const r = await perguntar('Quanto gastei este mês?');
  assert.match(r[1].resposta, /300,00/);
  assert.doesNotMatch(r[1].resposta, /2\.100,00/, 'futuro não soma');
});
