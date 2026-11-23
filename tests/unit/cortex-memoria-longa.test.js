const test = require('node:test');
const assert = require('node:assert');
const { criarMemoria } = require('../../nexia-ai/memoria-longa/index');

function criarStorageFalso() {
  const map = new Map();
  return {
    async get(id) {
      return map.get(id) || null;
    },
    async set(id, obj) {
      map.set(id, JSON.parse(JSON.stringify(obj)));
    },
    async del(id) {
      map.delete(id);
    },
    async list() {
      return Array.from(map.values());
    }
  };
}

test('gravar, listar, editar e apagar memória', async () => {
  const storage = criarStorageFalso();
  const mem = criarMemoria({ armazenar: storage });

  const escopo = 'usuario:123';
  const res = await mem.gravar({
    escopo,
    categoria: 'preferencia',
    texto: 'Gosta de respostas curtas em português.'
  });

  assert.strictEqual(res.ok, true);
  assert.ok(res.id);

  const lista = await mem.listar(escopo);
  assert.strictEqual(lista.length, 1);
  assert.strictEqual(lista[0].texto, 'Gosta de respostas curtas em português.');
  assert.strictEqual(lista[0].categoria, 'preferencia');

  // Editar
  const resEd = await mem.editar(res.id, 'Gosta de respostas bem curtas.');
  assert.strictEqual(resEd.ok, true);

  const listaAposEd = await mem.listar(escopo);
  assert.strictEqual(listaAposEd[0].texto, 'Gosta de respostas bem curtas.');

  // Apagar
  const resDel = await mem.apagar(res.id);
  assert.strictEqual(resDel.ok, true);

  const listaAposDel = await mem.listar(escopo);
  assert.strictEqual(listaAposDel.length, 0);
});

test('recusa dados sensíveis: CPF, cartão e senha/token', async () => {
  const storage = criarStorageFalso();
  const mem = criarMemoria({ armazenar: storage });
  const escopo = 'usuario:456';

  const r1 = await mem.gravar({ escopo, texto: 'Meu CPF é 123.456.789-09' });
  assert.strictEqual(r1.ok, false);

  const r2 = await mem.gravar({ escopo, texto: 'Cartão 4532 1234 5678 9010' });
  assert.strictEqual(r2.ok, false);

  const r3 = await mem.gravar({ escopo, texto: 'Minha senha secreta é minhaSenha123' });
  assert.strictEqual(r3.ok, false);

  const r4 = await mem.gravar({ escopo, texto: 'token: abc123xyz' });
  assert.strictEqual(r4.ok, false);

  const lista = await mem.listar(escopo);
  assert.strictEqual(lista.length, 0);
});

test('isolamento de escopo: A nunca vê ou busca itens do B', async () => {
  const storage = criarStorageFalso();
  const mem = criarMemoria({ armazenar: storage });

  await mem.gravar({ escopo: 'projeto:A', texto: 'Projeto A usa Node.js' });
  await mem.gravar({ escopo: 'projeto:B', texto: 'Projeto B usa Python e Node.js' });

  const listaA = await mem.listar('projeto:A');
  const listaB = await mem.listar('projeto:B');

  assert.strictEqual(listaA.length, 1);
  assert.strictEqual(listaA[0].texto, 'Projeto A usa Node.js');

  assert.strictEqual(listaB.length, 1);
  assert.strictEqual(listaB[0].texto, 'Projeto B usa Python e Node.js');

  // Busca isolada
  const buscaA = await mem.buscar('projeto:A', 'Node.js');
  assert.strictEqual(buscaA.length, 1);
  assert.strictEqual(buscaA[0].escopo, 'projeto:A');

  const buscaB = await mem.buscar('projeto:B', 'Python');
  assert.strictEqual(buscaB.length, 1);
  assert.strictEqual(buscaB[0].escopo, 'projeto:B');
});

test('pausar recusa gravar e retomar volta a aceitar', async () => {
  const storage = criarStorageFalso();
  const mem = criarMemoria({ armazenar: storage });
  const escopo = 'usuario:789';

  mem.pausar(escopo);

  const r1 = await mem.gravar({ escopo, texto: 'Tentando gravar com memória pausada' });
  assert.strictEqual(r1.ok, false);
  assert.strictEqual(r1.motivo, 'Memória pausada para este escopo');

  mem.retomar(escopo);

  const r2 = await mem.gravar({ escopo, texto: 'Gravando após retomar' });
  assert.strictEqual(r2.ok, true);

  const lista = await mem.listar(escopo);
  assert.strictEqual(lista.length, 1);
  assert.strictEqual(lista[0].texto, 'Gravando após retomar');
});

test('exportar e importar em outro escopo reproduz os itens permitidos', async () => {
  const storage = criarStorageFalso();
  const mem = criarMemoria({ armazenar: storage });

  const escopoOrigem = 'usuario:origem';
  const escopoDestino = 'usuario:destino';

  await mem.gravar({ escopo: escopoOrigem, texto: 'Gosta de café' });
  await mem.gravar({ escopo: escopoOrigem, texto: 'Trabalha de noite' });
  // Tentativa de item sensível simulada diretamente ou via JSON malicioso se fosse o caso
  // Vamos exportar
  const jsonExportado = await mem.exportar(escopoOrigem);

  const resultadoImportacao = await mem.importar(escopoDestino, jsonExportado);
  assert.strictEqual(resultadoImportacao.ok, true);
  assert.strictEqual(resultadoImportacao.entrados, 2);
  assert.strictEqual(resultadoImportacao.recusados, 0);

  const listaDestino = await mem.listar(escopoDestino);
  assert.strictEqual(listaDestino.length, 2);
  assert.strictEqual(listaDestino[0].escopo, escopoDestino);
  assert.strictEqual(listaDestino[1].escopo, escopoDestino);
});
