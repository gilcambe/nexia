'use strict';
// 18/11 (dono): no celular dele o seletor de documentos do Android entrega o PDF com 0 KB. Caminho seguro: o app
// aparece no "Compartilhar" (Web Share Target). E "não tem a opção de deletar os holerites": lista com 🗑️.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ler = (f) => fs.readFileSync(path.join(__dirname, '../../prumo', f), 'utf8');

test('manifest declara o alvo de compartilhamento para PDF e imagem', () => {
  const m = JSON.parse(ler('manifest.webmanifest'));
  assert.equal(m.share_target.action, '/prumo/compartilhar');
  assert.equal(m.share_target.method, 'POST');
  assert.equal(m.share_target.enctype, 'multipart/form-data');
  const f = m.share_target.params.files[0];
  assert.equal(f.name, 'arquivos');
  assert.ok(f.accept.includes('application/pdf') && f.accept.includes('image/*'));
});

test('service worker guarda o arquivo compartilhado e o app o entrega ao Salário', () => {
  const sw = ler('sw.js');
  assert.match(sw, /url\.pathname === '\/prumo\/compartilhar'/);
  assert.match(sw, /fd\.getAll\('arquivos'\)/);
  assert.match(sw, /caches\.open\('kf-compartilhado'\)/);
  assert.match(sw, /Response\.redirect\('\/prumo\/\?compartilhado=' \+ n, 303\)/);
  assert.match(sw, /k\.startsWith\('prumo-'\)/, 'a limpeza de versões não apaga o kf-compartilhado');
  const app = ler('app.js');
  assert.match(app, /get\('compartilhado'\)/);
  assert.match(app, /MB\.compartilhados = /);
  const o = ler('orcamento.js');
  assert.match(o, /MB\.compartilhados && MB\.compartilhados\.length/);
  assert.match(o, /processar\(comp,/);
});

test('Salário lista todos os holerites com apagar (novos e do sistema antigo)', () => {
  const o = ler('orcamento.js');
  assert.match(o, /id="sal-hist"/);
  assert.match(o, /pagamento_listar', \{\}/);
  assert.match(o, /holerite_listar'/);
  assert.match(o, /'pagamento_apagar' : 'holerite_apagar'/);
});

test('servidor: compartilhar sem o service worker ativo volta para o app (nunca 405)', () => {
  const s = fs.readFileSync(path.join(__dirname, '../../cloudflare/app.js'), 'utf8');
  assert.match(s, /request\.method === 'POST' && pathname === '\/prumo\/compartilhar'/);
  assert.match(s, /Location: '\/prumo\/\?compartilhado=0'/);
});
