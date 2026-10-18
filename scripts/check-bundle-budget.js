import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.resolve('out');
const ASSETS_DIR = path.join(OUT_DIR, 'assets');
const MAX_INITIAL_JS_SIZE_KB = 500; // Limite de 500KB para arquivos do bundle inicial/vendor crítico

try {
  const targetDir = fs.existsSync(ASSETS_DIR) ? ASSETS_DIR : OUT_DIR;
  if (!fs.existsSync(targetDir)) {
    console.error('Diretório de build (out ou out/assets) não encontrado. Execute o build primeiro.');
    process.exit(1);
  }

  const files = fs.readdirSync(targetDir, { recursive: true });
  const jsFiles = files.filter(f => typeof f === 'string' && f.endsWith('.js'));

  let totalInitialSize = 0;
  const initialFiles = [];

  for (const file of jsFiles) {
    const filePath = path.join(targetDir, file);
    if (!fs.statSync(filePath).isFile()) continue;
    
    // Ignora chunks que são carregados sob demanda (lazy-loaded), como vendor-firebase
    if (file.includes('vendor-firebase')) {
      const stats = fs.statSync(filePath);
      console.log(`[Bundle Budget] ${file} (Lazy Loaded): ${(stats.size / 1024).toFixed(2)} KB - Ignorado do bundle crítico inicial.`);
      continue;
    }

    const stats = fs.statSync(filePath);
    const sizeKB = stats.size / 1024;
    totalInitialSize += stats.size;
    initialFiles.push({ file, sizeKB });
    console.log(`[Bundle Budget] ${file} (Crítico): ${sizeKB.toFixed(2)} KB`);
  }

  const totalInitialKB = totalInitialSize / 1024;
  console.log(`\n[Bundle Budget] Tamanho total do JS inicial/crítico: ${totalInitialKB.toFixed(2)} KB (Limite: ${MAX_INITIAL_JS_SIZE_KB} KB)`);

  if (totalInitialKB > MAX_INITIAL_JS_SIZE_KB) {
    console.error(`\n[ERRO] Bundle Budget excedido! O tamanho total do JS inicial (${totalInitialKB.toFixed(2)} KB) ultrapassa o limite de ${MAX_INITIAL_JS_SIZE_KB} KB.`);
    process.exit(1);
  }

  console.log(`\n[SUCESSO] Bundle Budget dentro do limite (${totalInitialKB.toFixed(2)} KB <= ${MAX_INITIAL_JS_SIZE_KB} KB).`);
} catch (err) {
  console.error('Erro ao verificar tamanho do bundle:', err);
  process.exit(1);
}
