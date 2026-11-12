const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Caminho relativo ao diretório do teste
const jsonPath = path.join(__dirname, '../../modelos-projeto/painel/dados-exemplo.json');

test('arquivo dados-exemplo.json existe, é JSON válido e contém exatamente três itens em series', t => {
  // 1. Verifica se o arquivo existe
  const exists = fs.existsSync(jsonPath);
  assert.ok(exists, 'O arquivo dados-exemplo.json deve existir');

  // 2. Lê o conteúdo e garante que é JSON válido
  const raw = fs.readFileSync(jsonPath, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    assert.fail('O conteúdo do arquivo não é JSON válido');
  }
  assert.ok(typeof data === 'object' && data !== null, 'O JSON deve ser um objeto');

  // 3. Verifica a existência da propriedade series e seu tamanho
  assert.ok(Array.isArray(data.series), "A propriedade 'series' deve ser um array");
  assert.strictEqual(data.series.length, 3, "A propriedade 'series' deve conter exatamente três itens");

  // 4. Verifica cada objeto esperado
  const esperado = [
    { rotulo: 'A', valor: 10 },
    { rotulo: 'B', valor: 20 },
    { rotulo: 'C', valor: 30 }
  ];
  esperado.forEach((item, idx) => {
    const atual = data.series[idx];
    assert.deepStrictEqual(atual, item, `Item ${idx} da series deve ser ${JSON.stringify(item)}`);
  });
});