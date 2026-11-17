// tests/unit/prumo-pontos-ler.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

// Importa a função que será testada
const { lerPontos } = require('../../netlify/functions/prumo-lib/pontos-ler.js');
// Importa o registro de endpoints (para garantir que o handler está exposto)
const extra = require('../../netlify/functions/prumo-lib/extra.js');

// Mock de um arquivo temporário com conteúdo fictício (não será realmente processado, a função deve reconhecer o mock)
function criarMockArquivo(conteudo) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pontos-ler-'));
  const arquivo = path.join(dir, 'mock.txt');
  fs.writeFileSync(arquivo, conteudo, 'utf8');
  return arquivo;
}

// Caso comum: arquivo com dados válidos
test('lerPontos - caso comum retorna estrutura correta', async t => {
  const caminho = criarMockArquivo('PROGRAMAS\nSaldo: 1000\nVencimento: 2025-01-01');
  const resultado = await lerPontos(caminho);
  assert.deepStrictEqual(resultado, {
    programas: ['PROGRAMAS'],
    saldo: 1000,
    vencimento: '2025-01-01'
  });
});

// Caso de borda: arquivo vazio deve retornar estrutura vazia
test('lerPontos - arquivo vazio retorna objeto vazio', async t => {
  const caminho = criarMockArquivo('');
  const resultado = await lerPontos(caminho);
  assert.deepStrictEqual(resultado, { programas: [], saldo: 0, vencimento: null });
});

// Entrada inválida: caminho inexistente deve lançar erro
test('lerPontos - caminho inexistente lança erro', async t => {
  await assert.rejects(async () => {
    await lerPontos('caminho/inexistente.txt');
  }, /ENOENT/);
});

// Verifica registro no extra.js
test('extra.js - exporta handler lerPontos corretamente', t => {
  assert.ok(typeof extra.handlers?.['/api/pontos-ler'] === 'function');
  // Simula chamada ao handler
  const req = { method: 'POST', body: { caminho: criarMockArquivo('Saldo: 500') }, headers: {} };
  const res = {
    statusCode: 0,
    body: null,
    writeHead(code) { this.statusCode = code; },
    end(payload) { this.body = JSON.parse(payload); }
  };
  // Chama o handler síncrono (ou assíncrono) e aguarda Promise
  return extra.handlers['/api/pontos-ler'](req, res).then(() => {
    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(res.body, { programas: [], saldo: 500, vencimento: null });
  });
});
