import { test, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { renderizar } from '../scripts/renderizar-site'; // Ajuste o caminho se necessário

// Carrega os moldes
const moldesDir = path.join(__dirname, '../clientes/_moldes'); // Ajuste o caminho se necessário
const moldesFiles = fs.readdirSync(moldesDir).filter(file => file.endsWith('.json'));

// Garante que temos os 10 arquivos de molde esperados
expect(moldesFiles.length).toBeGreaterThanOrEqual(10);

// Define um diretório temporário para os testes
const tempDir = path.join(__dirname, '../temp_test_output');

beforeAll(() => {
  // Cria o diretório temporário se não existir
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
});

afterAll(() => {
  // Remove o diretório temporário após os testes
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('deve gerar index.html para cada molde sem erros', async () => {
  for (const moldeFile of moldesFiles) {
    const moldePath = path.join(moldesDir, moldeFile);
    const outputDir = path.join(tempDir, path.parse(moldeFile).name); // Cria subpasta com o nome do molde

    console.log(`Testando molde: ${moldeFile}`);

    try {
      await renderSite({
        moldesPath: moldePath,
        outputDir: outputDir,
        isTest: true, // Flag para indicar ambiente de teste, se renderizar-site.js usar
      });

      const indexPath = path.join(outputDir, 'index.html');
      expect(fs.existsSync(indexPath)).toBe(true);

      // Opcional: Checar se o index.html não está vazio ou contém um erro básico
      const indexContent = fs.readFileSync(indexPath, 'utf-8');
      expect(indexContent.length).toBeGreaterThan(0);
      expect(indexContent).not.toContain('Erro'); // Verifica se não há um erro óbvio no conteúdo

      console.log(`Sucesso ao gerar ${indexPath}`);
    } catch (error) {
      console.error(`Erro ao processar ${moldeFile}:`, error);
      // Falha o teste se houver qualquer erro durante a execução de renderSite
      expect.fail(`Falha ao renderizar o molde ${moldeFile}: ${error.message}`);
    }
  }
});