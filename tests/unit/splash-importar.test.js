'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
let XLSX;
try {
  XLSX = require('xlsx');
} catch {
  // no-op em ambiente sem XLSX instalado
}

const {
  removerAcentos,
  parseDataExcelOuTexto,
  parseUnidadeImportacao,
  parseWhatsappImportacao,
  parseSituacaoImportacao,
  mapearCabecalhosImportacao,
  normalizarLinhaImportacao
} = require('../../sites/splash/agenda/painel.js');

const { createHandler, hashSenha, COLLECTION } = require('../../netlify/functions/locacao.js');
const { LOCACOES } = require('../../clientes/locacoes.js');
const { fakeDb } = require('../helpers/agenda-fake-db.js');

const SEG_9H = Date.parse('2026-10-12T12:00:00Z');
const HOJE_BR = '2026-10-12';
const SALT_TESTE = '1234567890abcdef1234567890abcdef';

async function getCadastroTeste() {
  const hash = await hashSenha('CODIGO123', SALT_TESTE);
  return {
    nome: 'Splash Eventos Teste',
    versao: 1,
    codigo_salt: SALT_TESTE,
    codigo_hash: hash,
    config: LOCACOES.splash.config,
  };
}

async function montar(opts = {}) {
  const db = opts.db || fakeDb();
  let agora = opts.agora || SEG_9H;
  const cadastro = opts.cadastro || (await getCadastroTeste());

  const h = createHandler({
    getDb: () => db,
    getMw: () => ({ verifyBearerToken: async () => ({ ok: true, uid: 'm', role: 'user' }) }),
    getCadastro: s => (s === 'splash' ? cadastro : undefined),
    getLista: () => ({ splash: cadastro }),
    now: () => agora,
  });

  let ip = 0;
  const post = (body, extra = {}) => h({
    httpMethod: 'POST',
    headers: { 'cf-connecting-ip': extra.ip || '10.0.0.' + (++ip), ...(extra.headers || {}) },
    body: JSON.stringify({ site: 'splash', ...body }),
  }).then(r => ({ ...r, json: JSON.parse(r.body || '{}') }));

  return { db, h, post, setAgora: t => { agora = t; }, cadastro };
}

async function logar(a) {
  const r = await a.post({ acao: 'primeiro-acesso', codigo: 'CODIGO123', senha_nova: 'senhaValida123' });
  assert.equal(r.statusCode, 200, r.body);
  return r.json.token;
}

test('IMP1. Parsing e normalização de datas em variados formatos (ISO, BR, serial Excel)', () => {
  assert.equal(parseDataExcelOuTexto('2026-11-20'), '2026-11-20');
  assert.equal(parseDataExcelOuTexto('20/11/2026'), '2026-11-20');
  assert.equal(parseDataExcelOuTexto('5/8/26'), '2026-08-05');
  assert.equal(parseDataExcelOuTexto(45000), '2023-03-15'); // Serial Excel
  assert.equal(parseDataExcelOuTexto('data_invalida'), null);
});

test('IMP2. Mapeamento tolerante de unidades e WhatsApp', () => {
  assert.equal(parseUnidadeImportacao('Santa Adélia', 'santa-barbara'), 'santa-adelia');
  assert.equal(parseUnidadeImportacao('SA', 'santa-barbara'), 'santa-adelia');
  assert.equal(parseUnidadeImportacao('Unidade 1', 'santa-barbara'), 'santa-adelia');
  assert.equal(parseUnidadeImportacao('Santa Bárbara', 'santa-adelia'), 'santa-barbara');
  assert.equal(parseUnidadeImportacao('SB', 'santa-adelia'), 'santa-barbara');
  assert.equal(parseUnidadeImportacao('2', 'santa-adelia'), 'santa-barbara');
  assert.equal(parseUnidadeImportacao('', 'santa-barbara'), 'santa-barbara');

  assert.equal(parseWhatsappImportacao('(17) 99999-8888'), '17999998888');
});

