const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Caminho relativo ao diretório deste teste
const modeloPath = path.join(__dirname, '../../modelos-projeto/hostinger-php/modelo.json');

test('arquivo modelo.json deve existir, ser JSON válido e conter a estrutura esperada', t => {
  // 1️⃣ Existência do arquivo
  assert.ok(fs.existsSync(modeloPath), 'arquivo modelo.json não foi encontrado');

  // 2️⃣ Leitura e parse do conteúdo
  const raw = fs.readFileSync(modeloPath, 'utf8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    assert.fail('arquivo modelo.json contém JSON inválido');
  }
  assert.ok(typeof data === 'object' && data !== null, 'conteúdo JSON não é um objeto');

  // 3️⃣ Verificação das chaves principais
  assert.ok('nome' in data, 'chave "nome" ausente');
  assert.ok('versao' in data, 'chave "versao" ausente');
  assert.ok('variaveis' in data, 'chave "variaveis" ausente');

  // 4️⃣ Tipos das propriedades
  assert.strictEqual(typeof data.nome, 'string', '"nome" deve ser string');
  assert.strictEqual(typeof data.versao, 'string', '"versao" deve ser string');
  assert.ok(Array.isArray(data.variaveis), '"variaveis" deve ser array');

  // 5️⃣ Conteúdo exato de "variaveis"
  const esperado = ['nome', 'titulo', 'whatsapp', 'cor'];
  assert.deepStrictEqual(data.variaveis, esperado, '"variaveis" deve conter exatamente ["nome","titulo","whatsapp","cor"]');
});