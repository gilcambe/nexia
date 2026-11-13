const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

// caminho relativo ao diretório deste teste
const crudPath = path.join(__dirname, '../../modelos-projeto/crud/crud.js');
const crud = require(crudPath);

// extrair variáveis internas do arquivo (campos e nome) via regex
const fileContent = fs.readFileSync(crudPath, 'utf8');
const camposMatch = fileContent.match(/const\s+campos\s*=\s*['"]([^'\"]+)['"]/);
const nomeMatch = fileContent.match(/const\s+nome\s*=\s*['"]([^'\"]+)['"]/);

const campos = camposMatch ? camposMatch[1].split(',').map(s => s.trim()) : [];
const nome = nomeMatch ? nomeMatch[1] : 'default';

// helper para criar um objeto completo baseado nos campos obrigatórios
function criarObjetoCompleto() {
  const obj = {};
  campos.forEach(f => {
    obj[f] = `valor_${f}`;
  });
  // garantir que exista um identificador (id) para as operações de edição/remoção
  if (!('id' in obj)) obj.id = 1;
  return obj;
}

// stub simples de localStorage para ambiente Node
global.localStorage = {
  _store: {},
  getItem(key) { return this._store[key] ?? null; },
  setItem(key, value) { this._store[key] = value; },
  removeItem(key) { delete this._store[key]; },
  clear() { this._store = {}; }
};

// antes de cada teste limpa o stub e o fetch mock
test.beforeEach(() => {
  global.localStorage.clear();
  // remover mock de fetch caso exista
  delete global.fetch;
});

test('validarRegistro - caso comum (objeto completo) retorna true', async t => {
  const completo = criarObjetoCompleto();
  const resultado = crud.validarRegistro(completo);
  assert.strictEqual(resultado, true, 'Deve retornar true quando todos os campos obrigatórios estão presentes e não vazios');
});

test('validarRegistro - borda (campo ausente) retorna false', async t => {
  const incompleto = criarObjetoCompleto();
  // remover o primeiro campo obrigatório
  delete incompleto[campos[0]];
  const resultado = crud.validarRegistro(incompleto);
  assert.strictEqual(resultado, false, 'Deve retornar false quando algum campo obrigatório está ausente');
});

test('validarRegistro - entrada inválida (null) retorna false', async t => {
  const resultado = crud.validarRegistro(null);
  assert.strictEqual(resultado, false, 'Deve retornar false para valores que não são objetos');
});

test('CRUD fallback para localStorage quando fetch falha', async t => {
  // Mock fetch para sempre rejeitar (simulando falha de rede)
  global.fetch = () => Promise.reject(new Error('falha de rede'));

  // Garantir que o módulo exporta as funções esperadas; se não existir, o teste falhará explicitamente
  const { criar, listar, editar, remover } = crud;
  assert.ok(typeof criar === 'function', 'Função criar deve estar exportada');
  assert.ok(typeof listar === 'function', 'Função listar deve estar exportada');
  assert.ok(typeof editar === 'function', 'Função editar deve estar exportada');
  assert.ok(typeof remover === 'function', 'Função remover deve estar exportada');

  const registro = criarObjetoCompleto();

  // ---- CREATE ----
  await criar(registro);
  const chave = `${nome}_dados`;
  const armazenadoDepoisCreate = JSON.parse(global.localStorage.getItem(chave));
  assert.deepStrictEqual(armazenadoDepoisCreate, [registro], 'Após criar, o registro deve ser salvo em localStorage');

  // ---- LIST ----
  const lista = await listar();
  assert.deepStrictEqual(lista, [registro], 'Listar deve retornar os dados armazenados em localStorage');

  // ---- EDIT ----
  const registroEditado = { ...registro, [campos[0]]: 'valor_modificado' };
  await editar(registroEditado);
  const armazenadoDepoisEdit = JSON.parse(global.localStorage.getItem(chave));
  assert.deepStrictEqual(armazenadoDepoisEdit, [registroEditado], 'Editar deve atualizar o registro em localStorage');

  // ---- REMOVE ----
  await remover(registroEditado.id);
  const armazenadoDepoisRemove = JSON.parse(global.localStorage.getItem(chave));
  assert.deepStrictEqual(armazenadoDepoisRemove, [], 'Remover deve excluir o registro de localStorage');
});