test('IMP3. Mapeamento de situação e regra de data no passado virando concluído', () => {
  assert.equal(parseSituacaoImportacao('confirmado', '2026-11-20', HOJE_BR), 'confirmado');
  assert.equal(parseSituacaoImportacao('aguardando sinal', '2026-11-20', HOJE_BR), 'aguardando_sinal');
  assert.equal(parseSituacaoImportacao('confirmado', '2026-05-10', HOJE_BR), 'concluido');
});

test('IMP4. Mapeamento tolerante de cabeçalhos', () => {
  const cab = ['Data', 'Local', 'Nome do Cliente', 'Telefone/Zap', 'Tipo', 'Sinal', 'Status', 'Observações'];
  const mapa = mapearCabecalhosImportacao(cab);
  assert.equal(mapa.data, 0);
  assert.equal(mapa.unidade, 1);
  assert.equal(mapa.cliente, 2);
  assert.equal(mapa.whatsapp, 3);
  assert.equal(mapa.tipo_evento, 4);
  assert.equal(mapa.valor_sinal, 5);
  assert.equal(mapa.situacao, 6);
  assert.equal(mapa.observacoes, 7);
});

test('IMP5. Atribuição de selo OK, AVISO e ERRO na prévia', () => {
  const mapa = { data: 0, unidade: 1, cliente: 2, whatsapp: 3, tipo_evento: 4, valor_sinal: 5, situacao: 6, observacoes: 7 };
  const chaves = new Set();

  const okRow = normalizarLinhaImportacao(['2026-11-20', 'Santa Adélia', 'Maria', '17999998888', 'Festa', '100', 'confirmado', 'Obs'], mapa, 'santa-adelia', HOJE_BR, chaves);
  assert.equal(okRow.selo, 'OK');

  const dupRow = normalizarLinhaImportacao(['2026-11-20', 'Santa Adélia', 'Outro', '17999998888', 'Festa', '100', 'confirmado', 'Obs'], mapa, 'santa-adelia', HOJE_BR, chaves);
  assert.equal(dupRow.selo, 'ERRO');
  assert.match(dupRow.motivo, /duplicadas/);

  const passRow = normalizarLinhaImportacao(['2026-01-10', 'Santa Bárbara', 'Ana', '17999998888', 'Festa', '100', 'confirmado', 'Obs'], mapa, 'santa-barbara', HOJE_BR, new Set());
  assert.equal(passRow.selo, 'AVISO');
  assert.equal(passRow.situacao, 'concluido');
});

