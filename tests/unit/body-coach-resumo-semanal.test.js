'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const SRC = path.join(__dirname, '..', '..', 'apps', 'body-coach', 'src');
const ler = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

test('resumo semanal: cartão 1080×1350 com @nexiabodycoach e botão no relatório', async () => {
  // sem a biblioteca do QR: o teste desliga o selo
  const fonte = ler('lib/ferramentas/cartao.ts').replace(/^import qrcode.*$/m, 'const qrcode = () => ({});');
  const out = ts.transpileModule(fonte, { compilerOptions: { module: ts.ModuleKind.ES2022, target: 'ES2022' } }).outputText;
  const f = path.join(fs.mkdtempSync(path.join(require('os').tmpdir(), 'rs-')), 'c.mjs');
  fs.writeFileSync(f, out);
  const m = await import(f);
  const textos = [];
  const grad = { addColorStop() {} };
  const ctx = new Proxy({ fillText: (t) => textos.push(t), measureText: (t) => ({ width: t.length * 20 }), createLinearGradient: () => grad, createRadialGradient: () => grad }, { get: (o, k) => (k in o ? o[k] : () => {}), set: () => true });
  const canvas = { width: 0, height: 0, getContext: () => ctx };
  m.desenharResumoSemanal(canvas, { titulo: 'Minha semana', data: new Date(2026, 9, 19), itens: [{ rotulo: 'check-ins', valor: '5/7' }], nome: 'Gil', selo: false });
  assert.equal(canvas.width, 1080);
  assert.equal(canvas.height, 1350);
  assert.ok(textos.includes('@nexiabodycoach'));
  assert.ok(textos.includes('5/7'));
  const wr = ler('pages/home/components/WeeklyReport.tsx');
  assert.match(wr, /formato="feed"/);
  assert.match(ler('components/feature/CompartilharCartao.tsx'), /desenharResumoSemanal/);
});
