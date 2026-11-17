'use strict';
// Fluxo de caixa (90 dias), assinaturas, cartão do Início e Carreira e renda: funções puras e servidor (p.agir) com banco falso.
// Hoje nos testes = 2026-11-20 (sexta). Os números abaixo foram conferidos à mão (veja os comentários).
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../netlify/functions/prumo.js');
const fluxo = require('../../netlify/functions/prumo-lib/fluxo.js');
const folha = require('../../netlify/functions/prumo-lib/folha.js');

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
const U = 'prumo_users/u1';
function preparar() {
  const banco = bancoFalso();
  p.deps.db = () => banco;
  p.deps.agora = () => new Date('2026-11-20T12:00:00Z');
  delete p.deps.perguntarTexto;
  return banco;
}
const poe = (banco, colecao, id, v) => banco.dados.set(`${U}/${colecao}/${id}`, v);
const agir = async (acao, corpo = {}) => p.agir('u1', { acao, ...corpo });

// Cenário sem salário base (só entradas lançadas), para os números serem exatos.
function cenario(banco) {
  poe(banco, 'contas', 'c1', { nome: 'Conta', saldo: 1000 });
  poe(banco, 'orcamento', 'atual', { fixas: [{ nome: 'Aluguel', valor: 1500, dia: 5 }, { nome: 'Internet', valor: 100, dia: null }], guardar: [], limites: {}, renda_extra: 0 });
  poe(banco, 'cartoes', 'k1', { nome: 'Nubank', limite: 5000, dia_fechamento: 18, dia_vencimento: 25 });
  poe(banco, 'gastos', 'g1', { cartao_id: 'k1', descricao: 'Compra', valor: 400, data: '2026-11-10', categoria: 'outros', parcelas: 1 });
  poe(banco, 'gastos', 'g2', { cartao_id: 'k1', descricao: 'TV', valor: 600, data: '2026-11-15', categoria: 'outros', parcelas: 2 });
  poe(banco, 'dividas', 'd1', { credor: 'Banco X', tipo: 'emprestimo', saldo: 3000, juros_mes: 3, parcela: 200, dia_vencimento: 28 });
  poe(banco, 'pagamentos', '2026-12_ferias_2026-12-02', { tipo: 'ferias', mes: '2026-12', data_pagamento: '2026-12-02', liquido: 3000, bruto: 3000 });
}

test('fluxo_visao: semanas, entradas e saídas conferidas à mão e aviso "vai faltar dinheiro"', async () => {
  const banco = preparar(); cenario(banco);
  const r = await agir('fluxo_visao');
  assert.equal(r[0], 200);
  const f = r[1];
  assert.equal(f.semanas.length, 13);
  assert.equal(f.saldo_inicial, 1000);
  assert.equal(f.sem_salario_base, true);
  const s = f.semanas;
  assert.deepEqual([s[0].inicio, s[0].fim], ['2026-11-20', '2026-11-26']);
  // S1: fatura do cartão dia 25 = 400 + parcela 300 da TV = 700 -> saldo 300
  assert.equal(s[0].sai, 700); assert.equal(s[0].saldo_fim, 300);
  // S2 (27/11 a 03/12): dívida dia 28 (-200) e férias dia 02/12 (+3000) -> 3100; o ponto mais baixo foi 100
  assert.equal(s[1].entra, 3000); assert.equal(s[1].sai, 200); assert.equal(s[1].saldo_fim, 3100); assert.equal(s[1].saldo_minimo, 100);
  // S3 (04/12 a 10/12): aluguel dia 5 (-1500) e internet sem dia = dia 10 (-100) -> 1500
  assert.equal(s[2].sai, 1600); assert.equal(s[2].saldo_fim, 1500);
  // S6 (25/12 a 31/12): fatura de dezembro (parcela 300) + dívida dia 28 (200) -> 1000
  assert.equal(s[5].sai, 500); assert.equal(s[5].saldo_fim, 1000);
  // S7 (01/01 a 07/01): aluguel dia 5 (-1500) -> -500: primeira semana sem dinheiro
  assert.equal(s[6].saldo_fim, -500);
  assert.equal(f.aviso.semana, 7); assert.equal(f.aviso.falta, 500);
  assert.match(f.aviso.texto, /Vai faltar dinheiro na semana 7/);
  assert.match(f.aviso.texto, /01\/01 a 07\/01/);
  // alerta de férias com destino: dívida cara (3% ao mês) vem primeiro
  assert.equal(f.alertas.length, 1);
  assert.equal(f.alertas[0].categoria, 'ferias'); assert.equal(f.alertas[0].em_dias, 12);
  assert.equal(f.alertas[0].destino.tipo, 'divida');
  assert.match(f.alertas[0].destino.texto, /Banco X/);
});

