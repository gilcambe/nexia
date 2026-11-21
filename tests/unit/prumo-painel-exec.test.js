const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getFiltrosPadrao,
  filtrarTransacoes,
  calcularTotais,
  calcularEvolucao12Meses,
  calcularRankingCategorias,
  calcularComparativo,
  calcularSemafors,
  gerarInsights,
  verificarDadosInsuficientes,
} = require('../../prumo/painel-exec');

test('1. Cálculo de totais com dados fixos', () => {
  const transacoes = [
    { data: '2026-03-01', tipo: 'entrada', valor: 5000, categoria: 'Salário', cartao: '', conta: 'Nubank' },
    { data: '2026-03-05', tipo: 'saida', valor: 1500, categoria: 'Moradia', cartao: '', conta: 'Nubank' },
    { data: '2026-03-10', tipo: 'saida', valor: 500, categoria: 'Alimentação', cartao: 'Visa', conta: 'Itaú' },
  ];

  const totais = calcularTotais(transacoes);
  assert.equal(totais.entradas, 5000);
  assert.equal(totais.saidas, 2000);
  assert.equal(totais.saldo, 3000);
  assert.equal(totais.pctPoupada, 60);

  // Sem entradas: não pode gerar NaN
  const semEntradas = calcularTotais([
    { data: '2026-03-05', tipo: 'saida', valor: 200, categoria: 'Lazer', cartao: '', conta: '' },
  ]);
  assert.equal(semEntradas.entradas, 0);
  assert.equal(semEntradas.saidas, 200);
  assert.equal(semEntradas.saldo, -200);
  assert.equal(semEntradas.pctPoupada, 0);

  // Array vazio
  const vazios = calcularTotais([]);
  assert.equal(vazios.entradas, 0);
  assert.equal(vazios.saidas, 0);
  assert.equal(vazios.saldo, 0);
  assert.equal(vazios.pctPoupada, 0);
});

test('2. Ranking de categorias e ordenação decrescente', () => {
  const transacoes = [
    { data: '2026-03-01', tipo: 'saida', valor: 300, categoria: 'Alimentação' },
    { data: '2026-03-02', tipo: 'saida', valor: 1200, categoria: 'Moradia' },
    { data: '2026-03-03', tipo: 'saida', valor: 500, categoria: 'Transporte' },
    { data: '2026-03-04', tipo: 'saida', valor: 200, categoria: 'Alimentação' },
    { data: '2026-03-05', tipo: 'entrada', valor: 5000, categoria: 'Salário' },
  ];

  const ranking = calcularRankingCategorias(transacoes, 3);
  assert.equal(ranking.length, 3);
  assert.equal(ranking[0].categoria, 'Moradia');
  assert.equal(ranking[0].total, 1200);
  assert.equal(ranking[0].pctDoTotal, 54.55);

  assert.equal(ranking[1].categoria, 'Alimentação');
  assert.equal(ranking[1].total, 500);

  assert.equal(ranking[2].categoria, 'Transporte');
  assert.equal(ranking[2].total, 500);
});

test('3. Semáforos (casos verde, amarelo e vermelho)', () => {
  // 3.1 Saldo e PctPoupada
  // Verde: saldo > 0 e pctPoupada >= 20
  const semVerde = calcularSemafors({ entradas: 5000, saldo: 1500, pctPoupada: 30 });
  assert.equal(semVerde.saldo, 'verde');
  assert.equal(semVerde.pctPoupada, 'verde');

  // Amarelo: saldo entre -0.05*entradas (-250) e 0, pctPoupada entre 5 e 20
  const semAmarelo = calcularSemafors({ entradas: 5000, saldo: -100, pctPoupada: 10 });
  assert.equal(semAmarelo.saldo, 'amarelo');
  assert.equal(semAmarelo.pctPoupada, 'amarelo');

  // Vermelho: saldo < -0.05*entradas (< -250), pctPoupada < 5
  const semVermelho = calcularSemafors({ entradas: 5000, saldo: -500, pctPoupada: 2 });
  assert.equal(semVermelho.saldo, 'vermelho');
  assert.equal(semVermelho.pctPoupada, 'vermelho');

  // 3.2 Categorias: média 3 meses vs gasto atual
  // verde <= 1.10*media, amarelo 1.10 < x <= 1.30*media, vermelho > 1.30*media
  const categorias = [
    { categoria: 'Alimentação', gastoAtual: 1050, media: 1000 }, // 1.05 -> verde
    { categoria: 'Transporte', gastoAtual: 1200, media: 1000 },  // 1.20 -> amarelo
    { categoria: 'Lazer', gastoAtual: 1400, media: 1000 },       // 1.40 -> vermelho
  ];
  const semCat = calcularSemafors({ entradas: 1000, saldo: 500, pctPoupada: 50 }, categorias);
  assert.equal(semCat.categorias[0].status, 'verde');
  assert.equal(semCat.categorias[1].status, 'amarelo');
  assert.equal(semCat.categorias[2].status, 'vermelho');

  // 3.3 Cartões: limites
  // limite 0 -> sempre verde; gasto > 80% limite -> amarelo; gasto > limite -> vermelho
  const cartoes = [
    { cartao: 'Cartão Sem Limite', gasto: 5000 },
    { cartao: 'Nubank', gasto: 400 },
    { cartao: 'Visa', gasto: 850 },
    { cartao: 'Master', gasto: 1200 },
  ];
  const limites = { Nubank: 1000, Visa: 1000, Master: 1000 };
  const semCartoes = calcularSemafors({}, [], cartoes, limites);
  assert.equal(semCartoes.cartoes[0].status, 'verde');
  assert.equal(semCartoes.cartoes[1].status, 'verde');
  assert.equal(semCartoes.cartoes[2].status, 'amarelo');
  assert.equal(semCartoes.cartoes[3].status, 'vermelho');
});

