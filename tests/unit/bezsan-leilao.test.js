'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../sites/bezsan/leiloes/calculo.js');

const perto = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);

test('LE1 calculo: custos e lucro de um exemplo feito à mão', () => {
  const r = C.calcular({ lance: 'R$ 200.000,00', avaliacao: 400000, reforma: 20000, mensal_condominio: 500, prazo_meses: 12 });
  // taxas 5% + 3% + 1,5% = 9,5% sobre o lance = 19.000; fixos 1.500 + 20.000 + 6.000 = 27.500
  perto(r.custos.total, 246500);
  perto(r.venda.receita, 376000);
  perto(r.resultado.lucro_bruto, 129500);
  perto(r.resultado.lucro_liquido, 129500 * 0.85);
  assert.equal(r.veredito.nivel, 2);
  assert.equal(r.veredito.texto, 'Vale a pena');
});

test('LE2 calculo: lance máximo dá exatamente o lucro alvo; lance de empate dá zero', () => {
  const base = { avaliacao: 300000, reforma: 10000, roi_alvo_pct: 20 };
  const r = C.calcular({ ...base, lance: 150000 });
  const noMax = C.calcular({ ...base, lance: r.resultado.lance_maximo });
  perto(noMax.resultado.roi, 0.2, 0.0005);
  const noEmpate = C.calcular({ ...base, lance: r.resultado.lance_empate });
  perto(noEmpate.resultado.lucro_bruto, 0, 1);
});

test('LE3 calculo: prejuízo, ocupado e alertas baixam o veredito', () => {
  assert.equal(C.calcular({ lance: 390000, avaliacao: 400000 }).veredito.nivel, 0);
  const bom = { lance: 200000, avaliacao: 400000 };
  assert.equal(C.calcular(bom).veredito.nivel, 2);
  const ocup = C.calcular({ ...bom, ocupado: true });
  assert.equal(ocup.veredito.nivel, 1);
  perto(ocup.custos.desocupacao, 15000);
  assert.equal(C.calcular({ ...bom, alertas: ['penhora de terceiro'] }).veredito.nivel, 1);
  assert.match(C.calcular({ ...bom, alertas: ['penhora de terceiro'] }).veredito.motivos.join(' '), /penhora/);
  assert.equal(C.calcular({}).veredito.nivel, 0);
});

test('LE4 calculo: débitos somados e texto em reais lido certo', () => {
  const r = C.calcular({ lance: '100.000', avaliacao: '200.000', debitos_iptu: '3.200,50', debitos_condominio: '10.000', comissao_pct: 0 });
  perto(r.custos.debitos, 13200.5, 0.01);
  assert.equal(r.custos.comissao, 0);
  assert.equal(C.reais(1234567.4), 'R$ 1.234.567');
  assert.equal(C.reais(-25200), '- R$ 25.200');
});

// ── /api/leilao ──
const crypto = require('crypto');
const { fakeDb } = require('../helpers/agenda-fake-db.js');
const L = require('../../netlify/functions/leilao.js');
const TOKEN = 'a'.repeat(64);
const AGORA = Date.parse('2026-10-11T12:00:00Z');
function montarLeilao({ respostas = [], cadastro = { leilao: true }, fetch, visao = true } = {}) {
  const db = fakeDb();
  const chamadas = [];
  db.collection('agenda_contas').doc('bezsan').collection('sessoes').doc(crypto.createHash('sha256').update(TOKEN).digest('hex')).set({ expira: AGORA + 86400000 });
  const router = {
    capabilities: d => ({ available: d.provider !== 'semchave', vision: visao && d.provider === 'google' }),
    chat: async (d, o) => { chamadas.push({ d, o }); const r = respostas.shift(); if (r instanceof Error) throw r; return { text: r }; },
  };
  const FREE = { reasoning: [{ provider: 'anthropic', model: 'pago' }, { provider: 'semchave', model: 'x' }, { provider: 'groq', model: 'g1' }, { provider: 'google', model: 'gem' }] };
  const h = L.createHandler({ getDb: () => db, getMw: () => ({ verifyBearerToken: async () => ({ ok: false }) }), getCadastro: s => (s === 'bezsan' ? cadastro : undefined), getRouter: () => router, getFree: () => FREE, fetch, env: {}, now: () => AGORA });
  const post = body => h({ httpMethod: 'POST', headers: {}, body: JSON.stringify({ site: 'bezsan', token: TOKEN, ...body }) }).then(r => ({ ...r, json: JSON.parse(r.body || '{}') }));
  return { db, post, chamadas };
}
const EDITAL = 'Edital de leilão judicial. '.repeat(20);

