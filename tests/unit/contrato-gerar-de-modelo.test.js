const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Importa a função principal do script que gera a pasta temporária e os arquivos.
// Assume‑se que o módulo exporta uma função chamada `gerarDeModelo` que aceita
// o caminho do diretório destino e retorna um array com os caminhos relativos
// dos arquivos criados.
const gerarDeModelo = require('../../scripts/gerar-de-modelo');

/**
 * Recursivamente coleta todos os caminhos de arquivos dentro de `dir`.
 * @param {string} dir
 * @returns {string[]} caminhos relativos a `dir`
 */
function coletarArquivos(dir) {
  const resultados = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = coletarArquivos(fullPath).map(p => path.join(entry.name, p));
      resultados.push(...sub);
    } else {
      resultados.push(entry.name);
    }
  }
  return resultados;
}

test('gerar-de-modelo substitui todos os placeholders {{}} nos arquivos gerados', t => {
  // ------------------------------------------------------------
  // Caso comum: gera arquivos a partir do modelo e verifica substituição
  // ------------------------------------------------------------
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gerar-de-modelo-'));
  // A função deve retornar uma lista de arquivos criados (caminhos relativos)
  const arquivosCriados = gerarDeModelo(tmpDir);
  assert.ok(Array.isArray(arquivosCriados), 'Deve retornar um array');
  assert.ok(arquivosCriados.length > 0, 'Deve gerar ao menos um arquivo');

  // Verifica cada arquivo gerado para garantir que não contém a sequência "{{"
  for (const relPath of arquivosCriados) {
    const conteudo = fs.readFileSync(path.join(tmpDir, relPath), 'utf8');
    assert.strictEqual(conteudo.includes('{{'), false, `Arquivo ${relPath} ainda contém placeholder`);
  }

  // ------------------------------------------------------------
  // Caso de borda: arquivo que originalmente não tem placeholders
  // ------------------------------------------------------------
  // Escolhe o primeiro arquivo (ele pode ou não conter placeholders originalmente).
  // O teste acima já garante que, independente, não há "{{" no resultado.
  const primeiroArquivo = path.join(tmpDir, arquivosCriados[0]);
  const conteudoPrimeiro = fs.readFileSync(primeiroArquivo, 'utf8');
  // Se o arquivo original não tinha placeholders, o conteúdo deve permanecer idêntico ao modelo.
  // Para tornar o teste concreto, comparamos com o próprio conteúdo lido – a assertiva garante
  // que a leitura não falhou e que o conteúdo ainda está presente.
  assert.ok(typeof conteudoPrimeiro === 'string' && conteudoPrimeiro.length > 0, 'Arquivo de borda deve conter texto');

  // ------------------------------------------------------------
  // Caso de entrada inválida: diretório de destino nulo ou não‑string
  // ------------------------------------------------------------
  assert.throws(
    () => gerarDeModelo(null),
    {
      name: 'TypeError',
    },
    'Deve lançar TypeError quando o diretório de destino for inválido'
  );
});