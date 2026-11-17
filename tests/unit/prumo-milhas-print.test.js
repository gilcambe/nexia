'use strict';
// Kernex Finance, milhas: saldo por print (pontos_print_ler/salvar), viagens e calculadoras (funções puras do front).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const p = require('../../netlify/functions/prumo.js');

function bancoFalso() {
  const dados = new Map();
  const col = (c) => ({ doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { dados.set(`${c}/${id}`, v); }, delete: async () => { dados.delete(`${c}/${id}`); }, get: async () => { const v = dados.get(`${c}/${id}`); return { exists: !!v, data: () => v }; } }),
    get: async () => ({ docs: [...dados.entries()].filter(([x]) => x.startsWith(c + '/') && !x.slice(c.length + 1).includes('/')).map(([x, v]) => ({ id: x.split('/').pop(), data: () => v })) }) });
  return { collection: col, dados };
}
const IMG = (n) => `data:image/png;base64,${Buffer.from('img' + n).toString('base64')}`;
async function comBanco(respostas, fn) {
  const banco = bancoFalso(); const antes = { db: p.deps.db, agora: p.deps.agora, pv: p.deps.perguntarVisao }; const pedidos = [];
  p.deps.db = () => banco; p.deps.agora = () => new Date('2026-11-17T12:00:00Z');
  p.deps.perguntarVisao = async (img, sistema) => { pedidos.push({ img, sistema }); const r = respostas.shift(); return typeof r === 'string' ? r : JSON.stringify(r); };
  try { await fn(banco, pedidos); } finally { p.deps.db = antes.db; p.deps.agora = antes.agora; p.deps.perguntarVisao = antes.pv; }
}
const calc = () => { const window = { MB: {} }; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../prumo/milhas.js'), 'utf8'), { window }); return window.MB.milhas; };

test('print: cada imagem é lida separada, programa/saldo/vencimento certos, falha não derruba as outras', async () => {
  await comBanco([
    { programa: 'smiles', saldo: '45.300', a_vencer: [{ pontos: 5000, data: '2027-03-10' }, { pontos: 2000, data: '2026-12-31' }] },
    'isto não é json',
    { programa: 'TudoAzul', saldo: 1200, a_vencer: [] },
  ], async (_b, pedidos) => {
    const [st, r] = await p.agir('u1', { acao: 'pontos_print_ler', imagens: [IMG(1), IMG(2), IMG(3)] });
    assert.equal(st, 200);
    assert.equal(pedidos.length, 3, '1 chamada por imagem');
    assert.deepEqual(r.lidos[0], { ok: true, pontos: { programa: 'Smiles', saldo: 45300, validade: '2026-12-31', a_vencer_pontos: 2000 } });
    assert.equal(r.lidos[1].ok, false);
    assert.equal(r.lidos[2].pontos.programa, 'Azul Fidelidade', 'TudoAzul = Azul Fidelidade');
    assert.equal(r.lidos[2].pontos.validade, null);
    assert.equal((await p.agir('u1', { acao: 'pontos_print_ler', imagens: [] }))[0], 400);
  });
});

test('print salvar: atualiza programa existente sem perder cartão e valor do milheiro; cria se não existe', async () => {
  await comBanco([], async (banco) => {
    await p.agir('u1', { acao: 'pontos_salvar', programa: 'Smiles', saldo: 1000, valor_milheiro: 16, cartao_id: 'c9' });
    const [, a] = await p.agir('u1', { acao: 'pontos_print_salvar', programa: 'smiles', saldo: 45300, validade: '2026-12-31', a_vencer_pontos: 2000 });
    assert.equal(a.atualizado, true);
    const [, l] = await p.agir('u1', { acao: 'pontos_listar' });
    assert.equal(l.itens.length, 1, 'não duplicou');
    assert.equal(l.itens[0].saldo, 45300); assert.equal(l.itens[0].valor_milheiro, 16); assert.equal(l.itens[0].cartao_id, 'c9');
    assert.equal(l.itens[0].validade, '2026-12-31'); assert.equal(l.itens[0].programa, 'Smiles');
    assert.equal(l.vencendo.length, 0, 'vence em 44 dias: fora da janela de 30');
    const [, b] = await p.agir('u1', { acao: 'pontos_print_salvar', programa: 'Livelo', saldo: 8000 });
    assert.equal(b.atualizado, false);
    assert.equal((await p.agir('u1', { acao: 'pontos_listar' }))[1].itens.length, 2);
    assert.equal((await p.agir('u1', { acao: 'pontos_print_salvar', programa: 'Livelo', saldo: -5 }))[0], 400);
    // a folha de ponto do Salário vive na mesma coleção e não pode aparecer como programa
    banco.dados.set('prumo_users/u1/pontos/2026-11', { mes: '2026-11', he50: 3 });
    assert.equal((await p.agir('u1', { acao: 'pontos_listar' }))[1].itens.length, 2);
    assert.equal((await p.agir('u1', { acao: 'milhas_visao' }))[1].programas.length, 2);
  });
});

test('viagens: salvar, listar por data, validar e apagar', async () => {
  await comBanco([], async () => {
    const v = { origem: 'GRU', destino: 'LIS', data_ida: '2027-02-10', data_volta: '2027-02-24', preco_dinheiro: '4.500,50', milhas: 90000, taxas: 350, programa: 'smiles' };
    const [st, s] = await p.agir('u1', { acao: 'viagem_salvar', ...v });
    assert.equal(st, 200); assert.equal(s.item.preco_dinheiro, 4500.5); assert.equal(s.item.programa, 'Smiles');
    await p.agir('u1', { acao: 'viagem_salvar', origem: 'GRU', destino: 'GIG', data_ida: '2027-01-05', preco_dinheiro: 500, milhas: 10000 });
    const [, l] = await p.agir('u1', { acao: 'viagem_listar' });
    assert.deepEqual(l.viagens.map((x) => x.destino), ['GIG', 'LIS']);
    assert.equal(l.viagens[0].taxas, 0);
    for (const ruim of [{ ...v, origem: '' }, { ...v, data_ida: 'x' }, { ...v, data_volta: '2027-01-01' }, { ...v, preco_dinheiro: 0 }, { ...v, milhas: 0 }, { ...v, taxas: -1 }]) assert.equal((await p.agir('u1', { acao: 'viagem_salvar', ...ruim }))[0], 400);
    assert.equal((await p.agir('u1', { acao: 'viagem_apagar', id: s.id }))[0], 200);
    assert.equal((await p.agir('u1', { acao: 'viagem_listar' }))[1].viagens.length, 1);
    assert.equal((await p.agir('u1', { acao: 'viagem_apagar' }))[0], 400);
  });
});

test('calculadora: custo do milheiro (conferido à mão)', () => {
  const m = calc();
  assert.deepEqual({ ...m.custoMilheiro({ preco: 600, milhas: 20000 }) }, { milhas_total: 20000, custo_milheiro: 30 });
  assert.deepEqual({ ...m.custoMilheiro({ preco: '300,00', milhas: 10000, bonus_pct: 100 }) }, { milhas_total: 20000, custo_milheiro: 15 });
  assert.ok(m.custoMilheiro({ preco: 10, milhas: 0 }).erro);
});
test('calculadora: transferência com bônus', () => {
  const m = calc();
  assert.deepEqual({ ...m.transferencia({ pontos: 10000, bonus_pct: 100, custo_milheiro_banco: 35 }) }, { milhas: 20000, bonus_milhas: 10000, custo_total: 350, custo_efetivo_milheiro: 17.5 });
  const s = m.transferencia({ pontos: 10000, bonus_pct: 80 });
  assert.equal(s.milhas, 18000); assert.equal(s.custo_efetivo_milheiro, null);
});
test('calculadora: vale assinar o clube?', () => {
  const m = calc();
  const sim = m.clube({ mensalidade: 42, milhas_mes: 2000, bonus_pct: 100, referencia: 20 });
  assert.deepEqual({ ...sim }, { milhas_efetivas: 4000, custo_milheiro_clube: 10.5, custo_avulso: 80, economia_mensal: 38, economia_anual: 456, vale: true });
  const nao = m.clube({ mensalidade: 50, milhas_mes: 1000, referencia: 20 });
  assert.equal(nao.vale, false); assert.equal(nao.economia_mensal, -30);
});
test('calculadora: valor da carteira e referências editáveis', () => {
  const m = calc();
  const cart = [{ programa: 'Smiles', saldo: 50000, valor_milheiro: 16 }, { programa: 'LATAM Pass', saldo: 10000 }];
  const v = m.valorCarteira(cart);
  assert.equal(v.linhas[0].valor, 800); assert.equal(v.linhas[1].valor, 250); assert.equal(v.total, 1050);
  assert.equal(v.linhas[1].origem, 'estimativa padrão');
  assert.equal(m.valorCarteira(cart, { Smiles: 20 }).total, 1250);
});
test('viagem: compensa x dinheiro, emitir e links oficiais', () => {
  const m = calc();
  const viagem = { origem: 'GRU', destino: 'LIS', data_ida: '2027-02-10', data_volta: '2027-02-24', programa: 'Smiles', milhas: 30000, taxas: 80, preco_dinheiro: 1200 };
  const a = m.analisarViagem(viagem, [{ programa: 'Smiles', saldo: 50000, valor_milheiro: 16 }]);
  assert.equal(a.custo_milhas, 480); assert.equal(a.custo_total_milhas, 560); assert.equal(a.economia, 640); assert.equal(a.compensa, true);
  assert.equal(a.valor_milheiro_resgate, 37.33); assert.equal(a.emitir, true); assert.match(a.aviso_emitir, /Dá para emitir.*Smiles/);
  const b = m.analisarViagem({ ...viagem, preco_dinheiro: 400 }, [{ programa: 'Smiles', saldo: 10000, valor_milheiro: 16 }, { programa: 'Livelo', saldo: 25000 }]);
  assert.equal(b.compensa, false); assert.equal(b.economia, -160); assert.equal(b.emitir, true); assert.match(b.aviso_emitir, /transferir/);
  const c = m.analisarViagem({ ...viagem, milhas: 60000 }, [{ programa: 'Smiles', saldo: 10000 }, { programa: 'Livelo', saldo: 25000 }]);
  assert.equal(c.emitir, false); assert.match(c.aviso_emitir, /Faltam 25\.000/);
  const links = m.linksViagem(viagem);
  assert.deepEqual([...links.map((l) => l.nome)], ['Smiles', 'LATAM', 'Azul', 'Google Voos']);
  for (const l of links) assert.match(l.url, /^https:\/\/(www\.smiles\.com\.br|www\.latamairlines\.com|www\.voeazul\.com\.br|www\.google\.com)\//);
  assert.match(links[3].url, /GRU.*LIS.*2027-02-10/);
});
