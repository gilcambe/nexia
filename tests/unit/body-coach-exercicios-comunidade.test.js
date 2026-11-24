// Exercícios da comunidade: salva para todos, não duplica, só quem criou (ou o admin) edita e apaga.
const test = require('node:test');
const assert = require('node:assert');
const { aplicarSalvar, aplicarApagar, exercicios } = require('../../netlify/functions/body-coach/exercicios');

test('salvar cria com autor, grupo válido e texto limpo', () => {
  const r = aplicarSalvar([], { nome: '  Remada   cavalinho ', grupo: 'costas', como: 'Peito no apoio' }, 'u1', 'Ana', false, 1000);
  assert.equal(r.erro, undefined);
  assert.equal(r.lista.length, 1);
  assert.equal(r.item.nome, 'Remada cavalinho');
  assert.equal(r.item.autor, 'u1');
  assert.equal(r.item.autorNome, 'Ana');
  assert.equal(aplicarSalvar([], { nome: 'Coice', grupo: 'xpto' }, 'u1', '').item.grupo, 'outro');
  assert.match(aplicarSalvar([], { nome: 'a' }, 'u1', '').erro, /nome/);
});

test('mesmo nome (sem acento/maiúscula) não duplica', () => {
  const { lista } = aplicarSalvar([], { nome: 'Elevação lateral sentado' }, 'u1', '');
  const r = aplicarSalvar(lista, { nome: 'elevacao LATERAL sentado' }, 'u2', '');
  assert.equal(r.lista.length, 1);
  assert.equal(r.item.autor, 'u1');
});

test('editar: só o autor ou o admin', () => {
  const { lista, item } = aplicarSalvar([], { nome: 'Coice na polia' }, 'u1', '');
  assert.match(aplicarSalvar(lista, { id: item.id, nome: 'Coice' }, 'u2', '').erro, /Só quem criou/);
  const r = aplicarSalvar(lista, { id: item.id, nome: 'Coice unilateral', grupo: 'triceps' }, 'u1', '');
  assert.equal(r.lista[0].nome, 'Coice unilateral');
  assert.equal(r.lista[0].grupo, 'triceps');
  assert.equal(aplicarSalvar(lista, { id: item.id, nome: 'Outro' }, 'adm', '', true).lista[0].nome, 'Outro');
});

test('apagar: só o autor ou o admin; id que não existe não quebra', () => {
  const { lista, item } = aplicarSalvar([], { nome: 'Prancha lateral' }, 'u1', '');
  assert.match(aplicarApagar(lista, item.id, 'u2').erro, /Só quem criou/);
  assert.equal(aplicarApagar(lista, item.id, 'u1').lista.length, 0);
  assert.equal(aplicarApagar(lista, item.id, 'adm', true).lista.length, 0);
  assert.equal(aplicarApagar(lista, 'nao-existe', 'u1').lista.length, 1);
});

test('ação pela API: grava no documento único e ignora ações de outros módulos', async () => {
  let doc = {};
  const db = { collection: () => ({ doc: () => ({ get: async () => ({ data: () => doc }), set: async (d) => { doc = d; } }) }) };
  assert.equal(await exercicios({ acao: 'perfil' }, 'u1', db, {}), null);
  const [st, r] = await exercicios({ acao: 'exercicios_salvar', nome: 'Pullover na polia' }, 'u1', db, { nome: 'Ana' });
  assert.equal(st, 200);
  assert.equal(doc.lista.length, 1);
  const [st2, r2] = await exercicios({ acao: 'exercicios_apagar', id: r.item.id }, 'u2', db, {});
  assert.equal(st2, 400);
  assert.match(r2.error, /Só quem criou/);
  const [, r3] = await exercicios({ acao: 'exercicios_listar' }, 'u2', db, {});
  assert.equal(r3.lista.length, 1);
});
