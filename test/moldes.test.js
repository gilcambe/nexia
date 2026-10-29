const fs = require('fs');
const path = require('path');
const { renderizar } = require('../scripts/renderizar-site');
const os = require('os');

// Lista de moldes a serem testados
const MOLDES = [
  'clinica',
  'dentista',
  'advogado',
  'restaurante',
  'salao-estetica',
  'academia-personal',
  'imobiliaria',
  'loja',
  'contabilidade',
  'eventos'
];

// Diretório base dos moldes
const BASE_DIR = path.resolve(__dirname, '../clientes/_moldes');

describe('Renderização de Moldes', () => {
  MOLDES.forEach(molde => {
    it(`deve renderizar o molde ${molde} sem erros`, () => {
      const specPath = path.join(BASE_DIR, `${molde}.json`);
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'molde-test-'));

      try {
        const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
        renderizar(spec, tempDir, {}, { base: path.dirname(specPath) });

        // Verifica se o index.html foi gerado
        const indexPath = path.join(tempDir, 'index.html');
        expect(fs.existsSync(indexPath)).toBe(true);

      } catch (error) {
        throw new Error(`Erro ao renderizar o molde ${molde}: ${error.message}`);
      } finally {
        // Limpa a pasta temporária
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
