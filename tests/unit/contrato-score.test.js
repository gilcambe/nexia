// tests/unit/score.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

// Importar as funções modificadas
const { score_ler, score_salvar, score_listar } = require('../../netlify/functions/prumo-lib/score.js');
const { handler } = require('../../netlify/functions/prumo-lib/extra.js');

// Utilitário para criar um diretório temporário isolado e apontar scores.json para lá
function withTempScores(callback) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'score-test-'));
  const scoresPath = path.join(tmpDir, 'scores.json');
  // garantir que o módulo score use este caminho via env interno (o código deve ler path relativo ao __dirname)
  // O módulo score.js utiliza path.join(__dirname, 'scores.json'), então criamos o arquivo ao lado do módulo em um sandbox
  // Copiamos o módulo para o tmpDir e o requeremos a partir daí
  const srcScorePath = path.resolve(__dirname, '../../netlify/functions/prumo-lib/score.js');
  const destScorePath = path.join(tmpDir, 'score.js');
  fs.copyFileSync(srcScorePath, destScorePath);
  // criar scores.json vazio
  fs.writeFileSync(scoresPath, JSON.stringify([]), 'utf8');

  // Require o módulo copiado que irá usar o scores.json ao lado
  const { score_ler: ler, score_salvar: salvar, score_listar: listar } = require(destScorePath);

  try {
    callback({ ler, salvar, listar, scoresPath });
  } finally {
    // limpar
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

test('score_ler retorna score correto para imagem base64 válida (caso comum)', async (t) => {
  await new Promise((resolve) => {
    withTempScores(({ ler }) => {
      // imagem base64 simulada (não precisa ser real, apenas string que o código interpreta)
      const base64 = Buffer.from('imagem-fake').toString('base64');
      const result = ler(base64);
      assert.ok(Array.isArray(result), 'deve retornar array');
      assert.equal(result.length, 0, 'inicialmente não há scores');
      resolve();
    });
  });
});

test('score_salvar adiciona e score_listar lista corretamente (borda: primeiro registro)', async (t) => {
  await new Promise((resolve) => {
    withTempScores(({ salvar, listar }) => {
      const base64 = Buffer.from('img').toString('base64');
      const score = { imagem: base64, valor: 42 };
      salvar(score);
      const all = listar();
      assert.equal(all.length, 1, 'deve conter um registro');
      assert.deepEqual(all[0], score, 'registro deve ser o mesmo que foi salvo');
      resolve();
    });
  });
});

test('handler devolve erro 400 para payload inválido (entrada inválida)', async (t) => {
  // criar request falso sem body
  const req = { method: 'POST', headers: {}, body: null };
  const res = {
    statusCode: null,
    _body: null,
    writeHead(status) { this.statusCode = status; },
    end(body) { this._body = body; }
  };
  await handler(req, res);
  assert.equal(res.statusCode, 400, 'deve responder 400 para payload inválido');
  assert.match(res._body, /payload inválido/i);
});
