'use strict';
// Um workflow com YAML inválido deixa de abrir e para o Cortex inteiro (aconteceu em 2026-10-07: um "#" fora de
// aspas virou comentário e cortou a expressão ${{ }}). Este teste pega esse erro antes do merge.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '../../.github/workflows');
const arquivos = fs.readdirSync(DIR).filter(f => /\.ya?ml$/.test(f));

test('WF1. toda expressão ${{ }} dos workflows está fechada e nenhum # solto a corta', () => {
  assert.ok(arquivos.length > 0);
  for (const f of arquivos) {
    const linhas = fs.readFileSync(path.join(DIR, f), 'utf8').split('\n');
    linhas.forEach((l, i) => {
      if (/^\s*#/.test(l)) return;
      const valor = l.replace(/^\s*(-\s+)?[\w.-]+:\s*/, '');
      if (!valor.includes('${{')) return;
      const aspas = /^["'].*["']\s*$/.test(valor) || /^[|>]/.test(valor);
      assert.ok((valor.match(/\$\{\{/g) || []).length <= (valor.match(/\}\}/g) || []).length, `${f}:${i + 1} expressão \${{ }} sem fechar`);
      if (!aspas) {
        // sem aspas, um " #" dentro da expressão vira comentário do YAML
        const dentro = valor.match(/\$\{\{.*?\}\}/g) || [];
        for (const e of dentro) assert.ok(!/\s#/.test(e), `${f}:${i + 1} há " #" dentro de uma expressão sem aspas; coloque o valor entre aspas`);
      }
    });
  }
});
