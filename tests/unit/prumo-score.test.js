'use strict';
// Kernex Finance: score de crédito (print/digitado), leitura de print em Contas/Cartões/Dívidas e saúde financeira parcial.
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../netlify/functions/prumo.js');
const { faixaDe, validarScore, resumirScores, dicasPara } = require('../../netlify/functions/prumo-lib/score');
const { saudeFinanceira } = require('../../netlify/functions/prumo-lib/saude');
const { COLECOES } = require('../../netlify/functions/prumo-lib/ajuda');

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
const IMG = (n) => `data:image/png;base64,${Buffer.from('img' + n).toString('base64')}`;
function preparar(respostas) {
  const banco = bancoFalso(); const pedidos = [];
  p.deps.db = () => banco;
  p.deps.agora = () => new Date('2026-11-20T12:00:00Z');
  p.deps.perguntarVisao = async (img, sistema) => { pedidos.push({ img, sistema }); const r = respostas.shift(); return typeof r === 'string' ? r : JSON.stringify(r); };
  return { banco, pedidos };
}

test('faixas: Serasa (oficial) e SPC/Boa Vista (SUPOSIÇÃO, marcadas como estimativa)', () => {
  assert.deepEqual(faixaDe('serasa', 300), { nome: 'baixo', suposicao: false });
  assert.equal(faixaDe('serasa', 301).nome, 'regular');
  assert.equal(faixaDe('serasa', 700).nome, 'bom');
  assert.equal(faixaDe('serasa', 701).nome, 'excelente');
  assert.deepEqual(faixaDe('spc', 750), { nome: 'muito bom', suposicao: true });
  assert.equal(faixaDe('boavista', 1000).nome, 'excelente');
  assert.equal(faixaDe('boavista', 0).nome, 'baixo');
});

test('validarScore: birô, 0 a 1000 inteiro, data padrão = hoje, sem data futura', () => {
  const hoje = '2026-11-20';
  assert.deepEqual(validarScore({ biro: 'Serasa', score: '742' }, hoje), { ok: true, item: { biro: 'serasa', score: 742, data: hoje } });
  assert.equal(validarScore({ biro: 'Boa Vista', score: 500, data: '2026-11-01' }, hoje).item.biro, 'boavista');
  assert.equal(validarScore({ biro: 'xyz', score: 500 }, hoje).ok, false);
  assert.equal(validarScore({ biro: 'spc', score: 1001 }, hoje).ok, false);
  assert.equal(validarScore({ biro: 'spc', score: -1 }, hoje).ok, false);
  assert.equal(validarScore({ biro: 'spc', score: 5.5 }, hoje).ok, false);
  assert.equal(validarScore({ biro: 'spc', score: 500, data: '2027-01-01' }, hoje).ok, false);
  assert.equal(validarScore({ biro: 'spc', score: 500, data: '20/11/2026' }, hoje).ok, false);
});

test('resumirScores: último de cada birô, variação contra o anterior, 3 dicas', () => {
  const r = resumirScores([
    { biro: 'serasa', score: 600, data: '2026-09-01' }, { biro: 'serasa', score: 650, data: '2026-11-01' },
    { biro: 'spc', score: 480, data: '2026-10-10' },
  ]);
  assert.equal(r.por_biro.serasa.score, 650);
  assert.equal(r.por_biro.serasa.variacao, 50);
  assert.equal(r.por_biro.serasa.anterior, 600);
  assert.equal(r.por_biro.serasa.faixa, 'bom');
  assert.equal(r.por_biro.spc.variacao, null);
  assert.equal(r.por_biro.spc.faixa_suposicao, true);
  assert.equal(r.por_biro.boavista, undefined);
  assert.equal(r.dicas.length, 3);
  assert.notDeepEqual(dicasPara('baixo'), dicasPara('excelente'));
});

