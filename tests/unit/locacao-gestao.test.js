'use strict';
// Gestão da dona: pagamentos por reserva, despesas, resumo financeiro por unidade, clientes fiéis, promoções e avaliações.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHandler, hashSenha, resumoFinanceiro, resumoClientes, montarConfig } = require('../../netlify/functions/locacao.js');
const { LOCACOES } = require('../../clientes/locacoes.js');
const { fakeDb } = require('../helpers/agenda-fake-db.js');

const SEG_9H = Date.parse('2026-10-12T12:00:00Z');
const SALT = '1234567890abcdef1234567890abcdef';
let ipN = 0;

async function montar() {
  const db = fakeDb();
  const cadastro = { nome: 'Splash Teste', versao: 1, codigo_salt: SALT, codigo_hash: await hashSenha('CODIGO123', SALT), config: LOCACOES.splash.config };
  const h = createHandler({
    getDb: () => db,
    getMw: () => ({ verifyBearerToken: async () => ({ ok: false }) }),
    getCadastro: s => (s === 'splash' ? cadastro : undefined),
    getLista: () => ({ splash: cadastro }),
    now: () => SEG_9H,
  });
  const post = body => h({ httpMethod: 'POST', headers: { 'cf-connecting-ip': '77.1.' + ((ipN >> 8) & 255) + '.' + (ipN++ & 255) }, body: JSON.stringify({ site: 'splash', ...body }) })
    .then(r => ({ status: r.statusCode, json: JSON.parse(r.body || '{}') }));
  const get = q => h({ httpMethod: 'GET', headers: {}, queryStringParameters: { site: 'splash', ...q } }).then(r => ({ status: r.statusCode, json: JSON.parse(r.body || '{}') }));
  const t = (await post({ acao: 'primeiro-acesso', codigo: 'CODIGO123', senha_nova: 'senhaValida123' })).json.token;
  const api = (acao, extra = {}) => post({ acao, token: t, ...extra });
  return { api, post, get };
}

const nova = (a, extra) => a.api('criar', { unidade: 'santa-adelia', data: '2026-10-20', nome: 'Cliente A', whatsapp: '11988887777', tipo_evento: 'Aniversário', convidados: 20, status: 'confirmado', valor_total: 1000, valor_sinal: 300, ...extra });

