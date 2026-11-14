'use strict';
// Gera prumo/abertura.js (Finance, HTML sem build) a partir de src/lib/abertura-nexia.ts — a mesma abertura KERNEX dos outros apps.
// Rodar depois de mudar a abertura: node scripts/gerar-abertura-finance.cjs (o teste ABERTURA-FINANCE confere).
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');
function aberturaJs(ts, produto) {
  const corpo = ts
    .replace(/^export /gm, '')
    .replace(/\): (string|void) \{/g, ') {');
  return '// GERADO por scripts/gerar-abertura-finance.cjs a partir de src/lib/abertura-nexia.ts. Não editar à mão.\n' +
    '(function () {\n' + corpo + `\nmostrarAbertura(${JSON.stringify(produto)});\n})();\n`;
}
module.exports = { aberturaJs };
if (require.main === module) {
  const ts = fs.readFileSync(path.join(raiz, 'src/lib/abertura-nexia.ts'), 'utf8');
  fs.writeFileSync(path.join(raiz, 'prumo/abertura.js'), aberturaJs(ts, 'FINANCE'));
  console.log('prumo/abertura.js gerado');
}
