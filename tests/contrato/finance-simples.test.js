'use strict';
// Contrato (dono 19/11: "simplifique ao máximo... muitas abas e locais pra preencher"):
// 1) Início tem UM botão "Mandar documento" (#kf-mandar): a ação doc_tipo diz o tipo e a aba; a aba certa abre e já lê.
// 2) Menu curto: Visão geral, Salário, Contas, Cartões e Assistente aparecem; o resto fica em "Mais telas" (nada some).
// 3) CNIS e simulação do INSS: nascimento e tempo de contribuição entram sem digitar.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.join(__dirname, '../..');
const ler = (f) => fs.readFileSync(path.join(raiz, f), 'utf8');
const P = require('../../netlify/functions/prumo.js');
function banco() { const d = new Map(); const col = (c) => ({ doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { d.set(`${c}/${id}`, v); }, get: async () => { const v = d.get(`${c}/${id}`); return { exists: !!v, data: () => v }; }, delete: async () => d.delete(`${c}/${id}`) }), get: async () => ({ docs: [...d.entries()].filter(([k]) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }), where() { return this; }, orderBy() { return this; }, limit() { return this; } }); return { collection: col }; }
const IMG = 'data:image/jpeg;base64,' + Buffer.alloc(400, 7).toString('base64');

test('doc_tipo: cada tipo vai para a aba que lê', async () => {
  P.deps.db = () => banco(); P.deps.agora = () => new Date('2026-11-19T12:00:00Z');
  const casos = { holerite: 'orcamento', ponto: 'orcamento', fatura_cartao: 'cartoes', extrato_banco: 'documentos', fgts: 'aposentadoria', inss: 'aposentadoria', score: 'patrimonio' };
  for (const [tipo, aba] of Object.entries(casos)) {
    P.deps.perguntarVisao = async () => JSON.stringify({ tipo });
    const r = await P.agir('u', { acao: 'doc_tipo', imagens: [IMG] });
    assert.equal(r[0], 200); assert.equal(r[1].tipo, tipo); assert.equal(r[1].aba, aba);
  }
  P.deps.perguntarVisao = async () => { throw new Error('sem IA'); };
  const r = await P.agir('u', { acao: 'doc_tipo', imagens: [IMG] });
  assert.equal(r[1].aba, 'documentos', 'sem IA: vai para Documentos, que lê qualquer coisa');
  delete P.deps.perguntarVisao;
});

test('menu curto: essenciais visíveis, resto em "Mais telas", nenhuma aba some', () => {
  const h = ler('prumo/index.html');
  assert.match(h, /id="ver-mais"/);
  for (const g of ['orcamento', 'fluxo', 'dividas', 'patrimonio', 'economia', 'config']) assert.match(h, new RegExp(`data-grupo="${g}" data-mais`), g + ' em Mais telas');
  for (const g of ['visao', 'salario', 'contas', 'cartoes', 'assistente']) assert.doesNotMatch(h, new RegExp(`data-grupo="${g}" data-mais`), g + ' visível');
});

test('CNIS traz nascimento; simulação do INSS traz o tempo até 2019', async () => {
  P.deps.db = () => banco(); P.deps.agora = () => new Date('2026-11-19T12:00:00Z');
  P.deps.perguntarVisao = async () => JSON.stringify({ nascimento: '1985-12-17', vinculos: [], contribuicoes: [], simulacao: { tc_2019_meses: 165, tc_total_meses: 0 } });
  const r = await P.agir('u', { acao: 'apos_cnis_ler', imagens: [IMG] });
  assert.equal(r[1].resumo.nascimento, '1985-12-17'); assert.equal(r[1].resumo.tc_2019_meses, 165); assert.equal(r[1].resumo.simulacao, true);
  delete P.deps.perguntarVisao;
  assert.match(ler('prumo/aposentadoria.js'), /base\.tc_total_meses = base\.tc_2019_meses/);
});
