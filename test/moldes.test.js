import { test, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { renderizar } from '../scripts/renderizar-site';

// Carrega os moldes
const moldesDir = path.join(__dirname, '../clientes/_moldes');
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

// Função para validar se um conteúdo é HTML válido básico
function isValidHtml(content) {
  // Verifica se começa com tag html e tem tags básicas
  return content.includes('<html') && 
         content.includes('</html>') && 
         content.includes('<head') && 
         content.includes('</head>') &&
         content.includes('<body') && 
         content.includes('</body>') &&
         !content.includes('Erro') &&
         !content.includes('error');
}

test('deve gerar index.html válido para cada molde sem erros', async () => {
  for (const moldeFile of moldesFiles) {
    const moldePath = path.join(moldesDir, moldeFile);
    const outputDir = path.join(tempDir, path.parse(moldeFile).name);

    console.log(`Testando molde: ${moldeFile}`);

    try {
      // Carrega o molde
      const molde = JSON.parse(fs.readFileSync(moldePath, 'utf-8'));
      
      // Chama a função renderizar diretamente e captura o resultado
      const result = renderizar(molde, outputDir, {}, { base: moldesDir });
      
      // Verifica se a função retornou os arquivos gerados
      expect(result).toBeDefined();
      expect(result.escritos).toBeDefined();
      expect(Array.isArray(result.escritos)).toBe(true);
      
      // Verifica se o index.html foi gerado
      const indexPath = path.join(outputDir, 'index.html');
      expect(fs.existsSync(indexPath)).toBe(true);

      // Verifica se o index.html não está vazio
      const indexContent = fs.readFileSync(indexPath, 'utf-8');
      expect(indexContent.length).toBeGreaterThan(0);
      
      // Verifica se o conteúdo é HTML válido
      expect(isValidHtml(indexContent)).toBe(true);
      
      // Verifica se todos os arquivos necessários foram gerados
      expect(result.escritos.length).toBeGreaterThan(0);
      
      // Verifica se o index.html está na lista de arquivos gerados
      expect(result.escritos).toContain('index.html');
      
      // Verifica se outros arquivos essenciais foram gerados
      const hasEssentialFiles = result.escritos.some(file => 
        file.endsWith('.css') || file.endsWith('.js') || file.startsWith('assets/')
      );
      expect(hasEssentialFiles).toBe(true);

      console.log(`Sucesso ao gerar ${indexPath}. Arquivos gerados: ${result.escritos.length}`);
    } catch (error) {
      console.error(`Erro ao processar ${moldeFile}:`, error);
      // Falha o teste se houver qualquer erro durante a execução
      expect.fail(`Falha ao renderizar o molde ${moldeFile}: ${error.message}`);
    }
  }
});