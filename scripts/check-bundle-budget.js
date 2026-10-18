import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.resolve('out/assets');
const MAX_INITIAL_JS_SIZE_KB = 500; // Limite de 500KB para o JS inicial/vendor principal

try {
  if (!fs.existsSync(OUT_DIR)) {
    console.error('Diretório out/assets não encontrado. Execute o build primeiro.');
    process.exit(1);
  }

  const files = fs.readdirSync(OUT_DIR);
  const jsFiles = files.filter(f => f.endsWith('.js'));

  let totalSize = 0;
  let maxFile = '';
  let maxFileSize = 0;

  for (const file of jsFiles) {
    const filePath = path.join(OUT_DIR, file);
    const stats = fs.statSync(filePath);
    const sizeKB = stats.size / 1024;
    totalSize += sizeKB;
    console.log(`[Bundle Budget] ${file}: ${sizeKB.toFixed(2)} KB`);

    if (stats.size > maxFileSize) {
      maxFileSize = stats.size;
      maxFile = file;
    }
  }

  const maxFileKB = maxFileSize / 1024;
  console.log(`[Bundle Budget] Maior arquivo JS: ${maxFile} (${maxFileKB.toFixed(2)} KB)`);

  if (maxFileKB > MAX_INITIAL_JS_SIZE_KB) {
    console.error(`\n[ERRO] Bundle Budget excedido! O arquivo ${maxFile} tem ${maxFileKB.toFixed(2)} KB, ultrapassando o limite de ${MAX_INITIAL_JS_SIZE_KB} KB.`);
    process.exit(1);
  }

  console.log(`\n[SUCESSO] Bundle Budget dentro do limite (${maxFileKB.toFixed(2)} KB <= ${MAX_INITIAL_JS_SIZE_KB} KB).`);
} catch (err) {
  console.error('Erro ao verificar tamanho do bundle:', err);
  process.exit(1);
}