test('fluxo_visao: sem contas cadastradas avisa e não inventa saldo', async () => {
  preparar();
  const f = (await agir('fluxo_visao'))[1];
  assert.equal(f.saldo_conhecido, false); assert.equal(f.saldo_inicial, null);
  assert.match(f.nota, /Cadastre/);
  assert.equal(f.aviso, null);
});

test('13º: 1ª parcela = metade do base; 2ª = líquido do 13º (base - INSS - IR) - 1ª', () => {
  const d = fluxo.decimoTerceiro(5000, 0);
  // INSS(5000) à mão: 121,575 + 115,3656 + 174,1716 + 90,4022 = 501,51; IRRF = 0 (redutor zera). Líquido = 4498,49.
  assert.equal(folha.inss(5000), 501.51);
  assert.equal(d.primeira, 2500); assert.equal(d.liquido, 4498.49); assert.equal(d.segunda, 1998.49);
});

test('com salário base, o fluxo projeta o 13º (30/11 e 20/12) e o alerta sugere destino', async () => {
  const banco = preparar(); cenario(banco);
  poe(banco, 'config', 'salario', { salario_base: 5000, dependentes: 0, jornada_mensal: 220 });
  const f = (await agir('fluxo_visao'))[1];
  const lista = f.semanas.flatMap((x) => x.itens);
  const p1 = lista.find((e) => e.nome === '13º (1ª parcela)'); const p2 = lista.find((e) => e.nome === '13º (2ª parcela)');
  assert.deepEqual([p1.data, p1.valor, p1.estimado], ['2026-11-30', 2500, true]);
  assert.deepEqual([p2.data, p2.valor], ['2026-12-20', 1998.49]);
  const a = f.alertas.filter((x) => x.categoria === '13o');
  assert.equal(a[0].em_dias, 10);
  assert.ok(lista.some((e) => e.nome === 'Salário do mês'), 'projeta o salário do mês');
});

test('13º já lançado não é projetado de novo', async () => {
  const banco = preparar(); cenario(banco);
  poe(banco, 'config', 'salario', { salario_base: 5000 });
  poe(banco, 'pagamentos', '2026-11_dec1', { tipo: 'decimo_terceiro_1', mes: '2026-11', data_pagamento: '2026-11-19', liquido: 2500, bruto: 2500 });
  const lista = (await agir('fluxo_visao'))[1].semanas.flatMap((x) => x.itens);
  assert.equal(lista.filter((e) => e.nome === '13º (1ª parcela)').length, 0, 'já pago em 19/11 (antes de hoje)');
  assert.equal(lista.find((e) => e.nome === '13º (2ª parcela)').valor, 1998.49, '2ª = líquido - o que já veio na 1ª (2500)');
});

test('assinaturas: mesmo nome em 2+ meses com valor parecido; sem duplicar nem contar parcelado ou PJ', async () => {
  const banco = preparar();
  for (const m of ['09', '10', '11']) poe(banco, 'lancamentos', 'n' + m, { tipo: 'despesa', estabelecimento: 'Netflix', valor: 39.9, data: `2026-${m}-12` });
  poe(banco, 'lancamentos', 'm1', { tipo: 'despesa', estabelecimento: 'Mercado X', valor: 100, data: '2026-10-03' });
  poe(banco, 'lancamentos', 'm2', { tipo: 'despesa', estabelecimento: 'Mercado X', valor: 300, data: '2026-11-03' });
  poe(banco, 'lancamentos', 'pj', { tipo: 'despesa', estabelecimento: 'Software PJ', valor: 80, data: '2026-10-03', perfil: 'pj' });
  poe(banco, 'lancamentos', 'pj2', { tipo: 'despesa', estabelecimento: 'Software PJ', valor: 80, data: '2026-11-03', perfil: 'pj' });
  poe(banco, 'cartoes', 'k1', { nome: 'K', dia_vencimento: 10, dia_fechamento: 1 });
  poe(banco, 'gastos', 's1', { cartao_id: 'k1', descricao: 'Spotify', valor: 21.9, data: '2026-10-05', parcelas: 1, categoria: 'lazer' });
  poe(banco, 'gastos', 's2', { cartao_id: 'k1', descricao: 'Spotify', valor: 21.9, data: '2026-11-05', parcelas: 1, categoria: 'lazer' });
  poe(banco, 'gastos', 'n3', { cartao_id: 'k1', descricao: 'Netflix', valor: 39.9, data: '2026-11-12', parcelas: 1, categoria: 'lazer' });
  poe(banco, 'gastos', 'tv1', { cartao_id: 'k1', descricao: 'TV', valor: 600, data: '2026-10-05', parcelas: 6, categoria: 'outros' });
  poe(banco, 'gastos', 'tv2', { cartao_id: 'k1', descricao: 'TV', valor: 600, data: '2026-11-05', parcelas: 6, categoria: 'outros' });
  const a = (await agir('fluxo_visao'))[1].assinaturas;
  assert.deepEqual(a.itens.map((x) => x.nome).sort(), ['Netflix', 'Spotify']);
  const nf = a.itens.find((x) => x.nome === 'Netflix');
  assert.equal(nf.valor_mensal, 39.9); assert.equal(nf.meses, 3); assert.equal(nf.por_ano, 478.8); // 39,90 x 12
  assert.equal(a.itens.find((x) => x.nome === 'Spotify').por_ano, 262.8); // 21,90 x 12
  assert.equal(a.total_mes, 61.8); assert.equal(a.total_ano, 741.6);
  assert.match(nf.pergunta, /Cancelar/);
});

