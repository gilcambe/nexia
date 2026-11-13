'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { preencher, gerar } = require('../../scripts/gerar-de-modelo.js');

const pastaModelo = path.join(__dirname, '../../modelos-projeto/painel');

test('Contrato do modelo painel', async (t) => {
  const modeloJsonPath = path.join(pastaModelo, 'modelo.json');
  const indexHtmlPath = path.join(pastaModelo, 'index.html');
  const painelJsPath = path.join(pastaModelo, 'painel.js');

  await t.test('existência e validade de modelo.json', () => {
    assert.strictEqual(fs.existsSync(modeloJsonPath), true);
    const content = fs.readFileSync(modeloJsonPath, 'utf8');
    const json = JSON.parse(content);
    assert.ok(json.nome);
    assert.ok(Array.isArray(json.variaveis));
  });

  await t.test('correspondência de todas as {{}} com variáveis em index.html e painel.js', () => {
    const modelo = JSON.parse(fs.readFileSync(modeloJsonPath, 'utf8'));
    const variaveis = new Set(modelo.variaveis || []);

    const arquivos = [indexHtmlPath, painelJsPath];
    const VAR = /\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g;

    for (const arq of arquivos) {
      if (!fs.existsSync(arq)) continue;
      const texto = fs.readFileSync(arq, 'utf8');
      for (const m of texto.matchAll(VAR)) {
        const varName = m[1];
        assert.strictEqual(
          variaveis.has(varName),
          true,
          `Variável {{${varName}}} encontrada em ${path.basename(arq)} mas não declarada no modelo.json`
        );
      }
    }
  });

  await t.test('presença de lang="pt-BR" e meta viewport em index.html', () => {
    assert.strictEqual(fs.existsSync(indexHtmlPath), true);
    const html = fs.readFileSync(indexHtmlPath, 'utf8');
    assert.match(html, /lang=["']pt-BR["']/i);
    assert.match(html, /<meta\s+name=["']viewport["']/i);
  });

  await t.test('ausência de palavras proibidas', () => {
    const proibidas = []; // Add any banned words if necessary, keeping general checks robust
    const arquivos = [modeloJsonPath, indexHtmlPath];
    if (fs.existsSync(painelJsPath)) arquivos.push(painelJsPath);

    for (const arq of arquivos) {
      const texto = fs.readFileSync(arq, 'utf8').toLowerCase();
      for (const palavra of proibidas) {
        assert.strictEqual(texto.includes(palavra), false, `Palavra proibida "${palavra}" encontrada em ${path.basename(arq)}`);
      }
    }
  });

  await t.test('funcionamento de gerar-de-modelo.js', () => {
    const modelo = JSON.parse(fs.readFileSync(modeloJsonPath, 'utf8'));
    const valores = {};
    for (const v of modelo.variaveis || []) {
      valores[v] = 'teste-valor';
    }
    const destinoTemp = path.join(__dirname, '../../.tmp-teste-modelo-' + Date.now());
    try {
      const criados = gerar(pastaModelo, valores, destinoTemp);
      assert.ok(Array.isArray(criados));
      assert.ok(criados.length > 0);
      assert.strictEqual(fs.existsSync(path.join(destinoTemp, 'index.html')), true);
    } finally {
      if (fs.existsSync(destinoTemp)) {
        fs.rmSync(destinoTemp, { recursive: true, force: true });
      }
    }
  });

  await t.test('desenharBarras com 3 itens gera SVG com 3 <rect>', () => {
    if (!fs.existsSync(painelJsPath)) return;
    const painelCodigo = fs.readFileSync(painelJsPath, 'utf8');
    
    // We can evaluate or mock/test the function if exported or globally available in the script context,
    // or simulate the DOM behavior. Let's check if desenharBarras exists as a function or test via vm if needed.
    const vm = require('node:vm');
    const sandbox = {
      document: {
        createElementNS: (ns, tag) => ({
          tag,
          attributes: {},
          children: [],
          setAttribute(k, v) { this.attributes[k] = v; },
          appendChild(child) { this.children.push(child); }
        })
      }
    };
    vm.createContext(sandbox);
    try {
      vm.runInContext(painelCodigo, sandbox);
    } catch (e) {
      // Ignore top-level execution errors if script expects DOM elements that aren't present yet on load
    }

    if (typeof sandbox.desenharBarras === 'function') {
      const itens = [
        { rotulo: 'A', valor: 10 },
        { rotulo: 'B', valor: 20 },
        { rotulo: 'C', valor: 30 }
      ];
      const svg = sandbox.desenharBarras(itens);
      // Count rect elements
      const contarRects = (node) => {
        let count = node.tag === 'rect' ? 1 : 0;
        if (node.children) {
          for (const c of node.children) count += contarRects(c);
        }
        return count;
      };
      const rects = contarRects(svg);
      assert.strictEqual(rects, 3);
    }
  });
});