test('score_salvar / score_listar: grava na coleção do usuário, histórico por data, mesmo dia não duplica', async () => {
  const { banco } = preparar([]);
  assert.equal((await p.agir('u1', { acao: 'score_salvar', biro: 'serasa', score: 600, data: '2026-10-01' }))[0], 200);
  assert.equal((await p.agir('u1', { acao: 'score_salvar', biro: 'serasa', score: 640, data: '2026-11-01' }))[0], 200);
  await p.agir('u1', { acao: 'score_salvar', biro: 'serasa', score: 645, data: '2026-11-01' });
  const bad = await p.agir('u1', { acao: 'score_salvar', biro: 'serasa', score: 2000 });
  assert.equal(bad[0], 400);
  assert.equal(typeof bad[1].error, 'string');
  const l = await p.agir('u1', { acao: 'score_listar' });
  assert.equal(l[0], 200);
  assert.equal(l[1].por_biro.serasa.score, 645);
  assert.equal(l[1].por_biro.serasa.variacao, 45);
  assert.equal(l[1].por_biro.serasa.historico.length, 2);
  assert.ok([...banco.dados.keys()].every((k) => /\/scores\//.test(k)), 'só a coleção scores foi usada');
  const outro = await p.agir('u2', { acao: 'score_listar' });
  assert.deepEqual(outro[1].por_biro, {}, 'outro usuário não vê');
});

test('score_print_ler: 1 chamada por imagem, valida e devolve um item por imagem', async () => {
  const { pedidos } = preparar([{ biro: 'serasa', score: 712, data: '2026-11-18' }, 'sem leitura', { biro: 'spc', score: 9999 }, { biro: 'boavista', score: 410, data: '' }]);
  const r = await p.agir('u1', { acao: 'score_print_ler', imagens: [IMG(1), IMG(2), IMG(3), IMG(4)] });
  assert.equal(r[0], 200);
  assert.equal(pedidos.length, 4);
  assert.deepEqual(r[1].lidos[0], { ok: true, score: { biro: 'serasa', score: 712, data: '2026-11-18' } });
  assert.equal(r[1].lidos[1].ok, false);
  assert.equal(r[1].lidos[2].ok, false);
  assert.deepEqual(r[1].lidos[3].score, { biro: 'boavista', score: 410, data: '2026-11-20' });
  assert.match(pedidos[0].sistema, /Serasa/);
  assert.equal((await p.agir('u1', { acao: 'score_print_ler', imagens: [] }))[0], 400);
});

test('"apagar meus dados" cobre a coleção scores', () => {
  assert.ok(COLECOES.includes('scores'));
});

test('conta_print_ler / cartao_print_ler / divida_print_ler: lê, valida e NÃO salva nada', async () => {
  const { banco } = preparar([
    { nome: 'Conta', instituicao: 'Nubank', saldo: 'R$ 1.234,56', tipo: 'corrente' },
    { nome: 'Roxinho', bandeira: 'Mastercard', limite: 8000, fatura_atual: 1520.9, dia_vencimento: 10, dia_fechamento: 3 },
    { credor: 'Banco X', tipo: 'emprestimo', saldo: 12000, parcela: 450, juros_mes: 2.5, cet_ano: 40, dia_vencimento: 5 },
  ]);
  const c = await p.agir('u1', { acao: 'conta_print_ler', imagens: [IMG(1)] });
  assert.deepEqual(c[1].lidos[0].conta, { nome: 'Conta', tipo: 'corrente', instituicao: 'Nubank', saldo: 1234.56, moeda: 'BRL' });
  const k = await p.agir('u1', { acao: 'cartao_print_ler', imagens: [IMG(2)] });
  assert.deepEqual(k[1].lidos[0].cartao, { nome: 'Roxinho', bandeira: 'Mastercard', limite: 8000, fatura_atual: 1520.9, dia_vencimento: 10, dia_fechamento: 3 });
  const d = await p.agir('u1', { acao: 'divida_print_ler', imagens: [IMG(3)] });
  assert.deepEqual(d[1].lidos[0].divida, { credor: 'Banco X', tipo: 'emprestimo', saldo: 12000, parcela: 450, juros_mes: 2.5, dia_vencimento: 5, cet_ano: 40 });
  assert.equal(banco.dados.size, 0, 'ler não grava: o usuário confere antes');
});

test('leitura de print: o que a IA não achou vira erro simples; tipo desconhecido vira padrão', async () => {
  preparar([{ nome: 'x' }, { nome: 'Cartão' }, { credor: 'Y' }, { nome: 'Z', tipo: 'banana', saldo: 10 }]);
  const c = await p.agir('u1', { acao: 'conta_print_ler', imagens: [IMG(1)] });
  assert.equal(c[1].lidos[0].ok, false);
  const k = await p.agir('u1', { acao: 'cartao_print_ler', imagens: [IMG(1)] });
  assert.equal(k[1].lidos[0].ok, false);
  const d = await p.agir('u1', { acao: 'divida_print_ler', imagens: [IMG(1)] });
  assert.equal(d[1].lidos[0].ok, false);
  const c2 = await p.agir('u1', { acao: 'conta_print_ler', imagens: [IMG(1)] });
  assert.equal(c2[1].lidos[0].conta.tipo, 'corrente');
});

test('saúde financeira: com pouco dado há nota parcial, o que falta e o próximo passo; sem dado nenhum, só o próximo passo', () => {
  const vazio = saudeFinanceira({ receitas: 0, despesas: 0, saldo: null, despesaMedia: null, limiteTotal: 0, comprometido: 0, limites: [] });
  assert.equal(vazio.nota, null);
  assert.equal(vazio.nota_parcial, null);
  assert.equal(vazio.completa, false);
  assert.match(vazio.resumo, /faltam 3 indicadores/);
  assert.ok(vazio.proximo_passo.length > 10);
  const pouco = saudeFinanceira({ receitas: 5000, despesas: 4000, saldo: null, despesaMedia: null, limiteTotal: 0, comprometido: 0, limites: [] });
  assert.equal(pouco.nota, null);
  assert.equal(pouco.nota_parcial, 100);
  assert.match(pouco.resumo, /parcial.*faltam 2 indicadores para a nota completa/);
  assert.match(pouco.proximo_passo, /Contas/);
  const cheio = saudeFinanceira({ receitas: 5000, despesas: 4000, saldo: 12000, despesaMedia: 4000, limiteTotal: 10000, comprometido: 3000, limites: [] });
  assert.equal(cheio.completa, true);
  assert.equal(cheio.nota, cheio.nota_parcial);
});

test('saude_financeira (servidor) em conta nova devolve resumo e próximo passo', async () => {
  preparar([]);
  const r = await p.agir('u9', { acao: 'saude_financeira' });
  assert.equal(r[0], 200);
  assert.equal(r[1].completa, false);
  assert.equal(typeof r[1].proximo_passo, 'string');
  assert.equal(typeof r[1].resumo, 'string');
});
