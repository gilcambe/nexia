'use strict';
// "Build" da Hostinger: não compila nada (o site é HTML puro). Só confere que o pacote está completo,
// para o deploy falhar cedo e com mensagem clara se faltar algum arquivo.
const fs = require('node:fs');
const path = require('node:path');

const aqui = path.resolve(__dirname, '..');
const raiz = fs.existsSync(path.join(aqui, 'app', 'viajante-pro')) ? path.join(aqui, 'app') : path.resolve(aqui, '..', '..');
const precisa = [
  'viajante-pro/vp-landing.html',
  'viajante-pro/app/index.html',
  'netlify/functions/viajante-pro.js',
  'netlify/functions/viajante-pro-painel.js',
  'viajante-pro/painel/index.html',
  'netlify/functions/leads.js',
  'clientes/viajantepro.js',
  'lib/routes.js',
  'core/nexia-boot.js',
];
const faltando = precisa.filter(f => !fs.existsSync(path.join(raiz, f)));
if (faltando.length) {
  console.error('Faltam arquivos no pacote:\n - ' + faltando.join('\n - '));
  process.exit(1);
}
console.log('Pacote do Viajante Pro completo (' + raiz + ').');
