'use strict';
// Kernex Finance, fase 5: saúde financeira, "Posso comprar isso?", relatório e assistente.
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../netlify/functions/prumo.js');
const { saudeFinanceira, posso } = require('../../netlify/functions/prumo-lib/saude');
const { parseComando, valorDe, categoriaDe } = require('../../netlify/functions/prumo-lib/assistente');

test('KS1. nota ignora indicador sem dado: com menos de 3 indicadores não há nota, e as lacunas aparecem', () => {
  const pouco = saudeFinanceira({ receitas: 5000, despesas: 4000, saldo: null, despesaMedia: null, limiteTotal: 0, comprometido: 0, limites: [] });
  assert.equal(pouco.nota, null);
  assert.equal(pouco.indicadores.length, 1);
  assert.ok(pouco.lacunas.some((l) => /contas/.test(l)));
  assert.ok(pouco.lacunas.some((l) => /dívidas/.test(l)));
  assert.match(pouco.aviso, /dados suficientes/);
});

test('KS2. nota com dados: poupar 20% = 100, reserva de 3 meses = 50, cartão a 30% = 100; média só dos indicadores existentes', () => {
  const s = saudeFinanceira({ receitas: 5000, despesas: 4000, saldo: 12000, despesaMedia: 4000, limiteTotal: 10000, comprometido: 3000, limites: [{ status: 'ok' }, { status: 'estourado' }] });
  const nota = (id) => s.indicadores.find((x) => x.id === id).nota;
  assert.equal(nota('poupar'), 100);
  assert.equal(nota('reserva'), 50);
  assert.equal(nota('cartao'), 100);
  assert.equal(nota('orcamento'), 50);
  assert.equal(s.nota, 75);
});

test('KS3. posso comprar: à vista maior que o saldo = não; reserva curta = esperar; sem saldo avisa que não sabe; parcela pesada pesa', () => {
  assert.equal(posso({ valor: 3000, parcelas: 1, saldo: 2000, economiaMensal: 500, despesaMedia: 3000, simulacao: null }).veredito, 'não');
  assert.equal(posso({ valor: 1500, parcelas: 1, saldo: 2000, economiaMensal: 500, despesaMedia: 3000, simulacao: null }).veredito, 'melhor esperar');
  assert.equal(posso({ valor: 500, parcelas: 1, saldo: 20000, economiaMensal: 500, despesaMedia: 3000, simulacao: null }).veredito, 'sim');
  const sem = posso({ valor: 500, parcelas: 1, saldo: null, economiaMensal: null, despesaMedia: null, simulacao: null });
  assert.equal(sem.veredito, 'com cuidado');
  assert.match(sem.razoes[0], /não sei seu saldo/i);
  assert.equal(posso({ valor: 1200, parcelas: 6, saldo: 5000, economiaMensal: 150, despesaMedia: 3000, simulacao: null }).veredito, 'melhor esperar');
  assert.equal(posso({ valor: 600, parcelas: 6, saldo: 5000, economiaMensal: 1000, despesaMedia: 3000, simulacao: null }).veredito, 'sim');
  assert.equal(posso({ valor: 3000, parcelas: 3, saldo: 5000, economiaMensal: 1000, despesaMedia: 3000, simulacao: { cabe: false, disponivel_depois: -200 } }).veredito, 'não');
});

test('KS4. assistente entende valores e categorias em português e recusa pagar/transferir/investir', () => {
  assert.equal(valorDe('despesa de R$ 1.234,56 em mercado'), 1234.56);
  assert.equal(valorDe('de 50 reais'), 50);
  assert.equal(categoriaDe('no supermercado'), 'alimentacao');
  assert.equal(parseComando('anote um gasto de 30 reais com uber').descricao, 'uber');
  assert.deepEqual(parseComando('Registre uma despesa de R$ 50 em alimentação'), { tipo: 'registrar_despesa', valor: 50, categoria: 'alimentacao', descricao: 'Alimentação' });
  assert.deepEqual(parseComando('crie um limite de R$ 300 para lazer'), { tipo: 'criar_limite', valor: 300, categoria: 'lazer' });
  assert.match(parseComando('pague R$ 200 da fatura').erro, /não faço pagamentos/);
  assert.match(parseComando('invista 1000 em ações').erro, /não faço/);
  assert.match(parseComando('crie um limite de 300').erro, /categoria/);
  assert.equal(parseComando('quanto tenho?'), null);
});

function bancoFalso() {
  const dados = new Map();
  const col = (c) => ({ doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { dados.set(`${c}/${id}`, v); }, delete: async () => { dados.delete(`${c}/${id}`); }, get: async () => { const v = dados.get(`${c}/${id}`); return { exists: !!v, data: () => v }; } }),
    get: async () => ({ docs: [...dados.entries()].filter(([x]) => x.startsWith(c + '/') && !x.slice(c.length + 1).includes('/')).map(([x, v]) => ({ id: x.split('/').pop(), data: () => v })) }) });
  return { collection: col, dados };
}
async function comBanco(fn) {
  const banco = bancoFalso(); const antes = { db: p.deps.db, agora: p.deps.agora };
  p.deps.db = () => banco; p.deps.agora = () => new Date('2026-11-05T12:00:00Z');
  try { await fn(banco); } finally { Object.assign(p.deps, antes); }
}
const guardados = (b, n) => [...b.dados.keys()].filter((k) => k.includes('/' + n + '/')).length;