test('LE5 leilao: precisa de login e de conta com a Central ativa', async () => {
  const a = montarLeilao();
  assert.equal((await a.post({ token: 'b'.repeat(64), acao: 'listar' })).statusCode, 401);
  assert.equal((await montarLeilao({ cadastro: {} }).post({ acao: 'listar' })).statusCode, 404);
  assert.equal((await a.post({ acao: 'listar' })).statusCode, 200);
  assert.equal((await a.post({ acao: 'xyz' })).statusCode, 400);
});

test('LE6 leilao: analisar edital usa só IA grátis, pula modelo sem chave e lê o JSON', async () => {
  const a = montarLeilao({ respostas: [new Error('429'), 'Aqui está:\n```json\n{"tipo_leilao":"judicial","praca1_valor":250000,"onus":["penhora"],"riscos":["ocupado"]}\n```'] });
  const r = await a.post({ acao: 'analisar', tipo: 'edital', texto: EDITAL });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.json.dados.tipo_leilao, 'judicial');
  assert.equal(r.json.dados.praca1_valor, 250000);
  assert.deepEqual(a.chamadas.map(c => c.d.provider), ['groq', 'google']);
  assert.ok(!a.chamadas.some(c => c.d.provider === 'anthropic'));
  assert.match(a.chamadas[0].o.system, /EDITAL/);
  assert.equal((await a.post({ acao: 'analisar', texto: 'curto' })).statusCode, 400);
});

test('LE7 leilao: matrícula escaneada vai só para modelo com visão', async () => {
  const a = montarLeilao({ respostas: ['{"onus":["hipoteca"],"alertas":[]}'] });
  const r = await a.post({ acao: 'analisar', tipo: 'matricula', imagens: ['data:image/jpeg;base64,' + Buffer.from('x').toString('base64')] });
  assert.equal(r.statusCode, 200, r.body);
  assert.deepEqual(a.chamadas.map(c => c.d.provider), ['google']);
  assert.equal(a.chamadas[0].o.images.length, 1);
  assert.match(a.chamadas[0].o.system, /MATRÍCULA/);
  assert.equal((await a.post({ acao: 'analisar', tipo: 'matricula', imagens: ['javascript:alert(1)'] })).statusCode, 400);
});

test('LE8 leilao: IA toda ocupada dá 503 claro; parecer devolve texto', async () => {
  const a = montarLeilao({ respostas: [new Error('a'), new Error('b')] });
  const r = await a.post({ acao: 'analisar', texto: EDITAL });
  assert.equal(r.statusCode, 503);
  assert.match(r.json.error, /grátis/);
  const b = montarLeilao({ respostas: ['Vale a pena. Confirme com um advogado antes de dar lance.'] });
  const p = await b.post({ acao: 'parecer', imovel: { endereco: 'Rua A' }, conta: { veredito: { nivel: 2 } } });
  assert.equal(p.statusCode, 200);
  assert.match(p.json.texto, /advogado/);
});

test('LE9 leilao: salvar, listar, atualizar e apagar imóvel', async () => {
  const a = montarLeilao();
  const s = await a.post({ acao: 'salvar', imovel: { endereco: 'Rua das Flores, 10', lance: 200000, etapas: { 'busca-perfil': true }, processo_info: { movimentos: [{ data: '2025-01-01', nome: 'Hasta' }] }, 'bad.key': 1 } });
  assert.equal(s.statusCode, 200, s.body);
  const l = await a.post({ acao: 'listar' });
  assert.equal(l.json.imoveis.length, 1);
  assert.equal(l.json.imoveis[0].endereco, 'Rua das Flores, 10');
  assert.equal(l.json.imoveis[0]['bad.key'], undefined);
  assert.equal(l.json.imoveis[0].etapas['busca-perfil'], true);
  assert.equal(l.json.imoveis[0].processo_info.movimentos[0].nome, 'Hasta');
  await a.post({ acao: 'salvar', id: s.json.id, imovel: { endereco: 'Rua das Flores, 12' } });
  const l2 = await a.post({ acao: 'listar' });
  assert.equal(l2.json.imoveis.length, 1);
  assert.equal(l2.json.imoveis[0].endereco, 'Rua das Flores, 12');
  assert.ok(l2.json.imoveis[0].criado_em);
  assert.equal((await a.post({ acao: 'apagar', id: s.json.id })).statusCode, 200);
  assert.equal((await a.post({ acao: 'listar' })).json.imoveis.length, 0);
  assert.equal((await a.post({ acao: 'apagar', id: '../x' })).statusCode, 400);
});

