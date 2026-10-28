import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { renderizar } from '../../scripts/renderizar-site';

// Carrega os moldes
const moldesDir = path.join(__dirname, '../../clientes/_moldes');
const moldesFiles = fs.readdirSync(moldesDir).filter(file => file.endsWith('.json')).sort();

// Valida exatamente 10 arquivos de molde
test('existem exatamente 10 arquivos de molde em clientes/_moldes/', () => {
  assert.strictEqual(moldesFiles.length, 10, `esperado 10 moldes, encontrado ${moldesFiles.length}: ${moldesFiles.join(', ')}`);
});

// Define um diretório temporário para os testes
const tempDir = path.join(__dirname, '../../temp_test_output_moldes');

test('deve gerar index.html para cada molde sem erros', async () => {
  // Cria o diretório temporário se não existir
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  for (const moldeFile of moldesFiles) {
    const moldePath = path.join(moldesDir, moldeFile);
    const outputDir = path.join(tempDir, path.parse(moldeFile).name);

    console.log(`Testando molde: ${moldeFile}`);

    try {
      // Carrega o molde
      const molde = JSON.parse(fs.readFileSync(moldePath, 'utf-8'));

      // Chama a função renderizar diretamente
      renderizar(molde, outputDir, {}, { base: moldesDir });

      const indexPath = path.join(outputDir, 'index.html');
      assert.ok(fs.existsSync(indexPath), `index.html não gerado para ${moldeFile}`);

      // Verifica se o index.html não está vazio nem contém erro básico
      const indexContent = fs.readFileSync(indexPath, 'utf8');
      assert.ok(indexContent.length > 0, `index.html vazio para ${moldeFile}`);
      assert.ok(!indexContent.includes('Erro'), `index.html contém 'Erro' para ${moldeFile}`);

      console.log(`Sucesso ao gerar ${indexPath}`);
    } catch (error) {
      console.error(`Erro ao processar ${moldeFile}:`, error);
      assert.fail(`Falha ao renderizar o molde ${moldeFile}: ${error.message}`);
    }
  }

  // Remove o diretório temporário após os testes
  fs.rmSync(tempDir, { recursive: true, force: true });
});
