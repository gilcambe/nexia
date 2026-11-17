'use strict';
// Contrato: Kernex Finance — IMPORTAR EXTRATO DO BANCO EM ARQUIVO (OFX ou CSV), sem senha de banco (dono 17/11, PDFs:
// "integração com bancos... importação de extratos"). Reaproveita o fluxo da aba Documentos: lê -> mostra -> confirma.
// Pedido:
// 1) Novo netlify/functions/prumo-lib/extrato.js exportando { lerOFX, lerCSV, agirExtrato }:
//    - lerOFX(texto): cada <STMTTRN> vira { data: 'AAAA-MM-DD' (de DTPOSTED AAAAMMDD...), valor: número com sinal
//      (TRNAMT), descricao: MEMO ou NAME, id_banco: FITID }. Aceita OFX 1.x (SGML, tags SEM fechamento, ex.:
//      "<TRNAMT>-45.90") e OFX 2.x (XML, com fechamento).
//    - lerCSV(texto): separador ';' ou ',' (o da 1ª linha); 1ª linha = cabeçalho; colunas achadas pelo nome, sem
//      acento e sem maiúscula: data|date; descricao|historico|lancamento|title|description; valor|amount|value.
//      Campos entre aspas podem ter o separador dentro. Valor brasileiro "1.234,56" ou "-1234.56". Data DD/MM/AAAA
//      ou AAAA-MM-DD; data impossível (mês > 12, dia > 31) vira '' (vai para conferir). Mesma forma do lerOFX (sem id_banco).
//    - agirExtrato(acao, body, c) com a ação 'extrato_ler' { nome, conteudo } (devolve null para outras ações):
//      conteudo texto até 2.000.000 caracteres (senão 400); formato pelo nome (.ofx/.csv) ou pelo conteúdo ("<OFX"
//      ou "OFXHEADER" = OFX); formato desconhecido ou nenhuma linha -> 400 com mensagem simples.
//      Cada linha vira lançamento com require('./documentos').normalizarLancamento({ data, descricao, valor:
//      Math.abs(valor), tipo: valor < 0 ? 'despesa' : 'receita', documento: 'extrato' }, { tipo_documento: 'extrato' }).
//      Os que não passam vão para conferir (com motivo). Os que já existem em 'lancamentos' (mesmo
//      require('./documentos').idDe(item)) não voltam: contam em ja_lancados.
//      Resposta [200, { documento: 'extrato', imagens_lidas: 1, imagens_total: 1, prontos, conferir, ja_lancados,
//      receitas, despesas }] (somas dos prontos), igual à do doc_ler, para a tela reusar o "Confirmar e gravar".
//    - Ligar em prumo-lib/extra.js (agirExtra), como os outros.
// 2) prumo/documentos.js: o <input id="kf-arq"> aceita também .ofx e .csv. Ao tocar "Ler documento": se os arquivos
//    escolhidos forem .ofx/.csv, NÃO passam pelo PDF/imagem: o texto de cada um (await arquivo.text()) vai em
//    MB.api('extrato_ler', { nome, conteudo }) e o resultado aparece com o mesmo mostrarLeitura (vários arquivos:
//    junte prontos/conferir/somas). Fotos e PDF continuam como hoje (doc_ler).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const p = require('../../netlify/functions/prumo.js');

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
    where: () => col(caminho), orderBy: () => col(caminho), limit: () => col(caminho),
  });
  return { collection: col, dados };
}
function preparar() { const banco = bancoFalso(); p.deps.db = () => banco; p.deps.agora = () => new Date('2026-11-20T12:00:00Z'); return banco; }

