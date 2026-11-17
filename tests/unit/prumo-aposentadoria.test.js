'use strict';
// Aposentadoria e FGTS: funções puras (valores conferidos à mão) e servidor (p.agir com banco falso).
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../../netlify/functions/prumo-lib/aposentadoria.js');
const p = require('../../netlify/functions/prumo.js');

const perto = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} deveria ser ~${b}`);

test('coeficiente: 60% + 2% por ano completo acima de 20 (homem) / 15 (mulher)', () => {
  assert.equal(A.coeficiente('M', 35 * 12), 90); // 60 + 2*15
  assert.equal(A.coeficiente('F', 30 * 12), 90); // 60 + 2*15
  assert.equal(A.coeficiente('M', 20 * 12), 60);
  assert.equal(A.coeficiente('M', 15 * 12), 60); // nunca abaixo de 60
  assert.equal(A.coeficiente('F', 25 * 12 + 11), 80); // 25 anos completos: 60 + 2*10
  assert.equal(A.coeficiente('M', 60 * 12), 100); // limite de 100%
});

test('teto e piso de 2026', () => {
  assert.deepEqual(A.limitar(12000), { beneficio: 8475.55, limitado: 'teto' });
  assert.deepEqual(A.limitar(1000), { beneficio: 1621, limitado: 'piso' });
  assert.deepEqual(A.limitar(3840), { beneficio: 3840, limitado: null });
});

test('fator previdenciário (tábua aproximada) para homem de 62 anos e 36 de contribuição', () => {
  // Es = 22,7 - 0,8*2 = 21,1; Tc*a = 11,16; f = (11,16/21,1) * (1 + (62+11,16)/100)
  perto(A.fatorPrevidenciario({ sexo: 'M', idadeAnos: 62, tcAnos: 36 }), (11.16 / 21.1) * (1 + 73.16 / 100), 1e-9);
});

const MULHER = { nascimento: '1966-01-01', sexo: 'F', tc_2019_meses: 312, tc_total_meses: 396, media_salarial: 4000, hoje: '2026-11-17', tc_data_base: '2026-11-17' };
const regra = (r, id) => r.regras.find((x) => x.id === id);

test('INSS mulher: pontos e idade progressiva já cumpridas, idade em 2028, pedágio 100% em 12/2027', () => {
  const r = A.calcularInss(MULHER);
  // pontos 2026 (mulher) = 93: 60,9 + 33 = 93,9. Coeficiente 60 + 2*(33-15) = 96% de 4.000 = 3.840.
  const pts = regra(r, 'pontos');
  assert.equal(pts.ja_cumpre, true); assert.equal(pts.cumpre_em, '2026-11-17');
  assert.equal(pts.coeficiente_pct, 96); assert.equal(pts.beneficio, 3840);
  const ip = regra(r, 'idade_progressiva');
  assert.equal(ip.ja_cumpre, true); // 2026: 59 anos e 6 meses; ela tem 60,9
  // idade: 62 anos em 01/01/2028; 410 meses de contribuição = 34 anos => 60 + 2*19 = 98% => 3.920
  const id = regra(r, 'idade');
  assert.equal(id.cumpre_em, '2028-01-01'); assert.equal(id.coeficiente_pct, 98); assert.equal(id.beneficio, 3920);
  // pedágio 100%: faltavam 48 meses em 2019 => precisa de 408 meses; tem 396 => 12 meses depois (dia 1 do mês)
  const pd = regra(r, 'pedagio_100');
  assert.equal(pd.cumpre_em, '2027-12-01'); assert.equal(pd.beneficio, 4000);
  assert.equal(regra(r, 'pedagio_50'), undefined, 'faltavam mais de 2 anos em 2019: sem pedágio de 50%');
  assert.equal(r.melhor, 'pedagio_100');
  assert.equal(r.mais_cedo, 'pontos');
  assert.ok(r.suposicoes.some((s) => /SUPOSIÇÃO/.test(s)));
});

test('INSS homem com pedágio de 50%: precisa do que faltava + 50% e aplica fator previdenciário', () => {
  const r = A.calcularInss({ nascimento: '1968-05-10', sexo: 'M', tc_2019_meses: 396, tc_total_meses: 400, media_salarial: 6000, hoje: '2026-11-17', tc_data_base: '2026-11-17' });
  const p50 = regra(r, 'pedagio_50');
  assert.ok(p50, 'faltavam exatamente 24 meses: entra');
  // faltavam 24 meses: precisa de 420 + 12 = 432 meses. Tem 400 => +32 meses => 10/08/2029.
  assert.equal(p50.cumpre_em, '2029-08-10');
  const f = (11.16 / (22.7 - 0.8 * 1.25)) * (1 + (61.25 + 11.16) / 100);
  perto(p50.fator_previdenciario, f, 0.001);
  perto(p50.beneficio, 6000 * f, 0.01);
});

test('quem entrou depois da reforma só tem a regra por idade; homem precisa de 20 anos; piso e teto', () => {
  const r = A.calcularInss({ nascimento: '1960-01-01', sexo: 'M', tc_2019_meses: 0, tc_total_meses: 216, media_salarial: 3000, hoje: '2026-11-17', tc_data_base: '2026-11-17' });
  assert.deepEqual(r.regras.map((x) => x.id), ['idade']);
  assert.equal(r.regras[0].cumpre_em, '2028-12-01'); // 216 + 24 = 240 meses
  assert.equal(r.regras[0].beneficio, 1800); // 60% de 3.000
  assert.match(r.avisos.join(' '), /13\/11\/2019/);
  const baixo = A.calcularInss({ nascimento: '1960-01-01', sexo: 'M', tc_2019_meses: 0, tc_total_meses: 300, media_salarial: 1000, hoje: '2026-11-17' });
  assert.equal(baixo.regras[0].beneficio, 1621); assert.equal(baixo.regras[0].limitado, 'piso');
  const alto = A.calcularInss({ nascimento: '1960-01-01', sexo: 'M', tc_2019_meses: 0, tc_total_meses: 600, media_salarial: 20000, hoje: '2026-11-17' });
  assert.equal(alto.regras[0].beneficio, 8475.55); assert.equal(alto.regras[0].limitado, 'teto');
});

test('sem média salarial: datas sim, valor não, com aviso', () => {
  const r = A.calcularInss({ ...MULHER, media_salarial: undefined });
  assert.equal(r.melhor, null);
  assert.equal(regra(r, 'pontos').beneficio, null);
  assert.match(r.avisos[0], /média salarial/);
});

test('CNIS: períodos que se sobrepõem contam uma vez; vínculo aberto vai até hoje', () => {
  const t = A.tempoDosVinculos([
    { empresa: 'A', inicio: '2010-01-01', fim: '2012-12-31' },
    { empresa: 'B', inicio: '2012-06-01', fim: '2014-05-31' },
    { empresa: 'C', inicio: '2019-01-10', fim: '', pendencias: ['PEXT'] },
  ], '2026-11-17');
  // A+B = 2010-01..2014-05 = 53 meses; C = 2019-01..2026-11 = 95 meses; até 11/2019: 11 meses de C
  assert.equal(t.tc_total_meses, 148); assert.equal(t.tc_2019_meses, 64);
  assert.ok(t.alertas.some((a) => /sem data de saída/.test(a)));
  assert.ok(t.alertas.some((a) => /se sobrepõem/.test(a)));
  assert.ok(t.alertas.some((a) => /PEXT/.test(a)));
});

test('média das contribuições: ignora antes de 07/1994 e limita ao teto', () => {
  const r = A.mediaDasContribuicoes([{ competencia: '1994-06', valor: 9999 }, { competencia: '2020-01', valor: 2000 }, { competencia: '2020-02', valor: 4000 }, { competencia: '2020-03', valor: 20000 }]);
  perto(r.media, (2000 + 4000 + 8475.55) / 3, 0.01);
  assert.ok(r.alertas.some((a) => /SUPOSIÇÃO/.test(a)));
});

test('FGTS: tabela oficial do saque-aniversário', () => {
  assert.equal(A.saqueAniversario(400).valor, 200);
  assert.equal(A.saqueAniversario(1000).valor, 450); // 40% + 50
  assert.equal(A.saqueAniversario(3000).valor, 1050); // 30% + 150
  assert.equal(A.saqueAniversario(15000).valor, 3400); // 15% + 1150
  assert.equal(A.saqueAniversario(30000).valor, 4400); // 5% + 2900
  assert.equal(A.saqueAniversario(0).valor, 0);
});

test('FGTS: projeção com 3% ao ano + TR', () => {
  assert.equal(A.projetarFgts({ saldo: 10000, deposito: 0, anos: 1, tr_pct: 0 }), 10300);
  assert.equal(A.projetarFgts({ saldo: 10000, deposito: 0, anos: 5, tr_pct: 0 }), 11592.74); // 10000 * 1,03^5
  assert.equal(A.projetarFgts({ saldo: 10000, deposito: 0, anos: 1, tr_pct: 2 }), 10506); // 1,03 * 1,02
  perto(A.projetarFgts({ saldo: 0, deposito: 100, anos: 5, tr_pct: 0 }), 6458, 2);
});

test('FGTS: aniversário × rescisão (demitido hoje)', () => {
  const c = A.compararSaques({ saldo: 10000, deposito: 0, anos: 1 });
  assert.equal(c.aniversario.saque_este_ano, 2650); // 20% + 650
  assert.equal(c.aniversario.se_demitido_hoje.saca_agora, 4000); // só a multa de 40%
  assert.equal(c.aniversario.se_demitido_hoje.saldo_bloqueado, 7350);
  assert.equal(c.rescisao.se_demitido_hoje.saca_agora, 14000); // saldo + multa
  assert.match(c.suposicao, /SUPOSIÇÃO/);
});

test('FGTS no imóvel: abate do saldo devedor, prazo e parcela (juros zero para conferir à mão)', () => {
  const r = A.usarFgtsNoImovel({ saldo_fgts: 20000, saldo_devedor: 100000, taxa_ano: 0, prazo_meses: 100 });
  assert.equal(r.abate, 20000); assert.equal(r.parcela_hoje, 1000); assert.equal(r.novo_saldo_devedor, 80000);
  assert.equal(r.reduzindo_prazo.novo_prazo_meses, 80); assert.equal(r.reduzindo_prazo.meses_a_menos, 20);
  assert.equal(r.reduzindo_parcela.nova_parcela, 800); assert.equal(r.reduzindo_parcela.economia_mensal, 200);
  assert.equal(A.usarFgtsNoImovel({ saldo_fgts: 1, saldo_devedor: 0, taxa_ano: 0, prazo_meses: 10 }), null);
  const com = A.usarFgtsNoImovel({ saldo_fgts: 20000, saldo_devedor: 100000, taxa_ano: 10, prazo_meses: 120 });
  assert.ok(com.reduzindo_prazo.economia_juros > 0 && com.reduzindo_parcela.economia_juros > 0);
});

test('PGBL × VGBL: limite de 12% e economia de imposto', () => {
  const r = A.pgblOuVgbl({ renda_bruta_anual: 120000, aporte_anual: 20000, declaracao_completa: true });
  assert.equal(r.limite_dedutivel_anual, 14400); assert.equal(r.deducao_anual, 14400);
  // 10.000/mês: 10.000*27,5% - 908,73 = 1.841,27 ; 8.800/mês: 1.511,27 ; diferença 330 por mês = 3.960 por ano
  assert.equal(r.economia_ir_anual, 3960); assert.equal(r.recomendacao, 'PGBL');
  const simples = A.pgblOuVgbl({ renda_bruta_anual: 120000, aporte_anual: 20000, declaracao_completa: false });
  assert.equal(simples.recomendacao, 'VGBL'); assert.equal(simples.economia_ir_anual, 0);
  const isento = A.pgblOuVgbl({ renda_bruta_anual: 48000, aporte_anual: 5000, declaracao_completa: true });
  assert.equal(isento.recomendacao, 'VGBL'); // 4.000/mês: isento
  const pequeno = A.pgblOuVgbl({ renda_bruta_anual: 120000, aporte_anual: 6000, declaracao_completa: true });
  assert.equal(pequeno.deducao_anual, 6000);
});

test('tabela regressiva e quanto aportar', () => {
  assert.equal(A.aliquotaRegressiva(1.5), 35); assert.equal(A.aliquotaRegressiva(3), 30); assert.equal(A.aliquotaRegressiva(5), 25);
  assert.equal(A.aliquotaRegressiva(7), 20); assert.equal(A.aliquotaRegressiva(10), 15); assert.equal(A.aliquotaRegressiva(10.5), 10);
  assert.equal(A.capitalParaRenda({ renda: 1000, anos_receber: 10, taxa_real_ano: 0 }), 120000);
  assert.equal(A.aporteNecessario({ capital: 120000, inicial: 0, taxa_real_ano: 0, anos: 10 }), 1000);
  assert.equal(A.aporteNecessario({ capital: 100, inicial: 200, taxa_real_ano: 0, anos: 10 }), 0, 'já tem o capital');
  assert.equal(A.irMensal(4000), 0); assert.equal(A.irMensal(10000), 1841.27);
});

test('prev_simular (puro): acumulado, regressiva a 10% e aporte necessário', () => {
  const r = A.simularPrevidencia({ renda_bruta_anual: 120000, aporte_mensal: 1000, saldo_atual: 0, anos: 20, taxa_real_ano: 0, anos_receber: 20, outras_rendas_mensais: 0, renda_alvo: 2000, declaracao_completa: true });
  assert.equal(r.acumulado.bruto, 240000);
  assert.equal(r.tabelas.regressiva.aliquota_pct, 10); assert.equal(r.tabelas.regressiva.imposto_pgbl, 24000); assert.equal(r.tabelas.regressiva.imposto_vgbl, 0);
  assert.equal(r.tabelas.progressiva.retirada_mensal, 1000); assert.equal(r.tabelas.progressiva.imposto_total_pgbl, 0, 'R$ 1.000/mês é isento');
  assert.equal(r.tabelas.menor_imposto_pgbl, 'progressiva');
  assert.equal(r.quanto_aportar.capital_necessario, 480000); assert.equal(r.quanto_aportar.aporte_mensal, 2000);
});

// ---------- Servidor ----------
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
function preparar(respostas = []) {
  const banco = bancoFalso(); const pedidos = [];
  p.deps.db = () => banco;
  p.deps.agora = () => new Date('2026-11-17T12:00:00Z');
  p.deps.perguntarVisao = async (img, sistema) => { pedidos.push({ img, sistema }); const r = respostas.shift(); return typeof r === 'string' ? r : JSON.stringify(r); };
  return { banco, pedidos };
}
const agir = (b) => p.agir('u1', b);

test('apos_perfil_salvar: valida e guarda', async () => {
  preparar();
  assert.equal((await agir({ acao: 'apos_perfil_salvar', sexo: 'F' }))[0], 400, 'sem nascimento');
  assert.equal((await agir({ acao: 'apos_perfil_salvar', nascimento: '1966-01-01', sexo: 'X' }))[0], 400, 'sexo inválido');
  const ruim = await agir({ acao: 'apos_perfil_salvar', nascimento: '1966-01-01', sexo: 'F', tc_2019_meses: 400, tc_total_meses: 300 });
  assert.equal(ruim[0], 400); assert.match(ruim[1].error, /13\/11\/2019/);
  const r = await agir({ acao: 'apos_perfil_salvar', nascimento: '1966-01-01', sexo: 'f', tc_2019_meses: 312, tc_total_meses: 396, media_salarial: '4.000,00' });
  assert.equal(r[0], 200); assert.equal(r[1].perfil.sexo, 'F'); assert.equal(r[1].perfil.media_salarial, 4000); assert.equal(r[1].perfil.tc_data_base, '2026-11-17');
});

test('apos_visao: INSS + FGTS com 8% do salário do módulo Salário + quanto guardar reusando meta_independencia', async () => {
  preparar();
  assert.equal((await agir({ acao: 'salario_config', salario_base: 5000 }))[0], 200);
  await agir({ acao: 'apos_perfil_salvar', nascimento: '1966-01-01', sexo: 'F', tc_2019_meses: 312, tc_total_meses: 396, media_salarial: 4000 });
  await agir({ acao: 'fgts_salvar', saldo: 20000 });
  const r = await agir({ acao: 'apos_visao', renda_desejada: 8000, investimentos: 100000, taxa_ano: 8, inflacao_ano: 0 });
  assert.equal(r[0], 200);
  const v = r[1];
  assert.equal(v.inss.melhor, 'pedagio_100');
  assert.equal(v.fgts.deposito_mensal, 400); assert.equal(v.fgts.deposito_de, 'salario');
  assert.deepEqual(v.fgts.projecao.map((x) => x.anos), [1, 5, 10, 20]);
  perto(v.fgts.projecao[0].saldo, 20000 * 1.03 + 400 * (0.03 / (Math.pow(1.03, 1 / 12) - 1)), 1);
  const q = v.quanto_guardar;
  assert.equal(q.inss_estimado, 4000); assert.equal(q.gap_mensal, 4000);
  assert.equal(q.independencia.alvo, 1200000, '4.000 * 12 / 4%');
  assert.ok(q.aporte_mensal_necessario >= 0);
  assert.ok(q.avisos.some((a) => /FGTS é um saque único/.test(a)));
});

test('apos_visao sem dados: pede o que falta; renda coberta pelo INSS não exige guardar', async () => {
  preparar();
  const vazio = (await agir({ acao: 'apos_visao' }))[1];
  assert.equal(vazio.inss, null); assert.equal(vazio.fgts, null); assert.equal(vazio.faltando.length, 2);
  await agir({ acao: 'apos_perfil_salvar', nascimento: '1966-01-01', sexo: 'F', tc_2019_meses: 312, tc_total_meses: 396, media_salarial: 4000 });
  const r = (await agir({ acao: 'apos_visao', renda_desejada: 3000 }))[1];
  assert.equal(r.quanto_guardar.gap_mensal, 0); assert.match(r.quanto_guardar.mensagem, /já cobre/);
});

test('apos_visao: FGTS no imóvel', async () => {
  preparar();
  await agir({ acao: 'fgts_salvar', saldo: 20000 });
  const r = (await agir({ acao: 'apos_visao', imovel: { saldo_devedor: 100000, prazo_meses: 100, taxa_ano: 0 } }))[1];
  assert.equal(r.fgts.imovel.abate, 20000); assert.equal(r.fgts.imovel.reduzindo_prazo.meses_a_menos, 20);
});

test('fgts_salvar: valida e lê o saldo por print (sem salvar até a pessoa conferir)', async () => {
  const { pedidos, banco } = preparar([{ saldo: 'R$ 12.345,67', modalidade: 'aniversario' }]);
  assert.equal((await agir({ acao: 'fgts_salvar', saldo: -5 }))[0], 400);
  assert.equal((await agir({ acao: 'fgts_salvar', saldo: 100, tr_pct: 99 }))[0], 400);
  assert.equal((await agir({ acao: 'fgts_salvar', saldo: 100, modalidade: 'x' }))[0], 400);
  const lido = await agir({ acao: 'fgts_salvar', imagens: [IMG(1)] });
  assert.equal(lido[0], 200); assert.equal(lido[1].salvo, false);
  assert.deepEqual(lido[1].lidos[0], { ok: true, saldo: 12345.67, modalidade: 'aniversario' });
  assert.equal(pedidos.length, 1);
  assert.equal([...banco.dados.keys()].some((k) => k.endsWith('/fgts')), false, 'nada gravado antes de conferir');
  const salvo = await agir({ acao: 'fgts_salvar', saldo: 12345.67, deposito_mensal: 300, tr_pct: 0.5, modalidade: 'aniversario' });
  assert.equal(salvo[1].salvo, true); assert.equal(salvo[1].fgts.deposito_mensal, 300); assert.equal(salvo[1].fgts.tr_pct, 0.5);
});

test('apos_cnis_ler: lê cada imagem, junta as páginas, calcula tempo e média, e NÃO salva', async () => {
  const pagina1 = { vinculos: [{ empresa: 'A', inicio: '2010-01-01', fim: '2012-12-31', pendencias: [] }, { empresa: 'B', inicio: '2012-06-01', fim: '2014-05-31' }], contribuicoes: [{ competencia: '2020-01', valor: 2000 }] };
  const pagina2 = { vinculos: [{ empresa: 'B', inicio: '2012-06-01', fim: '2014-05-31' }, { empresa: 'C', inicio: '2019-01-10', fim: '' }], contribuicoes: [{ competencia: '2020-02', valor: 4000 }] };
  const { pedidos, banco } = preparar([pagina1, 'isto não é json', pagina2]);
  const r = await agir({ acao: 'apos_cnis_ler', imagens: [IMG(1), IMG(2), IMG(3)] });
  assert.equal(r[0], 200);
  assert.equal(pedidos.length, 3, 'uma chamada por imagem');
  assert.deepEqual(r[1].lidos.map((l) => l.ok), [true, false, true]);
  const res = r[1].resumo;
  assert.equal(res.vinculos.length, 3, 'B repetido não duplica');
  assert.equal(res.tc_total_meses, 148); assert.equal(res.tc_2019_meses, 64);
  assert.equal(res.media_salarial, 3000); assert.equal(res.contribuicoes_lidas, 2);
  assert.ok(res.alertas.length >= 2);
  assert.equal([...banco.dados.keys()].some((k) => k.includes('aposentadoria')), false, 'só salva depois da conferência');
  assert.equal((await agir({ acao: 'apos_cnis_ler', imagens: [] }))[0], 400);
});

test('apos_perfil_salvar guarda os vínculos conferidos', async () => {
  preparar();
  const r = await agir({ acao: 'apos_perfil_salvar', nascimento: '1980-02-03', sexo: 'M', tc_2019_meses: 100, tc_total_meses: 200, vinculos: [{ empresa: 'A', inicio: '2010-01-01', fim: '2012-12-31' }, { empresa: 'ruim', inicio: 'x' }] });
  assert.equal(r[1].perfil.vinculos.length, 1);
});

test('prev_simular (servidor): valida e responde', async () => {
  preparar();
  assert.equal((await agir({ acao: 'prev_simular', anos: 10 }))[0], 400, 'sem renda');
  assert.equal((await agir({ acao: 'prev_simular', renda_bruta_anual: 120000 }))[0], 400, 'sem prazo');
  assert.equal((await agir({ acao: 'prev_simular', renda_bruta_anual: 120000, anos: 10, aporte_mensal: -1 }))[0], 400);
  const r = await agir({ acao: 'prev_simular', renda_bruta_anual: 120000, aporte_mensal: 1666.67, anos: 12, taxa_real_ano: 0, declaracao_completa: true, renda_alvo: 3000 });
  assert.equal(r[0], 200);
  assert.equal(r[1].pgbl_ou_vgbl.recomendacao, 'PGBL');
  assert.equal(r[1].tabelas.regressiva.aliquota_pct, 10);
  assert.ok(r[1].quanto_aportar.aporte_mensal > 0);
});

test('ações de outros módulos continuam funcionando (agirAposentadoria devolve null)', async () => {
  preparar();
  assert.equal(await A.agirAposentadoria('salario_config', {}, {}), null);
  assert.equal((await agir({ acao: 'salario_config' }))[0], 200);
});