test('4. Insights geração não vazia e regras acionadas', () => {
  const totais = { entradas: 5000, saidas: 5500, saldo: -500, pctPoupada: 0 };
  const ranking = [{ categoria: 'Moradia', total: 3000, pctDoTotal: 54.55 }];
  const comparativo = {
    atual: { saldo: -500 },
    anterior: { saldo: 200 },
  };
  const semafors = {
    saldo: 'vermelho',
    pctPoupada: 'vermelho',
    categorias: [{ categoria: 'Lazer', status: 'vermelho' }],
    cartoes: [{ cartao: 'Nubank', status: 'vermelho' }],
  };

  const insights = gerarInsights(totais, [], ranking, comparativo, semafors);

  assert.ok(Array.isArray(insights.conclusoes) && insights.conclusoes.length > 0);
  assert.ok(Array.isArray(insights.riscos) && insights.riscos.length > 0);
  assert.ok(Array.isArray(insights.oportunidades) && insights.oportunidades.length > 0);
  assert.ok(Array.isArray(insights.recomendacoes) && insights.recomendacoes.length > 0);

  // Verifica que o risco de saldo negativo foi incluído
  assert.ok(insights.riscos.some((r) => r.includes('saldo negativo')));
  assert.ok(insights.riscos.some((r) => r.includes('Lazer')));
  assert.ok(insights.riscos.some((r) => r.includes('Nubank')));
});

test('5. Filtros padrão, filtro de transações e evolução 12 meses', () => {
  const filtros = getFiltrosPadrao();
  assert.equal(typeof filtros.ano, 'number');
  assert.equal(typeof filtros.mes, 'number');
  assert.equal(filtros.categoria, null);
  assert.equal(filtros.cartao, null);

  const dados = [
    { data: '2025-12-15', tipo: 'entrada', valor: 1000, categoria: 'Salário', cartao: 'Nubank', conta: 'CC' },
    { data: '2026-01-10', tipo: 'saida', valor: 200, categoria: 'Mercado', cartao: 'Nubank', conta: 'CC' },
    { data: '2026-01-20', tipo: 'saida', valor: 300, categoria: 'Lazer', cartao: 'Visa', conta: 'CC' },
  ];

  const f1 = filtrarTransacoes(dados, { ano: 2026, mes: 1, categoria: 'Mercado' });
  assert.equal(f1.length, 1);
  assert.equal(f1[0].categoria, 'Mercado');

  const f2 = filtrarTransacoes(dados, { cartao: 'Visa' });
  assert.equal(f2.length, 1);
  assert.equal(f2[0].cartao, 'Visa');

  const evolucao = calcularEvolucao12Meses(dados, 2026, 3);
  assert.equal(evolucao.length, 12);
  assert.equal(evolucao[11].mesNome, 'Mar/26');
  // Dezembro de 2025 está incluído (mesmo ano anterior)
  const dez25 = evolucao.find((m) => m.mesNome === 'Dez/25');
  assert.ok(dez25);
  assert.equal(dez25.entradas, 1000);

  const comp = calcularComparativo(dados, 2026, 1);
  assert.equal(comp.atual.saidas, 500);
  assert.equal(comp.anterior.entradas, 1000);
});

test('6. Verificação de dados insuficientes', () => {
  assert.equal(verificarDadosInsuficientes([]), true);
  assert.equal(verificarDadosInsuficientes(null), true);

  // Menos de 60 transações
  const poucas = Array.from({ length: 10 }, (_, i) => ({
    data: '2026-03-01',
    tipo: 'saida',
    valor: 10,
  }));
  assert.equal(verificarDadosInsuficientes(poucas), true);

  // 60 transações mas em um único mês
  const umMes = Array.from({ length: 65 }, () => ({
    data: '2026-03-01',
    tipo: 'saida',
    valor: 10,
  }));
  assert.equal(verificarDadosInsuficientes(umMes), true);

  // 60+ transações com pelo menos 2 meses distintos
  const suficientes = [
    ...Array.from({ length: 35 }, () => ({ data: '2026-02-10', tipo: 'saida', valor: 10 })),
    ...Array.from({ length: 35 }, () => ({ data: '2026-03-10', tipo: 'saida', valor: 10 })),
  ];
  assert.equal(verificarDadosInsuficientes(suficientes), false);
});