test('LE10 leilao: processo judicial vai ao tribunal certo do DataJud', async () => {
  assert.deepEqual(L.tribunalDoProcesso('1000123-45.2023.8.26.0100'), { numero: '10001234520238260100', alias: 'tjsp' });
  assert.equal(L.tribunalDoProcesso('0001234-45.2023.8.07.0001').alias, 'tjdft');
  assert.equal(L.tribunalDoProcesso('0001234-45.2023.4.03.6100').alias, 'trf3');
  assert.equal(L.tribunalDoProcesso('0001234-45.2023.5.02.0001').alias, 'trt2');
  assert.equal(L.tribunalDoProcesso('123'), null);
  let pedido;
  const fetch = async (url, o) => { pedido = { url, o }; return { ok: true, json: async () => ({ hits: { hits: [{ _source: { numeroProcesso: '10001234520238260100', tribunal: 'TJSP', classe: { nome: 'Execução' }, orgaoJulgador: { nome: '41ª Vara Cível' }, movimentos: [{ dataHora: '2024-01-01', nome: 'Petição' }, { dataHora: '2025-05-05', nome: 'Hasta pública' }] } }] } }) }; };
  const a = montarLeilao({ fetch });
  const r = await a.post({ acao: 'processo', numero: '1000123-45.2023.8.26.0100' });
  assert.equal(r.statusCode, 200, r.body);
  assert.match(pedido.url, /api_publica_tjsp\/_search$/);
  assert.match(pedido.o.headers.Authorization, /^APIKey /);
  assert.equal(r.json.processo.classe, 'Execução');
  assert.equal(r.json.processo.movimentos[0].nome, 'Hasta pública');
  const vazio = await montarLeilao({ fetch: async () => ({ ok: true, json: async () => ({ hits: { hits: [] } }) }) }).post({ acao: 'processo', numero: '1000123-45.2023.8.26.0100' });
  assert.equal(vazio.json.processo, null);
  assert.ok(vazio.json.aviso);
  assert.equal((await a.post({ acao: 'processo', numero: 'abc' })).statusCode, 400);
});

test('LE11 caixa: lê o CSV da Caixa (cabeçalho com lixo antes) e filtra', () => {
  const K = require('../../sites/bezsan/leiloes/caixa.js');
  const csv = [
    ' Lista de Imóveis da Caixa - SP', ' ',
    ' N° do imóvel;UF;Cidade;Bairro;Endereço;Preço;Valor de avaliação;Desconto;Financiamento;Descrição;Modalidade de venda;Link de acesso',
    '1444419970935 ;SP;SAO PAULO ;MOOCA ;RUA A, N. 1 ; 160.000,00 ; 290.000,00 ;44.83;Sim;Apartamento, 60 m2;Venda Direta Online;https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnimovel=1444419970935',
    '1444419970936 ;SP;SÃO PAULO ;LAPA ;RUA B, N. 2 ; 400.000,00 ; 420.000,00 ;4.76;Não;Casa;Leilão SFI - Edital Único;javascript:alert(1)',
    '1444419970937 ;SP;CAMPINAS ;CENTRO ;RUA C ; 90.000,00 ; 200.000,00 ;55;Sim;Terreno;Licitação Aberta;',
  ].join('\r\n');
  const l = K.lerCsv(csv);
  assert.equal(l.length, 3);
  assert.equal(l[0].numero, '1444419970935');
  assert.equal(l[0].preco, 160000);
  assert.equal(l[0].avaliacao, 290000);
  assert.equal(l[0].desconto, 44.83);
  assert.equal(l[0].financiamento, true);
  assert.equal(l[1].link, '', 'link que não é da Caixa é descartado');
  assert.deepEqual(K.filtrar(l, { cidade: 'sao paulo' }).map(i => i.bairro), ['MOOCA', 'LAPA']);
  assert.deepEqual(K.filtrar(l, { descontoMin: '40' }).map(i => i.cidade), ['CAMPINAS', 'SAO PAULO']);
  assert.equal(K.filtrar(l, { precoMax: '150.000' }).length, 1);
  assert.equal(K.filtrar(l, { modalidade: 'leilao' }).length, 1);
  assert.deepEqual(K.modalidades(l), ['Leilão SFI - Edital Único', 'Licitação Aberta', 'Venda Direta Online']);
  assert.equal(K.urlLista('sp'), 'https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_SP.csv');
  assert.equal(K.urlLista('xx'), null);
  assert.deepEqual(K.lerCsv('nada;aqui'), []);
});

