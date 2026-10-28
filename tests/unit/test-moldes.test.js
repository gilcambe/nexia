import { test, expect } from 'node:test';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Carrega os moldes
const moldesDir = path.join(__dirname, '../clientes/_moldes');
const moldesFiles = fs.readdirSync(moldesDir).filter(file => file.endsWith('.json'));

// Verifica que temos exatamente 10 arquivos de molde
expect(moldesFiles.length).toBe(10);

test('deve gerar index.html para cada molde sem erros', async () => {
  for (const moldeFile of moldesFiles) {
    const moldePath = path.join(moldesDir, moldeFile);
    const tempDir = path.join(__dirname, `../temp_test_output_${path.parse(moldeFile).name}`);

    // Cria o diretório temporário
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      // Executa o script renderizar-site.js para cada molde
      const { stdout, stderr } = await execAsync(`node scripts/renderizar-site.js "${moldePath}" "${tempDir}"`);
      
      // Verifica se o index.html foi gerado
      const indexPath = path.join(tempDir, 'index.html');
      expect(fs.existsSync(indexPath)).toBe(true);

      // Verifica se o index.html não está vazio
      const indexContent = fs.readFileSync(indexPath, 'utf-8');
      expect(indexContent.length).toBeGreaterThan(0);

      // Verifica se não há erros no stderr
      expect(stderr).toBe('');

      // Verifica se o stdout contém a mensagem de sucesso
      expect(stdout).toContain(`site em ${tempDir}`);

      console.log(`Sucesso ao gerar ${indexPath}`);
      
      // Remove o diretório temporário
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`Erro ao processar ${moldeFile}:`, error);
      // Remove o diretório temporário em caso de erro
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      // Falha o teste se houver qualquer erro
      throw new Error(`Falha ao renderizar o molde ${moldeFile}: ${error.message}`);
    }
  }
});