'use strict';
// Contrato: ícone do Kernex Finance estiloso (dono 17/11: "até o ícone do app deveria ser estiloso"). Hoje é um
// quadrado azul com a letra "K" em Arial (<text>), que muda de cara conforme a fonte do aparelho.
// Pronto quando prumo/icone.svg (512x512) tem: fundo com degradê (<linearGradient>) e cantos arredondados
// (rx ≥ 96), o desenho em <path> (sem <text>: não depende de fonte), um "K" estilizado e um gráfico subindo
// (linha ou barras), no máximo 4 KB; e o manifest com theme_color igual à cor do degradê.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const svg = fs.readFileSync(path.join(__dirname, '../../prumo/icone.svg'), 'utf8');
const man = JSON.parse(fs.readFileSync(path.join(__dirname, '../../prumo/manifest.webmanifest'), 'utf8'));

test('SVG 512x512, fundo em degradê com cantos arredondados', () => {
  assert.match(svg, /viewBox="0 0 512 512"/);
  assert.match(svg, /<linearGradient[\s\S]*<stop[\s\S]*<stop/, 'degradê com pelo menos 2 cores (<linearGradient> com 2 <stop>)');
  const rx = /<rect[^>]*\brx="(\d+)"/.exec(svg);
  assert.ok(rx && Number(rx[1]) >= 96, 'fundo <rect rx="96" ou mais>');
  assert.match(svg, /<rect[^>]*fill="url\(#/, 'o fundo usa o degradê (fill="url(#...)")');
});

test('desenho em <path> (sem <text>), com o K e um gráfico subindo; leve', () => {
  assert.doesNotMatch(svg, /<text/, 'sem <text>: desenhe o K em <path>');
  assert.ok((svg.match(/<path/g) || []).length >= 2, 'pelo menos 2 <path>: o K e o gráfico subindo');
  assert.ok(Buffer.byteLength(svg) <= 4096, 'no máximo 4 KB');
  assert.doesNotMatch(svg, /<image|href="http/, 'sem imagem externa');
});

test('manifest: theme_color é uma das cores do degradê do ícone', () => {
  const cores = [...svg.matchAll(/stop-color="(#[0-9a-fA-F]{6})"/g)].map((m) => m[1].toLowerCase());
  assert.ok(cores.length >= 2, 'stop-color em hexadecimal (#rrggbb)');
  assert.ok(cores.includes(String(man.theme_color).toLowerCase()), `theme_color (${man.theme_color}) deve ser uma das cores do degradê (${cores.join(', ')})`);
});
