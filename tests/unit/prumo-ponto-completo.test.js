'use strict';
// 18/11 (dono): a folha de ponto não mudava a previsão. Folha real: HE 100% 36:39, HE 75% 03:34, Noturno 210:05,
// Sobreaviso 72:00. Regras: he75 e sobreaviso entram no cálculo; "36:39" vira 36,65 h; a folha do mês volta na
// previsão (para mostrar/editar) e pode ser apagada.
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../netlify/functions/prumo.js');
const folha = require('../../netlify/functions/prumo-lib/folha.js');

function banco() {
  const dados = new Map();
  const col = (c) => ({ path: c, doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { dados.set(`${c}/${id}`, v); }, delete: async () => { dados.delete(`${c}/${id}`); }, get: async () => { const v = dados.get(`${c}/${id}`); return { exists: !!v, data: () => v }; } }),
    get: async () => ({ docs: [...dados.entries()].filter(([k]) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }), where: () => col(c), orderBy: () => col(c), limit: () => col(c) });
  return { collection: col };
}

test('HE 75% e sobreaviso entram no bruto (sobreaviso = 1/3 da hora)', () => {
  const base = { mes: '2026-11', salario_base: 2200, jornada_mensal: 220 };
  const sem = folha.estimarFechamento(base);
  const com = folha.estimarFechamento({ ...base, ponto: { he75: 2, sobreaviso: 3 } });
  const linha = (r, n) => r.linhas.find((l) => l.nome === n).valor;
  assert.equal(linha(com, 'Horas extras'), 35); // 10/h × 1,75 × 2
  assert.equal(linha(com, 'Sobreaviso'), 10); // 10/h ÷ 3 × 3
  assert.ok(com.bruto > sem.bruto);
});

test('folha salva com "36:39" muda a previsão, volta para a tela e pode ser apagada', async () => {
  const b = banco(); p.deps.db = () => b; p.deps.agora = () => new Date('2026-11-18T12:00:00Z');
  await p.agir('u1', { acao: 'salario_config', salario_base: 8868.69 });
  const antes = (await p.agir('u1', { acao: 'salario_previsao', mes: '2026-11' }))[1].previsao.a_receber;
  const s = await p.agir('u1', { acao: 'ponto_salvar', mes: '2026-11', he75: '03:34', he100: '36:39', noturnas: '210:05', sobreaviso: '72:00', he50: '', faltas: '' });
  assert.equal(s[0], 200, JSON.stringify(s[1]));
  const r = (await p.agir('u1', { acao: 'salario_previsao', mes: '2026-11' }))[1];
  assert.equal(r.ponto.he100, 36.65);
  assert.equal(r.ponto.sobreaviso, 72);
  assert.ok(r.previsao.a_receber > antes + 1000, `previsão ${antes} → ${r.previsao.a_receber}`);
  assert.equal((await p.agir('u1', { acao: 'ponto_apagar', mes: '2026-11' }))[0], 200);
  const depois = (await p.agir('u1', { acao: 'salario_previsao', mes: '2026-11' }))[1];
  assert.equal(depois.ponto, null);
  assert.equal(depois.previsao.a_receber, antes);
});