test('inicio_resumo: "quanto ainda cai" = previsão do salário - contas a vencer até o fim do mês', async () => {
  const banco = preparar(); cenario(banco);
  poe(banco, 'config', 'salario', { salario_base: 5000, dependentes: 0, jornada_mensal: 220 });
  const prev = (await agir('salario_previsao', { mes: '2026-11' }))[1].previsao;
  const fi = (await agir('inicio_resumo'))[1].fluxo_inicio;
  assert.equal(fi.previsao_salario, prev.a_receber);
  // contas de 20/11 a 30/11: fatura 700 (dia 25) + dívida 200 (dia 28); aluguel/internet já venceram (dias 5 e 10)
  assert.equal(fi.contas_a_vencer, 900);
  assert.equal(fi.cai_este_mes, Math.round((prev.a_receber - 900) * 100) / 100);
  assert.ok(fi.alertas.some((x) => x.nome === '13º (1ª parcela)' && x.em_dias === 10));
});

test('inicio_resumo sem salário base: não inventa valor e diz o que falta', async () => {
  preparar();
  const fi = (await agir('inicio_resumo'))[1].fluxo_inicio;
  assert.equal(fi.cai_este_mes, null);
  assert.match(fi.motivo, /salário base/);
});

test('destino do 13º/férias: dívida cara, depois reserva, depois objetivo', () => {
  const base = { dividas: [], contas: [{ saldo: 100 }], orc: { fixas: [{ valor: 1000 }] }, objetivos: [{ nome: 'Viagem' }] };
  assert.equal(fluxo.destino({ ...base, dividas: [{ credor: 'Loja', juros_mes: 1.5 }, { credor: 'Banco', juros_mes: 8 }] }, 1000).texto.includes('Banco'), true);
  assert.equal(fluxo.destino({ ...base, dividas: [{ credor: 'Financ.', juros_mes: 0.9 }] }, 1000).tipo, 'reserva');
  assert.equal(fluxo.destino({ ...base, contas: [{ saldo: 7000 }] }, 1000).tipo, 'objetivo');
});

// ---------- Carreira ----------
test('carreira_perfil_salvar: valida, junta com o que já tem e guarda', async () => {
  const banco = preparar();
  assert.equal((await agir('carreira_perfil_salvar', { cargo: '' }))[0], 400);
  assert.equal((await agir('carreira_perfil_salvar', { cargo: 'Analista', anos_experiencia: -2 }))[0], 400);
  assert.equal((await agir('carreira_perfil_salvar', { cargo: 'Analista', taxa_ano: 90 }))[0], 400);
  assert.equal((await agir('carreira_perfil_salvar', { cargo: 'Analista', area: 'Logística', cidade: 'Campinas', anos_experiencia: '5' }))[0], 200);
  assert.equal((await agir('carreira_perfil_salvar', { taxa_ano: '12' }))[0], 200, 'só a taxa: mantém o resto');
  const perfil = banco.dados.get(`${U}/config/carreira`).perfil;
  assert.deepEqual(perfil, { cargo: 'Analista', area: 'Logística', cidade: 'Campinas', anos_experiencia: 5, taxa_ano: 12 });
});