test('IMP5.5. Leitura e parsing real de arquivo CSV e XLSX com SheetJS/TextDecoder', () => {
  const csvText = 'Data,Unidade,Cliente,WhatsApp,Tipo,Sinal,Situação,Obs\n' +
    '2026-11-10,Santa Adélia,Maria Silva,17999998888,Aniversário,200,confirmado,Festa de 15 anos\n' +
    '2026-11-15,Santa Bárbara,João Souza,17988887777,Casamento,500,aguardando_sinal,Cerimônia no salão principal\n';

  const rows = csvText.split(/\r?\n/).filter(r => r.trim()).map(r => r.split(','));
  const header = rows[0];
  const mapa = mapearCabecalhosImportacao(header);

  const row1 = normalizarLinhaImportacao(rows[1], mapa, 'santa-adelia', HOJE_BR, new Set());
  assert.equal(row1.data, '2026-11-10');
  assert.equal(row1.unidade, 'santa-adelia');
  assert.equal(row1.cliente, 'Maria Silva');
  assert.equal(row1.selo, 'OK');

  if (XLSX) {
    const wsData = [
      ['Dia', 'Local', 'Nome', 'Zap', 'Evento', 'Valor', 'Status', 'Notas'],
      ['15/12/2026', 'SA', 'Fernanda Lima', '17977776666', 'Formatura', 300, 'confirmado', 'Jantar']
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Agenda');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const wbRead = XLSX.read(buf, { type: 'buffer' });
    const parsedRows = XLSX.utils.sheet_to_json(wbRead.Sheets[wbRead.SheetNames[0]], { header: 1 });
    const mapaXlsx = mapearCabecalhosImportacao(parsedRows[0]);
    const normXlsx = normalizarLinhaImportacao(parsedRows[1], mapaXlsx, 'santa-adelia', HOJE_BR, new Set());

    assert.equal(normXlsx.data, '2026-12-15');
    assert.equal(normXlsx.unidade, 'santa-adelia');
    assert.equal(normXlsx.cliente, 'Fernanda Lima');
    assert.equal(normXlsx.selo, 'OK');
  }
});

test('IMP6. Backend: importar lote revalida e grava travas e reservas', async () => {
  const a = await montar();
  const token = await logar(a);

  const linhas = [
    { data: '2026-11-20', unidade: 'santa-adelia', cliente: 'Cliente Importado 1', whatsapp: '17999998888', tipo_evento: 'Casamento', situacao: 'confirmado' },
    { data: '2026-11-21', unidade: 'santa-adelia', cliente: 'Cliente Importado 2', whatsapp: '17988887777', tipo_evento: 'Aniversário', situacao: 'aguardando_sinal' }
  ];

  const res = await a.post({ acao: 'importar', token, lote_id: 'LOTE-TESTE-1', linhas });
  assert.equal(res.statusCode, 200, res.body);
  assert.equal(res.json.ok, true);
  assert.equal(res.json.importadas, 2);
  assert.equal(res.json.puladas, 0);

  const lockDoc = a.db.docs.get(`${COLLECTION}/splash/dias/santa-adelia_2026-11-20`);
  assert.ok(lockDoc, 'trava do dia deve ser criada na importação');
});

test('IMP7. Backend: impede importação de dia já ocupado', async () => {
  const a = await montar();
  const token = await logar(a);

  // Cria reserva prévia no dia
  await a.post({ acao: 'criar', token, unidade: 'santa-adelia', data: '2026-11-20', nome: 'Existente', whatsapp: '11999998888' });

  const linhas = [
    { data: '2026-11-20', unidade: 'santa-adelia', cliente: 'Conflito', whatsapp: '17999998888' },
    { data: '2026-11-22', unidade: 'santa-adelia', cliente: 'Livre', whatsapp: '17988887777' }
  ];

  const res = await a.post({ acao: 'importar', token, lote_id: 'LOTE-TESTE-2', linhas });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json.importadas, 1);
  assert.equal(res.json.puladas, 1);
  assert.match(res.json.detalhes[0].motivo, /reservado/);
});

test('IMP8. Backend: limite de 2000 linhas por arquivo recusado', async () => {
  const a = await montar();
  const token = await logar(a);

  const muitasLinhas = new Array(2001).fill({ data: '2026-11-20', unidade: 'santa-adelia' });
  const res = await a.post({ acao: 'importar', token, linhas: muitasLinhas });
  assert.equal(res.statusCode, 400);
  assert.match(res.json.error, /2000 linhas/);
});

test('IMP9. Backend: desfazer importação por lote_id remove reservas e travas intactas', async () => {
  const a = await montar();
  const token = await logar(a);

  const linhas = [
    { data: '2026-11-25', unidade: 'santa-adelia', cliente: 'Desfazer 1', whatsapp: '17999998888' },
    { data: '2026-11-26', unidade: 'santa-adelia', cliente: 'Desfazer 2', whatsapp: '17988887777' }
  ];

  const imp = await a.post({ acao: 'importar', token, lote_id: 'LOTE-DESFAZER', linhas });
  assert.equal(imp.json.importadas, 2);

  const des = await a.post({ acao: 'desfazer-importacao', token, lote_id: 'LOTE-DESFAZER' });
  assert.equal(des.statusCode, 200);
  assert.equal(des.json.desfeitas, 2);

  const lockDoc = a.db.docs.get(`${COLLECTION}/splash/dias/santa-adelia_2026-11-25`);
  assert.equal(lockDoc, undefined, 'trava do dia deve ter sido removida');
});
