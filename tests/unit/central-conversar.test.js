'use strict';
// C2-F2 (PC 2, 13/11): tela Conversar (chat com o Cortex + prévia ao lado + anexos).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');

const PASTA = path.join(__dirname, '../../src/pages/central/kernex');
async function regras() {
  const out = ts.transpileModule(fs.readFileSync(path.join(PASTA, 'conversaRegras.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kx-conv-'));
  fs.writeFileSync(path.join(dir, 'r.mjs'), out);
  return import(pathToFileURL(path.join(dir, 'r.mjs')).href);
}

test('CV1. pedido falado vira ficha completa (nome, ramo, cidade, WhatsApp com 55)', async () => {
  const { lerFicha, falta, intencao } = await regras();
  const t = 'Crie um site para a barbearia do João em Recife, WhatsApp 81 99999-8888';
  assert.equal(intencao(t), 'criar');
  const f = lerFicha(t);
  assert.equal(f.ramo, 'barbearia');
  assert.equal(f.cidade, 'Recife');
  assert.equal(f.whatsapp, '5581999998888');
  assert.match(f.nome, /barbearia do João/i);
  assert.deepEqual(falta(f), []);
});

test('CV2. o que falta vira UMA pergunta; a resposta completa a ficha sem apagar o que já tinha', async () => {
  const { lerFicha, falta, pergunta } = await regras();
  const f1 = lerFicha('quero um site para minha clínica');
  assert.equal(f1.ramo, 'clínica');
  assert.deepEqual(falta(f1), ['nome', 'cidade', 'whatsapp']);
  assert.match(pergunta(f1), /nome do negócio.*cidade.*WhatsApp/s);
  const f2 = lerFicha('chamada Clínica Sorriso, em Olinda, (81) 98888-7777 https://fotos.com/a.jpg', f1);
  assert.equal(f2.nome, 'Clínica Sorriso');
  assert.equal(f2.cidade, 'Olinda');
  assert.equal(f2.ramo, 'clínica');
  assert.deepEqual(f2.fotos, ['https://fotos.com/a.jpg']);
  assert.deepEqual(falta(f2), []);
});

test('CV3. com prévia na tela, "gostei" publica e "mude" vira pedido no projeto certo', async () => {
  const { intencao, pedidoDeMudanca } = await regras();
  assert.equal(intencao('gostei, pode publicar', true), 'publicar');
  assert.equal(intencao('gostei', false), 'conversa', 'sem prévia não publica nada');
  assert.equal(intencao('mude o botão de agendar para verde'), 'mudar');
  const p = pedidoDeMudanca('Avaya GSD', 'mude o botão X', 'https://x.kernex-previas.pages.dev/');
  assert.match(p, /^\[Projeto: Avaya GSD\] mude o botão X/);
  assert.match(p, /Prévia que o dono estava vendo: https:\/\/x\.kernex-previas\.pages\.dev\//);
});

test('CV4. a moldura só abre prévia de endereço conhecido; ficha sai no formato da Fábrica', async () => {
  const { previaNaMoldura, fichaParaFabrica } = await regras();
  assert.ok(previaNaMoldura('https://joao.kernex-previas.pages.dev/'));
  assert.ok(previaNaMoldura('https://studiolima.kernex.com.br/'));
  assert.ok(!previaNaMoldura('http://joao.pages.dev/'));
  assert.ok(!previaNaMoldura('https://evil.com/?x=pages.dev'));
  const f = fichaParaFabrica({ nome: ' Bar ', ramo: 'restaurante', cidade: 'Recife', whatsapp: '+55 (81) 99999-0000', fotos: ['https://a/b.jpg'] });
  assert.deepEqual(f, { nome: 'Bar', ramo: 'restaurante', cidade: 'Recife', whatsapp: '5581999990000', precisa: ['site', 'whatsapp'], fotos: 'https://a/b.jpg' });
});

test('CV5. "Conversar" está no menu, na Casca, e reaproveita o anexo do #3693', () => {
  const regrasTs = fs.readFileSync(path.join(PASTA, 'regras.ts'), 'utf8');
  assert.match(regrasTs, /id: "conversar"/);
  const casca = fs.readFileSync(path.join(PASTA, 'Casca.tsx'), 'utf8');
  assert.match(casca, /tela === "conversar" \? <Conversar \/>/);
  const tela = fs.readFileSync(path.join(PASTA, 'Conversar.tsx'), 'utf8');
  assert.match(tela, /from "\.\/anexo"/);
  assert.match(tela, /acao: "anexar"/);
  assert.match(tela, /acao: "fabrica-criar"/);
  assert.match(tela, /window\.confirm\(/, 'publicar pede confirmação');
  assert.match(tela, /<iframe[^>]+sandbox=/, 'prévia em moldura isolada');
});
