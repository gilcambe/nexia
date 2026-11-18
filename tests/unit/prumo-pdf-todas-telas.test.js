'use strict';
// 18/11 (dono): "em nenhum campo que quero colocar o PDF funciona (extrato etc.)". Regra: toda leitura aceita o PDF
// inteiro (o servidor lê); o app não renderiza PDF no celular; o Compartilhar leva o arquivo à tela escolhida.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const p = require('../../netlify/functions/prumo.js');
const ler = (f) => fs.readFileSync(path.join(__dirname, '../..', f), 'utf8');
const PDF = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4 ' + 'x'.repeat(300)).toString('base64');

function banco() {
  const dados = new Map();
  const col = (c) => ({ path: c, doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { dados.set(`${c}/${id}`, v); }, delete: async () => { dados.delete(`${c}/${id}`); }, get: async () => { const v = dados.get(`${c}/${id}`); return { exists: !!v, data: () => v }; } }),
    get: async () => ({ docs: [...dados.entries()].filter(([k]) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }), where: () => col(c), orderBy: () => col(c), limit: () => col(c) });
  return { collection: col };
}

test('todas as leituras aceitam o PDF inteiro e mandam ao leitor com mime application/pdf', async () => {
  const b = banco(); p.deps.db = () => b; p.deps.agora = () => new Date('2026-11-18T12:00:00Z');
  const vistos = [];
  p.deps.perguntarVisao = async (img, sistema) => { vistos.push(img.mime); return /documentos financeiros/i.test(sistema) ? '{"lancamentos":[{"data":"2026-11-10","descricao":"Mercado","valor":-50,"categoria":"mercado"}]}' : '{}'; };
  for (const acao of ['conta_print_ler', 'cartao_print_ler', 'divida_print_ler', 'score_print_ler', 'pontos_print_ler', 'apos_cnis_ler', 'salario_ler', 'doc_ler']) {
    const r = await p.agir('u', { acao, tipo: 'holerite', imagens: [PDF] });
    assert.notEqual(r[0], 400, `${acao}: ${JSON.stringify(r[1])}`);
  }
  delete p.deps.perguntarVisao;
  assert.ok(vistos.length >= 8 && vistos.every((m) => m === 'application/pdf'), JSON.stringify(vistos));
});

test('o app manda PDF inteiro (não renderiza no celular) e o Compartilhar oferece as telas', () => {
  const pdf = ler('prumo/pdf.js');
  assert.match(pdf, /ehPdf\(a\) \? await pdfCru\(a\) : await reduzir\(a\)/);
  const app = ler('prumo/app.js');
  for (const id of ['documento', 'conta', 'cartao', 'divida', 'score', 'milhas', 'cnis', 'holerite', 'ponto']) assert.ok(app.includes(`['${id}', `), id);
  for (const sel of ['#kf-arq', '#ct-ler-arq', '#ca-ler-arq', '#dv-ler-arq', '#score-arq', '#pp-arq', '#apo-arq']) assert.ok(app.includes(`'${sel}'`), sel);
  assert.match(app, /new DataTransfer\(\)/);
});
