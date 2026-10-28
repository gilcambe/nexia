import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const RAIZ = path.resolve(__dirname, '../..');
const moldesDir = path.join(RAIZ, 'clientes/_moldes');
const script = path.join(RAIZ, 'scripts/renderizar-site.js');

const moldesFiles = fs.readdirSync(moldesDir).filter(file => file.endsWith('.json')).sort();

test('existem exatamente 10 arquivos de molde em clientes/_moldes/', () => {
  assert.strictEqual(moldesFiles.length, 10, `esperado 10 moldes, encontrado ${moldesFiles.length}: ${moldesFiles.join(', ')}`);
});

test('deve gerar index.html para cada molde sem erros', async () => {
  const tempDir = path.join(RAIZ, 'temp_test_output_moldes');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  for (const moldeFile of moldesFiles) {
    const moldePath = path.join(moldesDir, moldeFile);
    const outputDir = path.join(tempDir, path.parse(moldeFile).name);

    fs.mkdirSync(outputDir, { recursive: true });

    try {
      console.log(`Processando molde: ${moldeFile}`);
      console.log(`Comando: node "${script}" "${moldePath}" "${outputDir}"`);

      const { stdout, stderr } = await execAsync(`node "${script}" "${moldePath}" "${outputDir}"`, {
        timeout: 30000,
        cwd: RAIZ,
      });

      console.log(`stdout: ${stdout}`);
      if (stderr) {
        console.warn(`stderr: ${stderr}`);
      }

      const indexPath = path.join(outputDir, 'index.html');
      assert.ok(fs.existsSync(indexPath), `index.html não gerado para ${moldeFile}`);

      const indexContent = fs.readFileSync(indexPath, 'utf8');
      assert.ok(indexContent.length > 0, `index.html vazio para ${moldeFile}`);

      console.log(`Sucesso ao gerar ${indexPath} (${indexContent.length} bytes)`);
    } catch (error) {
      console.error(`Erro ao processar ${moldeFile}:`, error);
      throw new Error(`Falha ao renderizar o molde ${moldeFile}: ${error.message}`);
    } finally {
      if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true, force: true });
      }
    }
  }

  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