test('LE12 etapas: passo a passo completo até as chaves, ids únicos', () => {
  const E = require('../../sites/bezsan/leiloes/etapas.js');
  const todos = E.todos();
  assert.ok(todos.length >= 30);
  assert.equal(new Set(todos.map(p => p.id)).size, todos.length);
  assert.equal(todos[todos.length - 1].id, 'posse-chaves');
  assert.deepEqual(E.progresso({}).proximo.id, 'busca-perfil');
  const p = E.progresso({ 'busca-perfil': true, 'busca-portais': true });
  assert.equal(p.feitos, 2);
  assert.equal(p.proximo.id, 'busca-triagem');
});

test('LE13 leilao: busca automática na API pública do Leilões Judiciais e PDF do lote', async () => {
  const lote = { lote_id: 218898, leilao_id: 99916, nm_titulo_lote: 'Apartamento nº 21 - São Paulo/SP', nm_titulo_leilao: '711ª LEILÃO JUDICIAL UNIFICADO', nm_descricao: '<p>(Proc. 1000818-76.2020.5.02.0090)</p><p>VALOR DA AVALIAÇÃO: R$ 1.700.000,00 (um milhão)</p>', vl_lanceminimo: '1700000.00', vl_lanceinicial: '1275000.00', bn_exibeavaliacao: true, nm_cidade: 'São Paulo', nm_estado: 'SP', dt_fechamento: '2026-11-17 13:05:50-03', anexos: [{ nm: 'EDITAL', nm_path_completo: 'https://s3-sa-east-1.amazonaws.com/906de634c48fb7d34136160b4c353ae4/public/anexo/4399341790094440.pdf' }, { nm: 'X', nm_path_completo: 'https://outro.com/x.pdf' }] };
  const pedidos = [];
  const fetch = async (url, o) => {
    pedidos.push({ url, o });
    if (/mcp\/messages/.test(url)) return { ok: true, json: async () => ({ jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text: JSON.stringify({ totalResults: 1, results: [lote] }) }] } }) };
    return { ok: true, arrayBuffer: async () => Buffer.from('%PDF-1.4 teste') };
  };
  const a = montarLeilao({ fetch });
  const r = await a.post({ acao: 'buscar', busca: 'apartamento', uf: 'sp' });
  assert.equal(r.statusCode, 200, r.body);
  const corpo = JSON.parse(pedidos[0].o.body);
  assert.equal(corpo.params.name, 'search_leiloes');
  assert.deepEqual(corpo.params.arguments, { query: 'apartamento', categoria: 'imoveis', estado: 'SP' });
  const i = r.json.imoveis[0];
  assert.equal(i.lance, 1275000);
  assert.equal(i.avaliacao, 1700000);
  assert.equal(i.desconto, 25);
  assert.equal(i.processo, '1000818-76.2020.5.02.0090');
  assert.equal(i.link, 'https://www.leiloesjudiciais.com.br/lote/99916/218898');
  assert.equal(i.anexos.length, 1, 'só anexos do repositório público do leilão');
  assert.ok(!/</.test(i.descricao));
  assert.equal((await a.post({ acao: 'buscar', busca: 'casa', uf: 'XX' })).statusCode, 400);
  const pdf = await a.post({ acao: 'arquivo', url: i.anexos[0].url });
  assert.equal(pdf.statusCode, 200);
  assert.equal(Buffer.from(pdf.json.pdf, 'base64').toString().slice(0, 4), '%PDF');
  assert.equal((await a.post({ acao: 'arquivo', url: 'https://evil.com/a.pdf' })).statusCode, 400);
  const falha = montarLeilao({ fetch: async () => ({ ok: false }) });
  assert.equal((await falha.post({ acao: 'buscar', busca: 'xyz-sem-cache' })).statusCode, 502);
});