const OFX1 = `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261105120000[-3:BRT]
<TRNAMT>-45.90
<FITID>A1
<MEMO>PADARIA DO ZE
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261106
<TRNAMT>3000.00
<FITID>A2
<MEMO>SALARIO EMPRESA X
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261107
<TRNAMT>-120.00
<FITID>A3
<NAME>CONTA DE LUZ
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;
const OFX2 = '<?xml version="1.0"?><OFX><BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261108</DTPOSTED><TRNAMT>-10.50</TRNAMT><FITID>B1</FITID><MEMO>CAFE</MEMO></STMTTRN></BANKTRANLIST></OFX>';
const CSV_BR = 'Data;Descrição;Valor\n05/11/2026;Mercado Extra;-1.234,56\n06/11/2026;Pix recebido;250,00\n31/13/2026;Linha com data errada;-5,00\n';
const CSV_US = 'date,title,amount\n2026-11-07,"Uber, viagem",-23.50\n';

test('lerOFX: OFX 1.x (sem fechar tags) e 2.x (XML)', () => {
  const { lerOFX } = require('../../netlify/functions/prumo-lib/extrato');
  const a = lerOFX(OFX1);
  assert.equal(a.length, 3);
  assert.deepEqual({ ...a[0] }, { data: '2026-11-05', valor: -45.9, descricao: 'PADARIA DO ZE', id_banco: 'A1' });
  assert.equal(a[1].valor, 3000);
  assert.equal(a[2].descricao, 'CONTA DE LUZ', 'sem MEMO usa NAME');
  const b = lerOFX(OFX2);
  assert.equal(b.length, 1); assert.equal(b[0].valor, -10.5); assert.equal(b[0].data, '2026-11-08');
});

test('lerCSV: brasileiro com ; e americano com , e aspas', () => {
  const { lerCSV } = require('../../netlify/functions/prumo-lib/extrato');
  const a = lerCSV(CSV_BR);
  assert.equal(a[0].data, '2026-11-05'); assert.equal(a[0].descricao, 'Mercado Extra'); assert.equal(a[0].valor, -1234.56);
  assert.equal(a[1].valor, 250);
  const b = lerCSV(CSV_US);
  assert.equal(b.length, 1); assert.equal(b[0].descricao, 'Uber, viagem'); assert.equal(b[0].valor, -23.5); assert.equal(b[0].data, '2026-11-07');
});

test('extrato_ler: vira lançamentos prontos no formato do doc_ler; confirmar grava; ler de novo não duplica', async () => {
  preparar();
  const r = await p.agir('u1', { acao: 'extrato_ler', nome: 'extrato.ofx', conteudo: OFX1 });
  assert.equal(r[0], 200);
  assert.equal(r[1].documento, 'extrato');
  assert.equal(r[1].prontos.length, 3);
  assert.equal(r[1].prontos.find((x) => x.valor === 3000).tipo, 'receita');
  assert.equal(r[1].prontos.find((x) => x.valor === 45.9).tipo, 'despesa');
  assert.ok(Math.abs(r[1].despesas - 165.9) < 0.01);
  assert.ok(Math.abs(r[1].receitas - 3000) < 0.01);
  const g = await p.agir('u1', { acao: 'doc_confirmar', lancamentos: r[1].prontos });
  assert.equal(g[1].gravados, 3);
  const r2 = await p.agir('u1', { acao: 'extrato_ler', nome: 'extrato.ofx', conteudo: OFX1 });
  assert.equal(r2[1].prontos.length, 0);
  assert.equal(r2[1].ja_lancados, 3);
});

test('extrato_ler CSV: linha ruim vai para conferir; formato desconhecido e arquivo grande dão 400', async () => {
  preparar();
  const r = await p.agir('u1', { acao: 'extrato_ler', nome: 'nubank.csv', conteudo: CSV_BR });
  assert.equal(r[0], 200);
  assert.equal(r[1].prontos.length, 2);
  assert.equal(r[1].conferir.length, 1);
  assert.equal(typeof r[1].conferir[0].motivo, 'string');
  assert.equal((await p.agir('u1', { acao: 'extrato_ler', nome: 'x.txt', conteudo: 'qualquer coisa' }))[0], 400);
  assert.equal((await p.agir('u1', { acao: 'extrato_ler', nome: 'a.csv', conteudo: 'x'.repeat(2000001) }))[0], 400);
});

// ---------- Tela: roda prumo/documentos.js com elementos falsos ----------
function stubs() {
  const m = {};
  const s = (sel) => (m[sel] = m[sel] || { sel, innerHTML: '', files: [], disabled: false, textContent: '', onclick: null, dataset: {},
    querySelector: (x) => s(`${sel} ${x}`), querySelectorAll: () => [], insertAdjacentHTML(_, h) { this.innerHTML = h + this.innerHTML; } });
  return s;
}
test('tela Documentos: .ofx/.csv vão em extrato_ler com o texto do arquivo, sem passar pelo PDF', async () => {
  const s = stubs(); const chamadas = []; let usouPdf = false;
  const el = { innerHTML: '', querySelector: s, querySelectorAll: () => [] };
  const window = { MB: { telas: {} } }; const MB = window.MB;
  MB.ui = { brl: (v) => `R$ ${v}`, esc: (x) => String(x == null ? '' : x), reduzir: async () => 'img', ok() {}, aba() {} };
  MB.pdf = { paraImagens: async () => { usouPdf = true; return { imagens: ['img'], cortou: false }; } };
  MB.abrirAba = () => {};
  MB.api = async (acao, dados) => {
    chamadas.push({ acao, dados });
    if (acao === 'lanc_listar') return { receitas: 0, despesas: 0, lancamentos: [] };
    if (acao === 'extrato_ler') return { documento: 'extrato', imagens_lidas: 1, imagens_total: 1, prontos: [{ data: '2026-11-05', descricao: 'PADARIA DO ZE', valor: 45.9, tipo: 'despesa' }], conferir: [], ja_lancados: 0, receitas: 0, despesas: 45.9 };
    return {};
  };
  const ctx = { window, document: { createElement: () => ({}), body: { appendChild() {} } }, console, setTimeout, clearTimeout, Promise, confirm: () => true };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../prumo/documentos.js'), 'utf8'), ctx);
  await MB.telas.documentos(el);
  assert.match(el.innerHTML, /accept="[^"]*\.ofx/, 'input aceita .ofx');
  assert.match(el.innerHTML, /accept="[^"]*\.csv/, 'input aceita .csv');
  s('#kf-arq').files = [{ name: 'extrato.ofx', type: '', text: async () => OFX1 }];
  const btn = s('#kf-ler');
  await btn.onclick({ currentTarget: btn });
  const e = chamadas.find((c) => c.acao === 'extrato_ler');
  assert.ok(e, 'chamou extrato_ler');
  assert.equal(e.dados.nome, 'extrato.ofx');
  assert.equal(e.dados.conteudo, OFX1);
  assert.equal(usouPdf, false, 'OFX não passa pelo leitor de PDF/imagem');
  assert.ok(!chamadas.some((c) => c.acao === 'doc_ler'), 'não chama doc_ler para OFX');
  assert.match(s('#kf-res').innerHTML, /PADARIA DO ZE/, 'mostra o que leu para confirmar');
});
