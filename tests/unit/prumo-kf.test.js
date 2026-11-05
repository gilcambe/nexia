'use strict';
// Kernex Finance: documentos, lançamentos, contas, dívidas, painel e simuladores (backend), com banco e IA falsos.
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../netlify/functions/prumo.js');
const motor = require('../../netlify/functions/prumo-lib/motor');
const kf = require('../../netlify/functions/prumo-lib/kf');

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
  });
  return { collection: col, dados };
}
const PNG = 'data:image/png;base64,iVBORw0KGgo=';
function preparar(respostaIA) {
  const db = bancoFalso();
  const original = { ...p.deps };
  p.deps.db = () => db;
  p.deps.agora = () => new Date('2026-11-10T12:00:00Z');
  p.deps.listFor = () => [{ provider: 'google', model: 'fake' }];
  p.deps.getRouter = () => ({ capabilities: () => ({ available: true, vision: true }), chat: async () => ({ text: JSON.stringify(respostaIA) }) });
  return { db, restaurar: () => Object.assign(p.deps, original) };
}
const agir = (acao, corpo) => p.agir('u1', { acao, ...corpo });

test('KF5. doc_enviar lê a fatura, não grava nada e separa duvidoso e duplicado; salvar é idempotente', async () => {
  const ia = { documento: 'fatura', instituicao: 'Nubank', total_documento: 150, lancamentos: [
    { data: '2026-11-02', descricao: 'Mercado', estabelecimento: 'Mercado Zé', valor: 100, tipo: 'despesa', categoria: 'alimentacao', confianca: 0.95 },
    { data: '02/11/2026', descricao: 'MERCADO ZE', estabelecimento: 'MERCADO ZE', valor: '100,00', tipo: 'despesa', confianca: 0.9 },
    { data: '2026-11-03', descricao: 'Borrado', valor: 50, tipo: 'despesa', confianca: 0.3 },
    { data: '2026-11-04', descricao: 'Pagamento da fatura', valor: 2000, tipo: 'pagamento_fatura', confianca: 0.99 },
    { data: '', descricao: 'Sem data', valor: 10 },
  ] };
  const { db, restaurar } = preparar(ia);
  try {
    const [st, r] = await agir('doc_enviar', { imagens: [PNG] });
    assert.equal(st, 200);
    assert.equal(db.dados.size, 0, 'nada gravado antes da conferência');
    assert.equal(r.novos.filter((l) => l.tipo === 'despesa').length, 1);
    assert.ok(r.conferir.length >= 3);
    const salvar1 = await agir('lanc_salvar_lote', { itens: r.novos });
    assert.equal(salvar1[1].salvos, 2); // despesa + pagamento da fatura (movimento, fora do total)
    const salvar2 = await agir('lanc_salvar_lote', { itens: r.novos });
    assert.equal(salvar2[1].salvos, 0);
    const [, lista] = await agir('lanc_listar', { mes: '2026-11' });
    assert.equal(lista.despesas, 100);
    assert.equal(lista.receitas, 0);
  } finally { restaurar(); }
});

test('KF6. doc_enviar: segundo extrato com a mesma compra não duplica contra o que já foi salvo', async () => {
  const { restaurar } = preparar({ documento: 'extrato', lancamentos: [{ data: '2026-11-02', descricao: 'Mercado Zé', estabelecimento: 'Mercado Zé', valor: 100, tipo: 'despesa', confianca: 1 }] });
  try {
    const [, a] = await agir('doc_enviar', { imagens: [PNG] });
    await agir('lanc_salvar_lote', { itens: a.novos });
    const [, b] = await agir('doc_enviar', { imagens: [PNG] });
    assert.equal(b.novos.length, 0);
    assert.match(b.conferir[0].motivo, /duplicidade/);
  } finally { restaurar(); }
});

test('KF7. IA fora do ar devolve 503 amigável; imagem inválida 400', async () => {
  const { restaurar } = preparar({});
  p.deps.getRouter = () => ({ capabilities: () => ({ available: true, vision: true }), chat: async () => { throw new Error('x'); } });
  try {
    assert.equal((await agir('doc_enviar', { imagens: [PNG] }))[0], 503);
    assert.equal((await agir('doc_enviar', { imagens: ['lixo'] }))[0], 400);
  } finally { restaurar(); }
});

test('KF8. contas e dívidas: validação e estratégia (avalanche paga menos juros que bola de neve neste caso)', async () => {
  const { restaurar } = preparar({});
  try {
    assert.equal(kf.validarConta({ nome: '' }).ok, false);
    assert.equal(kf.validarDivida({ nome: 'X', saldo: 10, juros_mes: 99 }).ok, false);
    await agir('divida_salvar', { nome: 'Cartão', saldo: 3000, juros_mes: 12, parcela_minima: 300 });
    await agir('divida_salvar', { nome: 'Empréstimo', saldo: 5000, juros_mes: 3, parcela_minima: 250 });
    await agir('divida_salvar', { nome: 'Loja', saldo: 800, juros_mes: 6, parcela_minima: 80 });
    const [st, r] = await agir('divida_estrategia', { extra: 300 });
    assert.equal(st, 200);
    assert.equal(r.melhor, 'avalanche');
    assert.ok(r.avalanche.jurosPagos < r.bola_de_neve.jurosPagos);
    assert.equal(r.avalanche.ordem[0], 'Cartão');
    assert.equal((await agir('divida_estrategia', { extra: -1 }))[0], 400);
  } finally { restaurar(); }
});

