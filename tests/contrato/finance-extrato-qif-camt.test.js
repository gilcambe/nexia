'use strict';
// Contrato (dono 20/11, plano "alternativas grátis sem Pluggy"): importar extrato também em QIF e CAMT.053 (XML ISO 20022),
// no mesmo fluxo do OFX/CSV ('extrato_ler' em netlify/functions/prumo-lib/extrato.js).
//  - lerQIF(texto): blocos separados por linha "^"; D = data (DD/MM/AAAA, DD/MM/AA, MM/DD'AA ou AAAA-MM-DD), T ou U = valor
//    com sinal ("-1.234,56", "1234.56", "1,234.56"), P = descrição (ou M se não houver P). Cabeçalho "!Type:..." ignorado.
//    Devolve [{ data: 'AAAA-MM-DD', valor: número com sinal, descricao }].
//  - lerCAMT(texto): cada <Ntry>: valor de <Amt>, sinal por <CdtDbtInd> (CRDT = +, DBIT = -), data de <BookgDt><Dt>
//    (ou <ValDt><Dt>), descrição de <Ustrd> (ou <AddtlNtryInf>), id de <AcctSvcrRef> (ou <NtryRef>) em id_banco.
//  - extrato_ler: nome .qif -> QIF; nome .xml ou conteúdo com "camt.053" / "<BkToCstmrStmt>" -> CAMT. Resto igual ao OFX/CSV
//    (prontos, ja_lancados, sem duplicar). Mensagem de formato errado passa a citar OFX, CSV, QIF ou CAMT.
//  - module.exports inclui lerQIF e lerCAMT (além de lerOFX, lerCSV, agirExtrato).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../netlify/functions/prumo-lib/extrato');
const P = require('../../netlify/functions/prumo.js');
function banco() { const d = new Map(); const col = (c) => ({ doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { d.set(`${c}/${id}`, v); }, get: async () => { const v = d.get(`${c}/${id}`); return { exists: !!v, data: () => v }; }, delete: async () => { d.delete(`${c}/${id}`); } }), get: async () => ({ docs: [...d.entries()].filter(([k]) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }), where() { return this; }, orderBy() { return this; }, limit() { return this; } }); return { collection: col }; }

const QIF = '!Type:Bank\nD10/11/2026\nT-1.234,56\nPALUGUEL\n^\nD2026-11-12\nT3000.00\nPSALARIO\n^\nD11/13\'26\nU-45.90\nMPADARIA\n^\n';
const CAMT = `<?xml version="1.0"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02"><BkToCstmrStmt><Stmt>
<Ntry><NtryRef>R1</NtryRef><Amt Ccy="BRL">120.50</Amt><CdtDbtInd>DBIT</CdtDbtInd><BookgDt><Dt>2026-11-14</Dt></BookgDt><AcctSvcrRef>A1</AcctSvcrRef><NtryDtls><TxDtls><RmtInf><Ustrd>MERCADO BOM</Ustrd></RmtInf></TxDtls></NtryDtls></Ntry>
<Ntry><Amt Ccy="BRL">500.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><ValDt><Dt>2026-11-15</Dt></ValDt><NtryRef>R2</NtryRef><AddtlNtryInf>PIX RECEBIDO</AddtlNtryInf></Ntry>
</Stmt></BkToCstmrStmt></Document>`;

test('lerQIF: datas, sinais e descrições', () => {
  assert.deepEqual(E.lerQIF(QIF), [
    { data: '2026-11-10', valor: -1234.56, descricao: 'ALUGUEL' },
    { data: '2026-11-12', valor: 3000, descricao: 'SALARIO' },
    { data: '2026-11-13', valor: -45.9, descricao: 'PADARIA' },
  ]);
});

test('lerCAMT: valor, sinal, data, descrição e id', () => {
  assert.deepEqual(E.lerCAMT(CAMT), [
    { data: '2026-11-14', valor: -120.5, descricao: 'MERCADO BOM', id_banco: 'A1' },
    { data: '2026-11-15', valor: 500, descricao: 'PIX RECEBIDO', id_banco: 'R2' },
  ]);
});

test('extrato_ler aceita .qif e .xml (CAMT) sem duplicar', async () => {
  const b = banco(); P.deps.db = () => b; P.deps.agora = () => new Date('2026-11-20T12:00:00Z');
  const A = (x) => P.agir('u', x);
  const [s1, q] = await A({ acao: 'extrato_ler', nome: 'itau.qif', conteudo: QIF });
  assert.equal(s1, 200);
  assert.equal(q.prontos.length, 3);
  assert.equal(q.despesas, 1280.46);
  await A({ acao: 'doc_confirmar', lancamentos: q.prontos });
  const [, q2] = await A({ acao: 'extrato_ler', nome: 'itau.qif', conteudo: QIF });
  assert.equal(q2.ja_lancados, 3);
  const [s2, c] = await A({ acao: 'extrato_ler', nome: 'extrato.xml', conteudo: CAMT });
  assert.equal(s2, 200);
  assert.equal(c.receitas, 500);
  const [s3, x] = await A({ acao: 'extrato_ler', nome: 'foto.txt', conteudo: 'nada' });
  assert.equal(s3, 400);
  assert.match(x.error, /QIF/);
});