test('GEST1. promoções com imagem e avaliações: a dona salva, o site público lê e links perigosos são descartados', async () => {
  const a = await montar();
  const r = await a.api('config', { config: {
    promocoes: [
      { texto: 'Dia 02/11 por R$ 799,99', imagem: '/api/locacao?site=splash&foto=aaaaaaaaaaaaaaaaaaaaaaaa' },
      { texto: 'Link ruim', imagem: 'javascript:alert(1)' },
      { texto: '', imagem: 'https://exemplo.com/p.jpg' },
      { texto: '', imagem: 'http://exemplo.com/sem-https.jpg' },
    ],
    avaliacoes: [{ nome: 'Maria', texto: 'Festa linda!', estrelas: 9 }, { nome: 'Sem texto', texto: '' }],
    fidelidade: { minimo: 2, percentual: 15 },
  } });
  assert.equal(r.status, 200);
  const publico = (await a.post({ acao: 'x' })).status; // só para gastar uma chamada sem login
  assert.ok(publico >= 400);
  const cfg = (await a.get({})).json;
  assert.equal(cfg.promocoes.length, 3, 'a promoção sem texto e sem imagem https some');
  assert.equal(cfg.promocoes[0].imagem, '/api/locacao?site=splash&foto=aaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(cfg.promocoes[1].imagem, '', 'javascript: é descartado');
  assert.equal(cfg.promocoes[2].imagem, 'https://exemplo.com/p.jpg');
  assert.deepEqual(cfg.avaliacoes.map(x => [x.nome, x.estrelas]), [['Maria', 5]]);
  assert.equal(cfg.fidelidade, undefined, 'fidelidade é só do painel');
});

test('GEST2. "Sinal pago" registra o sinal como pagamento recebido, sem duplicar', async () => {
  const a = await montar();
  const { json: c } = await nova(a, { status: 'aguardando_sinal' });
  assert.equal((await a.api('status', { id: c.id, status: 'confirmado' })).status, 200);
  const fin = (await a.api('financeiro', { de: '2026-10-01', ate: '2026-10-31' })).json;
  assert.equal(fin.reservas[0].recebido, 300);
  assert.equal(fin.pagamentos.length, 1);
  assert.equal(fin.pagamentos[0].tipo, 'sinal');
});

test('GEST3. pagamentos: registrar, valor inválido recusado e remover', async () => {
  const a = await montar();
  const { json: c } = await nova(a);
  assert.equal((await a.api('pagamento-registrar', { id: c.id, valor: 0 })).status, 400);
  assert.equal((await a.api('pagamento-registrar', { id: c.id, valor: -5 })).status, 400);
  const p = await a.api('pagamento-registrar', { id: c.id, valor: 250.5, forma: 'dinheiro', data: '2026-10-15', obs: 'resto' });
  assert.equal(p.status, 200);
  assert.equal(p.json.pagamento.forma, 'dinheiro');
  const f1 = (await a.api('financeiro', { de: '2026-10-01', ate: '2026-10-31' })).json;
  assert.equal(f1.reservas[0].recebido, 250.5);
  assert.equal((await a.api('pagamento-remover', { id: c.id, pagamento_id: p.json.pagamento.id })).status, 200);
  assert.equal((await a.api('pagamento-remover', { id: c.id, pagamento_id: 'naoexiste' })).status, 404);
  const f2 = (await a.api('financeiro', { de: '2026-10-01', ate: '2026-10-31' })).json;
  assert.equal(f2.reservas[0].recebido, 0);
});

test('GEST4. financeiro: faturamento, recebido, a receber, despesas e lucro por unidade', async () => {
  const a = await montar();
  const r1 = (await nova(a, { data: '2026-10-20', valor_total: 1000, valor_sinal: 0 })).json;
  const r2 = (await nova(a, { unidade: 'santa-barbara', data: '2026-10-21', nome: 'Cliente B', whatsapp: '11977776666', valor_total: 800, valor_sinal: 0 })).json;
  await nova(a, { data: '2026-10-22', nome: 'Cancelada', whatsapp: '11955554444', status: 'cancelado', valor_total: 5000 });
  await a.api('pagamento-registrar', { id: r1.id, valor: 400, data: '2026-10-10' });
  await a.api('pagamento-registrar', { id: r2.id, valor: 800, data: '2026-10-11' });
  await a.api('despesa-salvar', { unidade: 'santa-adelia', categoria: 'limpeza', descricao: 'Faxina', valor: 150, data: '2026-10-21' });
  await a.api('despesa-salvar', { unidade: 'geral', categoria: 'marketing', descricao: 'Anúncio', valor: 100, data: '2026-10-05' });
  const fin = (await a.api('financeiro', { de: '2026-10-01', ate: '2026-10-31' })).json;
  const adelia = fin.por_unidade.find(u => u.id === 'santa-adelia');
  const barbara = fin.por_unidade.find(u => u.id === 'santa-barbara');
  const geral = fin.por_unidade.find(u => u.id === 'geral');
  assert.deepEqual([adelia.reservas, adelia.faturamento, adelia.recebido, adelia.a_receber, adelia.despesas, adelia.lucro_previsto, adelia.lucro_caixa], [1, 1000, 400, 600, 150, 850, 250]);
  assert.deepEqual([barbara.reservas, barbara.faturamento, barbara.recebido, barbara.a_receber, barbara.despesas, barbara.lucro_previsto], [1, 800, 800, 0, 0, 800]);
  assert.equal(geral.despesas, 100);
  assert.deepEqual([fin.total.faturamento, fin.total.recebido, fin.total.despesas, fin.total.lucro_previsto, fin.total.lucro_caixa], [1800, 1200, 250, 1550, 950]);
  assert.equal(fin.reservas_sem_valor, 0);
  assert.equal(fin.meses[0].mes, '2026-10');
  const soBarbara = (await a.api('financeiro', { de: '2026-10-01', ate: '2026-10-31', unidade: 'santa-barbara' })).json;
  assert.deepEqual(soBarbara.reservas.map(r => r.nome), ['Cliente B']);
});

test('GEST5. despesas: valida valor e descrição, unidade desconhecida vira geral, e dá para remover', async () => {
  const a = await montar();
  assert.equal((await a.api('despesa-salvar', { descricao: 'Sem valor', valor: 0 })).status, 400);
  assert.equal((await a.api('despesa-salvar', { descricao: '', valor: 10 })).status, 400);
  const d = await a.api('despesa-salvar', { descricao: 'Cloro', valor: 80.9, unidade: 'inventada', categoria: 'piscina', data: '2026-10-12' });
  assert.equal(d.status, 201);
  assert.equal(d.json.despesa.unidade, 'geral');
  const f = (await a.api('financeiro', { de: '2026-10-01', ate: '2026-10-31' })).json;
  assert.equal(f.despesas.length, 1);
  assert.equal((await a.api('despesa-remover', { id: d.json.despesa.id })).status, 200);
  assert.equal((await a.api('despesa-remover', { id: d.json.despesa.id })).status, 404);
});

test('GEST6. clientes fiéis: ranking por reservas e desconto sugerido só a partir do mínimo', async () => {
  const a = await montar();
  for (const dia of ['2026-10-20', '2026-10-21', '2026-10-22']) await nova(a, { data: dia, nome: 'Maria Fiel', whatsapp: '(11) 98888-7777', valor_total: 500 });
  await nova(a, { data: '2026-10-25', nome: 'Joao Novo', whatsapp: '11977776666', valor_total: 900 });
  await nova(a, { data: '2026-10-26', nome: 'Desistiu', whatsapp: '11955554444', status: 'cancelado' });
  const r = (await a.api('clientes')).json;
  assert.deepEqual(r.fidelidade, { minimo: 3, percentual: 10 });
  assert.equal(r.clientes[0].nome, 'Maria Fiel');
  assert.equal(r.clientes[0].reservas, 3);
  assert.equal(r.clientes[0].total_gasto, 1500);
  assert.equal(r.clientes[0].fiel, true);
  assert.equal(r.clientes[0].desconto_sugerido, 10);
  const joao = r.clientes.find(c => c.nome === 'Joao Novo');
  assert.equal(joao.fiel, false);
  assert.equal(joao.desconto_sugerido, 0);
});

test('GEST7. as ações financeiras exigem login', async () => {
  const a = await montar();
  for (const acao of ['financeiro', 'clientes', 'despesa-salvar', 'despesa-remover', 'pagamento-registrar', 'pagamento-remover']) {
    const r = await a.post({ acao, id: 'x', valor: 10, descricao: 'x' });
    assert.equal(r.status, 401, acao);
  }
});

test('GEST8. funções puras: reservas sem valor são contadas e período fora da janela é ignorado', () => {
  const unidades = [{ id: 'u1', nome: 'U1' }];
  const f = resumoFinanceiro([
    { unidade: 'u1', data: '2026-10-10', status: 'confirmado', valor_total: 0 },
    { unidade: 'u1', data: '2026-12-10', status: 'confirmado', valor_total: 999 },
    { unidade: 'u1', data: '2026-10-11', status: 'bloqueado', valor_total: 999 },
  ], [], unidades, '2026-10-01', '2026-10-31');
  assert.equal(f.reservas_sem_valor, 1);
  assert.equal(f.total.faturamento, 0);
  assert.equal(resumoClientes([], { minimo: 2, percentual: 5 }).clientes.length, 0);
  assert.equal(montarConfig({}, {}).fidelidade.minimo, 3);
});
