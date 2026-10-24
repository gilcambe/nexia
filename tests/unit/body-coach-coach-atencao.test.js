'use strict';
// Body Coach B13: painel do coach "quem precisa de atenção hoje" com mensagem pronta em 1 toque.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ts = require('typescript');
const SRC = path.join(__dirname, '..', '..', 'apps', 'body-coach', 'src');
const ler = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');

async function carregar(f) {
  const out = ts.transpileModule(ler(f), { compilerOptions: { module: ts.ModuleKind.ES2022, target: 'ES2022' } }).outputText;
  const arq = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'b13-')), 'm.mjs');
  fs.writeFileSync(arq, out);
  return import(arq);
}

const aluno = (nome, dias, extra = {}) => ({ uid: nome.toLowerCase().replace(/\s/g, ''), nome, treinouHoje: dias === 0, diasSemTreinar: dias, ...extra });

test('B13: só entra quem está 3+ dias sem treinar ou nunca treinou; mais tempo sumido primeiro', async () => {
  const { quemPrecisaDeAtencao, precisaAtencao } = await carregar('lib/coach/atencao.ts');
  const lista = [aluno('Ana', 0), aluno('Bia', 2), aluno('Caio', 3), aluno('Duda', 10), aluno('Edu', null)];
  assert.deepEqual(quemPrecisaDeAtencao(lista).map((a) => a.nome), ['Duda', 'Caio', 'Edu']);
  assert.equal(precisaAtencao(aluno('Bia', 2)), false);
  assert.equal(quemPrecisaDeAtencao([]).length, 0);
});

test('B13: mensagem pronta usa o primeiro nome e muda conforme o tempo sumido', async () => {
  const { mensagemPronta, linkMensagem } = await carregar('lib/coach/atencao.ts');
  assert.match(mensagemPronta(aluno('Caio Souza', 3)), /^Oi, Caio!.*3 dias/);
  assert.match(mensagemPronta(aluno('Duda', 9)), /9 dias.*treino mais curto/);
  assert.match(mensagemPronta(aluno('Edu', null)), /ainda não registrou nenhum treino/);
  assert.match(mensagemPronta({ uid: 'x', nome: '', treinouHoje: false, diasSemTreinar: 4 }), /^Oi! /);
  const link = linkMensagem({ uid: 'u 1', nome: 'Ana', treinouHoje: false, diasSemTreinar: 5 });
  assert.match(link, /^\/chat\?com=u%201&texto=/);
  assert.equal(new URLSearchParams(link.split('?')[1]).get('texto'), mensagemPronta({ uid: 'u 1', nome: 'Ana', treinouHoje: false, diasSemTreinar: 5 }));
});

test('B13: painel mostra o bloco e a conversa abre com o texto escrito (sem enviar sozinha)', () => {
  const painel = ler('pages/coach/MeusAlunos.tsx');
  assert.match(painel, /Quem precisa de atenção hoje/);
  assert.match(painel, /to=\{alerta \? linkMensagem\(a\) :/);
  const chat = ler('pages/chat/page.tsx');
  assert.match(chat, /params\.get\('texto'\)/);
  assert.match(chat, /setTexto\(\(t\) => t \|\| textoParam\.slice\(0, 1500\)\)/);
  // nada é enviado sem o toque do coach
  assert.doesNotMatch(chat, /textoParam[^\n]*acao: 'enviar'/);
});
