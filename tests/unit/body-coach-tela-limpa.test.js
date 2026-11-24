'use strict';
// Dono, 24/11/2026: "A interface continua péssima... poluída". Treino e Hoje mostram só o essencial;
// o resto continua existindo, mas fica fechado (nada foi apagado).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ler = (f) => fs.readFileSync(path.join(__dirname, '../../apps/body-coach/src', f), 'utf8');

test('treino: música/voz/bloqueio fechados em "Música e mais", sem caixa de sugestão nem botão Repetir', () => {
  const w = ler('pages/workout/page.tsx');
  assert.match(w, /data-testid="abrir-ferramentas-treino"/);
  assert.match(w, /\$\{ferramentas \? 'flex' : 'hidden'\}`\} data-testid="barra-treino"/); // escondido, não desmontado: a música não para
  assert.doesNotMatch(w, /descanso \{exercise\.restSec \|\| 60\} s/);
  assert.match(w, /ajustes=\{maisOpcoes\}/);
  const s = ler('pages/workout/components/SetEntry.tsx');
  assert.doesNotMatch(s, /Sugestão: \{sugestao/);
  assert.doesNotMatch(s, /repetir-serie/);
  assert.match(s, /const base = ultima \?\? sugestao \?\? null;/); // a sugestão já vem no campo
  assert.match(s, /\{ajustes && <div[^>]*data-testid="ajustes-serie"/);
  assert.match(s, /useState\(metaSobra \?\? 2\)/);
});

test('Hoje: sem Convidar/robô no topo, sem "Falar com o Coach", nutrição só calorias, proteína e água', () => {
  const h = ler('pages/home/page.tsx');
  const simples = h.slice(h.indexOf('{!verTudo ? ('), h.indexOf(') : ('));
  assert.doesNotMatch(simples, /RecuperacaoCard|Convidar/);
  assert.match(simples, /<NutritionCard simples \/>/);
  assert.doesNotMatch(h.slice(h.indexOf('<header'), h.indexOf('{!verTudo ? (')), /Convidar|ri-robot/);
  assert.doesNotMatch(ler('pages/home/components/TodayCard.tsx'), /Falar com o Coach/);
});
