import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Aba Avisar Clientes: presença dos arquivos e estrutura no HTML', () => {
  const htmlPath = path.resolve('sites/splash/agenda/index.html');
  const jsPath = path.resolve('sites/splash/agenda/avisar.js');

  assert.ok(fs.existsSync(htmlPath), 'index.html deve existir em sites/splash/agenda');
  assert.ok(fs.existsSync(jsPath), 'avisar.js deve existir em sites/splash/agenda');

  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.ok(html.includes('src="avisar.js"'), 'index.html deve carregar avisar.js');
  assert.ok(html.includes('id="aba-avisar"'), 'index.html deve possuir a seção #aba-avisar');
  assert.ok(html.includes("navegarAba('avisar')"), 'index.html deve possuir navegação para a aba avisar');
  assert.ok(html.includes('href="#avisar"'), 'index.html deve possuir o link href="#avisar"');

  const js = fs.readFileSync(jsPath, 'utf8');
  assert.ok(js.includes("import { gerarQR } from './qr.js'"), 'avisar.js deve importar gerarQR de qr.js');
  assert.ok(js.includes('AvisarClientes'), 'avisar.js deve exportar AvisarClientes');
  assert.ok(js.includes('navigator.share'), 'avisar.js deve utilizar navigator.share');
  assert.ok(js.includes('toDataURL'), 'avisar.js deve suportar download de imagem PNG via canvas');
});