test('KF9. painel: patrimônio desconta dívidas, limite do cartão não é saldo, e sem dados mostra lacunas em vez de nota', async () => {
  const { restaurar } = preparar({});
  try {
    const [, vazio] = await agir('painel', {});
    assert.equal(vazio.saude.nota, null);
    assert.ok(vazio.lacunas.length >= 3);
    await agir('conta_salvar', { nome: 'Itaú', tipo: 'corrente', saldo: 2000 });
    await agir('cartao_salvar', { nome: 'Nubank', limite: 9000, dia_fechamento: 3, dia_vencimento: 12 });
    await agir('divida_salvar', { nome: 'Cartão', saldo: 500, juros_mes: 10, parcela_minima: 100 });
    await agir('carteira_salvar', { nome: 'CDB', banco: 'Inter', tipo: 'renda_fixa', valor: 8000, data_valor: '2026-11-01' });
    await agir('lanc_salvar_lote', { itens: [{ data: '2026-11-05', descricao: 'Salário', valor: 5000, tipo: 'receita' }, { data: '2026-11-06', descricao: 'Aluguel', valor: 1500, tipo: 'despesa' }] });
    const [, r] = await agir('painel', {});
    assert.equal(r.saldo_disponivel, 2000);
    assert.equal(r.patrimonio_liquido, 2000 + 8000 - 500);
    assert.equal(r.renda_mes, 5000);
    assert.equal(r.despesas_mes, 1500);
    assert.equal(r.sobra_mes, 3500);
    assert.ok(r.saude.nota > 0);
    assert.ok(r.proximos.some((x) => x.tipo === 'fatura' && x.nome === 'Nubank'));
    assert.ok(r.meses_reserva > 6);
  } finally { restaurar(); }
});

test('KF10. posso_comprar, futuro_simular e milhas_calcular usam só o motor e validam entrada', async () => {
  const { restaurar } = preparar({});
  try {
    await agir('conta_salvar', { nome: 'Itaú', saldo: 5000 });
    await agir('lanc_salvar_lote', { itens: [{ data: '2026-11-05', descricao: 'Salário', valor: 4000, tipo: 'receita' }, { data: '2026-11-06', descricao: 'Contas', valor: 3500, tipo: 'despesa' }] });
    const [, nao] = await agir('posso_comprar', { valor: 2000, parcelas: 1 });
    assert.equal(nao.veredito, 'nao'); // sobra de 500 não cobre 2000 em parcela única
    const [, sim] = await agir('posso_comprar', { valor: 600, parcelas: 6 });
    assert.equal(sim.parcela, 100);
    assert.equal((await agir('posso_comprar', { valor: 0 }))[0], 400);
    const [, f] = await agir('futuro_simular', { inicial: 1000, aporte: 500, meses: 12, taxa_anual: 0, inflacao_anual: 0, meta: 7000 });
    assert.equal(f.nominal, 7000);
    assert.equal(f.aporte_necessario, 500);
    assert.equal((await agir('futuro_simular', { meses: 0 }))[0], 400);
    const [, m] = await agir('milhas_calcular', { preco: 300, milhas: 10000, pontos: 10000, bonus_pct: 100, preco_dinheiro: 1000, milhas_resgate: 30000, valor_milheiro: 20, taxas: 100 });
    assert.equal(m.custo_milheiro, 30);
    assert.equal(m.milhas_com_bonus, 20000);
    assert.equal(m.resgate.custoMilhas, 700);
    assert.equal(m.resgate.compensa, true);
    assert.equal((await agir('milhas_calcular', {}))[0], 400);
  } finally { restaurar(); }
});

test('KF11. motor: saúde só usa indicadores com dado; reserva sem despesa não inventa; projeção real desconta inflação', () => {
  const s = motor.saudeFinanceira({ renda: 0, despesas: null, parcelasDividas: null, reservaMeses: 6, dividaTotal: null, patrimonioAtivos: 0, vencidas: null });
  assert.equal(s.nota, 100);
  assert.ok(s.lacunas.includes('Capacidade de poupar'));
  assert.equal(motor.mesesReserva(1000, 0), null);
  const pr = motor.projecao({ inicial: 1000, meses: 12, taxaAnual: 10, inflacaoAnual: 10 });
  assert.equal(pr.real, 1000);
  assert.equal(motor.estrategiaDividas([{ nome: 'x', saldo: 1000, juros_mes: 20, parcela_minima: 10 }], 0, 'avalanche').viavel, false);
});
