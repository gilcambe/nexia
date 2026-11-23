'use strict';
// 22/11 (dono): "dê um jeito de duplicar ou criar um novo livro". O caderno geral tem limite; livros por assunto em
// memoria/livros/<assunto>.md entram só quando o contrato cita o assunto.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const memoria = require('../../nexia-ai/contrato/memoria');
const { lerContrato } = require('../../nexia-ai/contrato/executor');
const contrato = (pedido, arq) => lerContrato(`${pedido}\nArquivos: \`${arq}\`\nTeste: \`node --test tests/a.test.js\``);

test('livro novo é só um arquivo: entra quando o assunto bate, fica fora quando não', () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'livros-'));
  fs.mkdirSync(path.join(pasta, 'livros'));
  fs.writeFileSync(path.join(pasta, 'livros', 'taking.md'), 'Quando: taking, candidato, vaga\n1. Candidato sem e-mail não é descartado.\n');
  assert.deepStrictEqual(memoria.livros(contrato('Buscar candidatos para a vaga', 'src/x.js'), { pasta }).map(l => l.nome), ['taking']);
  assert.match(memoria.livros(contrato('Busca de CANDIDATO', 'src/x.js'), { pasta })[0].texto, /sem e-mail/);
  assert.doesNotMatch(memoria.livros(contrato('Busca', 'src/x.js'), { pasta })[0]?.texto || '', /Quando:/);
  assert.deepStrictEqual(memoria.livros(contrato('Ajustar o chat do condomínio', 'src/chat.js'), { pasta }), []);
});

test('livro do Finance do repositório entra em tarefa do prumo e cada livro cabe no limite', () => {
  const l = memoria.livros(contrato('Corrigir a tela de salário', 'prumo/orcamento.js'));
  assert.deepStrictEqual(l.map(x => x.nome), ['finance']);
  assert.match(l[0].texto, /window\.MB/);
  for (const x of memoria.lerLivros()) assert.ok(x.texto.length <= memoria.LICOES_MAX, `${x.nome} passou do limite`);
  assert.ok(!memoria.licoes().includes('window.MB = {...}'), 'lição do Finance saiu do caderno geral');
});
