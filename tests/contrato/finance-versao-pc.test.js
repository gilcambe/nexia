// Contrato: Kernex Finance com versão para PC (dono 16/11: "deve ter uma versão web, caso queira ficar com ele aberto no PC").
// Hoje finance.kernex.com.br abre no PC, mas é a tela do celular esticada: coluna de 720px no meio e o menu de abas
// preso embaixo. No PC (tela de 1024px ou mais) o menu vira uma barra LATERAL à esquerda e o conteúdo usa a largura,
// com os cartões em 2 colunas. No celular nada muda.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../../prumo/index.html'), 'utf8');
const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');

// Blocos @media (min-width: N) com N >= 1000px (no PC). Junta o CSS de dentro deles.
function blocosPc() {
  const out = []; const re = /@media[^{]*min-width\s*:\s*(\d+)px[^{]*\{/g; let m;
  while ((m = re.exec(css))) {
    if (Number(m[1]) < 1000 || Number(m[1]) > 1280) continue;
    let i = re.lastIndex; let n = 1; const ini = i;
    while (i < css.length && n) { if (css[i] === '{') n++; else if (css[i] === '}') n--; i++; }
    out.push(css.slice(ini, i - 1));
  }
  return out.join('\n');
}
const regra = (bloco, reSel) => [...bloco.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter((r) => reSel.test(r[1].trim())).map((r) => r[2]).join(';');

test('existe um @media (min-width: entre 1000 e 1280px) para o PC', () => {
  assert.ok(blocosPc().trim().length > 0, 'crie @media (min-width: 1024px) { ... } no <style> de prumo/index.html');
});

test('no PC o menu de abas (nav.abas) vira barra lateral à esquerda, em coluna', () => {
  const nav = regra(blocosPc(), /(^|,|\s)nav\.abas$|(^|,|\s)\.abas$|#abas$/);
  assert.match(nav, /flex-direction\s*:\s*column/, 'nav.abas no PC: flex-direction: column');
  assert.match(nav, /left\s*:\s*0/, 'nav.abas no PC: presa à esquerda (left: 0)');
  assert.match(nav, /right\s*:\s*auto/, 'nav.abas no PC: solte a direita (right: auto)');
  assert.match(nav, /top\s*:\s*\d/, 'nav.abas no PC: de cima (top) até embaixo');
  assert.match(nav, /width\s*:\s*\d{3}px/, 'nav.abas no PC: largura fixa (ex.: width: 220px)');
});

test('no PC o conteúdo usa a largura (main bem mais largo que 720px) e abre espaço para o menu lateral', () => {
  const main = regra(blocosPc(), /(^|,|\s)main$/);
  const mw = /max-width\s*:\s*(\d+)px/.exec(main);
  assert.ok(mw && Number(mw[1]) >= 1100, 'main no PC: max-width de 1100px ou mais');
  assert.match(main, /(margin-left|padding-left)\s*:\s*\d{3}px/, 'main no PC: margin-left (ou padding-left) do tamanho do menu lateral');
});

test('no PC os cartões ficam em 2 colunas (grid)', () => {
  const b = blocosPc();
  assert.match(b, /display\s*:\s*grid/, 'use display: grid no PC para os cartões');
  assert.match(b, /grid-template-columns\s*:\s*(repeat\(\s*2|1fr\s+1fr|repeat\(\s*auto-fill)/, 'grid com 2 colunas (ou auto-fill)');
});

test('no celular nada muda: o menu continua embaixo fora do @media', () => {
  const fora = css.replace(/@media[^{]*\{[\s\S]*?\}\s*\}/g, '');
  // 17/11/2026: no celular o menu virou gaveta lateral (contrato finance-menu-lateral); a barra embaixo saiu.
  assert.match(regra(fora, /(^|\s)main$/), /max-width\s*:\s*720px/, 'main base continua 720px no celular');
});