const P = require('../../sites/bezsan/leiloes/parecer.js');
const { fetchRegiao } = require('../helpers/regiao-fake.js');
const REGIAO_BOA = { municipio: { nome: 'São Paulo', uf: 'SP' }, populacao: { cresc_anual_pct: 1.2 }, pib_per_capita: { cresc_anual_pct: 9 }, servicos: [1, 2, 3, 4, 5, 6].map(q => ({ nome: 'S' + q, qtd: q })), mercado: { ivgr_12m_pct: 5.3 } };
const pilar = (pc, id) => pc.pilares.find(p => p.id === id);

test('LE14 parecer: imóvel limpo, desocupado, barato e em cidade crescendo vale a pena até o limite', () => {
  const im = { lance: 200000, avaliacao: 400000, modalidade: 'Leilão extrajudicial', area_m2: 70, preco_m2: 6000,
    analise_edital: { tipo_leilao: 'extrajudicial', ocupado: false, iptu_quem_paga: 'preco', tipo_imovel: 'casa', onus: [] },
    analise_matricula: { onus: ['Alienação fiduciária ao Banco X'], alertas: [] }, regiao: REGIAO_BOA };
  const pc = P.montar(im, C.calcular(im));
  assert.equal(pc.nivel, 2, JSON.stringify(pc.pilares.map(p => [p.id, p.nota, p.itens.map(i => i.nivel + ':' + i.texto)])));
  assert.match(pc.veredito, /^Vale a pena, até R\$ /);
  assert.ok(pc.nota >= 80, 'nota ' + pc.nota);
  assert.ok(pc.lance_limite > 0 && pc.lance_limite <= pc.lance_maximo_conta);
  assert.equal(pc.lance_limite % 500, 0);
  assert.equal(pc.tipo_leilao, 'extrajudicial');
  assert.equal(pc.posse.ocupado, false);
  assert.ok(pc.venda_com_valorizacao > 400000);
});

test('LE15 parecer: indisponibilidade, embargos, ocupado por invasor e IPTU por conta de quem compra', () => {
  const base = { lance: 200000, avaliacao: 400000, ocupado: true, processo: '1000123-45.2023.8.26.0100', regiao: REGIAO_BOA,
    analise_edital: { tipo_leilao: 'judicial', ocupado: true, ocupante: 'terceiros invasores', debitos_iptu: 'Os débitos de IPTU ficam a cargo do arrematante', tipo_imovel: 'apartamento', executado: 'João Executado', onus: ['Penhora (R.5)'] },
    analise_matricula: { proprietarios: ['Maria Outra Pessoa'], onus: ['Penhora (R.5)', 'Indisponibilidade de bens (AV.6)'], alertas: [] },
    processo_info: { classe: 'Execução', sinais: [{ nome: 'Embargos à Execução' }, { nome: 'Agravo de Instrumento' }] } };
  const pc = P.montar(base, C.calcular(base));
  const j = pilar(pc, 'juridico').itens.map(i => i.nivel + ':' + i.texto).join('\n');
  assert.match(j, /grave:Há indisponibilidade/);
  assert.match(j, /grave:O executado do edital \(João Executado\) não aparece/);
  assert.match(j, /grave:O processo tem embargos/);
  assert.match(j, /atencao:O processo tem recurso/);
  assert.match(pilar(pc, 'posse').itens.map(i => i.nivel + ':' + i.texto).join('\n'), /grave:Ocupado por terceiros/);
  assert.equal(pc.posse.prazo, '3 a 12 meses');
  assert.match(pilar(pc, 'dividas').itens.map(i => i.nivel + ':' + i.texto).join('\n'), /grave:O edital diz que quem compra paga o IPTU/);
  assert.notEqual(pc.nivel, 2, 'com ponto grave nunca diz "Vale a pena"');
  assert.ok(pc.reserva_risco >= 0.2, 'reserva ' + pc.reserva_risco);
  assert.ok(pc.conferir.some(c => /advogado/.test(c)));
  // mesma coisa, mas com prejuízo: não vale
  const caro = { ...base, lance: 390000 };
  assert.equal(P.montar(caro, C.calcular(caro)).nivel, 0);
  assert.equal(P.montar(caro, C.calcular(caro)).lance_limite, 0);
});