test('valorFuturo: juros compostos conferidos por simulação mês a mês', () => {
  const taxa = 10; const i = Math.pow(1.1, 1 / 12) - 1;
  let saldo = 0; for (let m = 0; m < 120; m++) saldo = saldo * (1 + i) + 1500;
  assert.ok(Math.abs(fluxo.valorFuturo(1500, taxa, 120) - saldo) < 0.5);
  assert.equal(fluxo.valorFuturo(0, 10, 12), 0);
  assert.equal(fluxo.valorFuturo(100, 0, 12), 1200, 'sem juros só soma');
});

test('carreira_visao: perfil, sobra, alavancar e meta de independência (alvo = gasto x 12 / 4%)', async () => {
  const banco = preparar(); cenario(banco);
  poe(banco, 'pagamentos', '2026-10_mensal', { tipo: 'mensal', mes: '2026-10', data_pagamento: '2026-10-30', liquido: 4000, bruto: 4800 });
  await agir('carreira_perfil_salvar', { cargo: 'Analista', area: 'TI', cidade: 'SP', anos_experiencia: 3 });
  const v = (await agir('carreira_visao'))[1];
  assert.equal(v.perfil.cargo, 'Analista'); assert.equal(v.perfil.taxa_ano, 10); assert.equal(v.perfil.taxa_padrao, true);
  // sobra = renda 4000 - fixas 1600 - cartão do mês 700 - parcela da dívida 200 = 1500
  assert.equal(v.mes.sobra, 1500); assert.equal(v.mes.gasto_mensal, 2500);
  const um = v.alavancar.cenarios.find((x) => x.anos === 1);
  assert.equal(um.guardado, 18000);
  assert.ok(um.rendimento_total > 18000 && um.rendimento_total < 19500);
  // independência: 2500 x 12 / 0,04 = 750.000; sem investimentos ainda falta tudo
  assert.equal(v.patrimonio.investimentos, 0);
  assert.equal(v.patrimonio.independencia.alvo, 750000); assert.equal(v.patrimonio.independencia.falta, 750000);
  assert.ok(v.patrimonio.independencia.anos > 0);
  assert.match(v.aviso, /estimativa/);
});

test('carreira_visao: sem sobra não promete rendimento', async () => {
  const banco = preparar(); cenario(banco);
  const v = (await agir('carreira_visao'))[1];
  assert.deepEqual(v.alavancar.cenarios, []);
  assert.match(v.alavancar.texto, /não sobra/);
});

test('carreira_plano: IA grátis (falsa), guarda o plano com aviso; erros viram mensagem simples', async () => {
  const banco = preparar();
  assert.equal((await agir('carreira_plano'))[0], 400, 'sem perfil');
  await agir('carreira_perfil_salvar', { cargo: 'Analista', area: 'TI' });
  poe(banco, 'config', 'salario', { salario_base: 5000 });
  const pedidos = [];
  p.deps.perguntarTexto = async (sistema, pergunta) => { pedidos.push({ sistema, pergunta }); return JSON.stringify({ proximo_cargo: 'Analista Sênior', certificacoes: ['ITIL', 'SQL', 'x', 'y', 'z'], aumento: { pedir_pct: 80, argumento: 'Entreguei X' }, renda_extra: ['Freelance'] }); };
  const r = await agir('carreira_plano');
  assert.equal(r[0], 200);
  assert.equal(r[1].plano.proximo_cargo, 'Analista Sênior');
  assert.equal(r[1].plano.certificacoes.length, 4, 'no máximo 4 itens');
  assert.equal(r[1].plano.aumento.pedir_pct, 40, 'aumento limitado a 40%');
  assert.match(r[1].plano.aviso, /estimativa e uma sugestão/);
  assert.match(pedidos[0].pergunta, /Analista/); assert.match(pedidos[0].pergunta, /5000/);
  assert.equal(banco.dados.get(`${U}/config/carreira`).perfil.cargo, 'Analista', 'o plano não apaga o perfil');
  assert.equal((await agir('carreira_visao'))[1].plano.proximo_cargo, 'Analista Sênior');
  p.deps.perguntarTexto = async () => 'não sei';
  assert.equal((await agir('carreira_plano'))[0], 503);
  p.deps.perguntarTexto = async () => { throw new Error('fora do ar'); };
  assert.equal((await agir('carreira_plano'))[0], 503);
});
