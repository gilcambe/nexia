// public/cortex-sw.js, public/central-sw.js e apps/body-coach/public/sw.js:
// a versão nova NÃO assume sozinha (install sem skipWaiting); ela espera o toque
// em "Atualizar" (message tipo 'atualizar') e o activate apaga os caches antigos.
// #2917

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '../..');

const CASOS = [
  { arquivo: 'public/cortex-sw.js', prefixo: 'cortex-', pagina: '/cortex' },
  { arquivo: 'public/central-sw.js', prefixo: 'central-', pagina: '/central' },
  { arquivo: 'apps/body-coach/public/sw.js', prefixo: 'body-coach-', pagina: './index.html' },
];

function ler(arquivo) {
  return fs.readFileSync(path.join(raiz, arquivo), 'utf8');
}

for (const caso of CASOS) {
  test(`${caso.arquivo}: install não chama skipWaiting`, () => {
    const src = ler(caso.arquivo);
    const ini = src.search(/addEventListener\(\s*['"]install['"]/);
    const fim = src.search(/addEventListener\(\s*['"]activate['"]/);
    const bloco = ini >= 0 && fim > ini ? src.slice(ini, fim) : '';
    const trecho = bloco.length ? bloco : src;
    assert.ok(!/skipWaiting\s*\(/.test(trecho), 'install não pode chamar skipWaiting');
  });

  test(`${caso.arquivo}: message tipo atualizar chama skipWaiting`, () => {
    const src = ler(caso.arquivo);
    assert.ok(/tipo\s*===\s*['"]atualizar['"]/.test(src), 'falta o comando atualizar');
    assert.ok(/skipWaiting\s*\(/.test(src), 'falta chamar skipWaiting');
    assert.ok(/addEventListener\(\s*['"]message['"]/.test(src), 'falta o listener message');
  });

  test(`${caso.arquivo}: cache versionado e limpeza dos antigos no activate`, () => {
    const src = ler(caso.arquivo);
    assert.ok(new RegExp(`startsWith\\(\\s*['"]${caso.prefixo}`).test(src), 'activate deve apagar caches antigos do prefixo');
    assert.ok(/caches\.delete\(/.test(src), 'falta apagar cache antigo');
  });

  test(`${caso.arquivo}: scripts/estilos sem hash vão à rede primeiro`, () => {
    const src = ler(caso.arquivo);
    assert.ok(/\\.(webmanifest\|json\|html\|js\|css)\$/i.test(src), 'falta a regra de arquivos sem hash');
    assert.ok(/fetch\(/.test(src) && /caches\.match\(/.test(src), 'sem hash: rede primeiro, cache offline');
  });
}