test('LE16 parecer: sem dados pede o que falta; quem paga a dívida é lido do texto do edital', () => {
  const vazio = P.montar({}, C.calcular({}));
  assert.equal(vazio.nivel, 0);
  assert.match(vazio.veredito, /Faltam dados/);
  assert.equal(pilar(vazio, 'regiao').nota, null, 'região sem dados não entra na nota');
  assert.ok(vazio.conferir.some(c => /Analisar a região/.test(c)));
  assert.equal(P.quemPaga('', 'Os débitos de IPTU sub-rogam-se no preço (art. 130 do CTN).'), 'preco');
  assert.equal(P.quemPaga('', 'Débitos condominiais são de responsabilidade do arrematante.'), 'arrematante');
  assert.equal(P.quemPaga('nao_informado', 'Nada consta.'), '');
  assert.equal(P.tipoLeilao({ modalidade: 'Venda Direta Online' }), 'venda_direta');
  // avaliação inflada em relação ao mercado
  const im = { lance: 200000, avaliacao: 600000, area_m2: 60, preco_m2: 5000 };
  assert.match(pilar(P.montar(im, C.calcular(im)), 'financeiro').itens.map(i => i.texto).join(' '), /acima do valor de mercado estimado \(R\$ 300\.000/);
});

test('LE17 leilao: região com IBGE, Banco Central, mapa e serviços perto; sinais do processo', async () => {
  const f = fetchRegiao({ cidade: 'Santa Rita do Teste', id: 3599901 });
  const a = montarLeilao({ fetch: f.fn });
  const r = await a.post({ acao: 'regiao', endereco: 'Rua das Palmeiras, 200', cidade: 'santa rita do teste', uf: 'sp' });
  assert.equal(r.statusCode, 200, r.body);
  const g = r.json.regiao;
  assert.equal(g.municipio.id, 3599901);
  assert.equal(g.populacao.censo_2022, 11451245);
  assert.equal(g.populacao.cresc_anual_pct, 0.1);
  assert.equal(g.pib_per_capita.ano, 2021);
  assert.equal(g.pib_per_capita.cresc_anual_pct, 3.2);
  assert.equal(g.mercado.ivgr_12m_pct, 5.3);
  assert.equal(g.mercado.selic_pct, 13.75);
  assert.equal(g.local.bairro, 'Santa Cecília');
  assert.deepEqual(g.servicos.map(s => s.qtd), [26, 37, 28, 54, 29, 68]);
  assert.ok(f.pedidos.find(p => /nominatim/.test(p.url)).o.headers['User-Agent'].includes('NEXIA'), 'Nominatim pede identificação');
  assert.ok(f.pedidos.find(p => /indicadores/.test(p.url)).url.endsWith('/resultados/359990'), 'IBGE usa o código de 6 dígitos');
  assert.match(decodeURIComponent(f.pedidos.find(p => /overpass/.test(p.url)).o.body), /around:1000,-23\.55274,-46\.65395/);
  assert.equal((await a.post({ acao: 'regiao', cidade: 'Cidade Que Não Existe', uf: 'SP' })).statusCode, 502);
  assert.equal((await a.post({ acao: 'regiao', cidade: 'X', uf: 'ZZ' })).statusCode, 400);
  // Endereço fora da cidade no mapa: não conta serviços de outro lugar
  const fora = fetchRegiao({ cidade: 'Outra Cidade Teste', id: 3599902 });
  const b = montarLeilao({ fetch: async (u, o) => (/nominatim/.test(u) ? { ok: true, json: async () => [{ lat: '-1', lon: '-1', address: { city: 'Longe' } }] } : fora.fn(u, o)) });
  const r2 = await b.post({ acao: 'regiao', endereco: 'Rua X', cidade: 'Outra Cidade Teste', uf: 'RJ' });
  assert.equal(r2.statusCode, 200, r2.body);
  assert.equal(r2.json.regiao.servicos, null);
  assert.equal(r2.json.regiao.local.na_cidade, false);
  // Sinais: procura em todas as movimentações do processo
  const movs = Array.from({ length: 30 }, (_, i) => ({ dataHora: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`, nome: i === 0 ? 'Embargos à Execução' : 'Juntada de Petição' }));
  const c = montarLeilao({ fetch: async () => ({ ok: true, json: async () => ({ hits: { hits: [{ _source: { numeroProcesso: '1', movimentos: movs } }] } }) }) });
  const pr = await c.post({ acao: 'processo', numero: '1000123-45.2023.8.26.0100' });
  assert.equal(pr.json.processo.movimentos.length, 15);
  assert.deepEqual(pr.json.processo.sinais.map(s => s.nome), ['Embargos à Execução']);
});