test('KS5. comando NÃO grava sem confirmação; só grava depois de assistente_confirmar', async () => {
  await comBanco(async (b) => {
    const prop = (await p.agir('u1', { acao: 'assistente_perguntar', texto: 'Registre uma despesa de R$ 50 em alimentação' }))[1];
    assert.equal(prop.tipo, 'proposta');
    assert.equal(prop.precisa_confirmar, true);
    assert.equal(guardados(b, 'lancamentos'), 0);
    const lim = (await p.agir('u1', { acao: 'assistente_perguntar', texto: 'crie um limite de R$ 300 para lazer' }))[1];
    assert.equal(guardados(b, 'limites'), 0);
    const ok = await p.agir('u1', { acao: 'assistente_confirmar', proposta: prop.proposta });
    assert.equal(ok[0], 200);
    assert.equal(guardados(b, 'lancamentos'), 1);
    await p.agir('u1', { acao: 'assistente_confirmar', proposta: lim.proposta });
    assert.equal(guardados(b, 'limites'), 1);
    assert.equal((await p.agir('u1', { acao: 'assistente_confirmar', proposta: { tipo: 'pagar', valor: 10, categoria: 'lazer' } }))[0], 400);
    assert.equal((await p.agir('u1', { acao: 'assistente_confirmar', proposta: { tipo: 'registrar_despesa', valor: -5, categoria: 'lazer' } }))[0], 400);
  });
});

test('KS6. perguntas respondem com número, fonte e o que falta; o que não entende não vira chute', async () => {
  await comBanco(async () => {
    const vazio = (await p.agir('u1', { acao: 'assistente_perguntar', texto: 'Quanto tenho disponível?' }))[1];
    assert.match(vazio.resposta, /não sei|Ainda não/i);
    await p.agir('u1', { acao: 'conta_salvar', nome: 'Nubank', tipo: 'digital', saldo: 2500 });
    await p.agir('u1', { acao: 'doc_confirmar', lancamentos: [{ data: '2026-11-02', valor: 800, descricao: 'Aluguel', tipo: 'despesa', categoria: 'moradia' }, { data: '2026-11-03', valor: 120, descricao: 'Mercado', tipo: 'despesa', categoria: 'alimentacao' }] });
    const saldo = (await p.agir('u1', { acao: 'assistente_perguntar', texto: 'Quanto tenho disponível hoje?' }))[1];
    assert.match(saldo.resposta, /2\.500,00/);
    assert.ok(saldo.fonte && saldo.atualizado_em);
    const cat = (await p.agir('u1', { acao: 'assistente_perguntar', texto: 'Quanto gastei com alimentação este mês?' }))[1];
    assert.match(cat.resposta, /120,00/);
    assert.match(cat.fonte, /2026-11/);
    assert.match((await p.agir('u1', { acao: 'assistente_perguntar', texto: 'Qual foi minha maior despesa?' }))[1].resposta, /Aluguel.*800,00/);
    const nada = (await p.agir('u1', { acao: 'assistente_perguntar', texto: 'qual a previsão do tempo' }))[1];
    assert.equal(nada.tipo, 'nao_entendi');
    assert.equal((await p.agir('u1', { acao: 'assistente_perguntar', texto: '   ' }))[0], 400);
  });
});

test('KS7. API: saúde, posso comprar e relatório mensal usam os dados reais e listam as lacunas', async () => {
  await comBanco(async () => {
    await p.agir('u1', { acao: 'conta_salvar', nome: 'Nubank', tipo: 'digital', saldo: 2000 });
    await p.agir('u1', { acao: 'doc_confirmar', lancamentos: [{ data: '2026-11-01', valor: 5000, descricao: 'Salário', tipo: 'receita' }, { data: '2026-11-02', valor: 3000, descricao: 'Aluguel e contas', tipo: 'despesa', categoria: 'moradia' }] });
    await p.agir('u1', { acao: 'limite_salvar', categoria: 'moradia', limite: 2000 });
    const s = (await p.agir('u1', { acao: 'saude_financeira' }))[1];
    assert.equal(s.mes, '2026-11');
    assert.ok(s.indicadores.length >= 3);
    assert.ok(s.lacunas.some((l) => /dívidas/.test(l)));
    assert.equal(typeof s.nota, 'number');
    const pc = (await p.agir('u1', { acao: 'posso_comprar', valor: 5000 }))[1];
    assert.equal(pc.veredito, 'não');
    assert.match(pc.razoes[0], /maior que seu saldo/);
    assert.equal((await p.agir('u1', { acao: 'posso_comprar', valor: 0 }))[0], 400);
    assert.equal((await p.agir('u1', { acao: 'posso_comprar', valor: 10, cartao_id: 'x' }))[0], 400);
    const r = (await p.agir('u1', { acao: 'relatorio_mensal' }))[1];
    assert.equal(r.recebeu, 5000);
    assert.equal(r.gastou, 3000);
    assert.equal(r.economizou, 2000);
    assert.ok(r.sem_dados.includes('juros_pagos'));
    assert.ok(r.prioridades.length >= 1 && r.prioridades.length <= 3);
  });
});
