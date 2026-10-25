'use strict';
// Body Coach tela cheia (pedido do usuário em 24/10/2026: "sem harmonia nenhuma"): cada tela do aluno usa a altura toda,
// sem cartão esticado vazio, e no treino em andamento os botões Registrar e Próximo ficam sempre visíveis.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const BC = path.join(__dirname, '..', '..', 'apps', 'body-coach');
const ler = (f) => fs.readFileSync(path.join(BC, 'src', f), 'utf8');

test('Base: tela de celular alto, classes .tela e conteúdo com a altura até o menu', () => {
  assert.match(fs.readFileSync(path.join(BC, 'tailwind.config.ts'), 'utf8'), /alto: \{ raw: '\(min-height: 740px\)' \}/);
  const css = ler('index.css');
  assert.match(css, /\.tela \{ display: flex; flex: 1 1 auto; flex-direction: column;/);
  assert.match(css, /\.tela-fim > :last-child \{ flex-grow: 1; \}/);
  assert.match(ler('components/feature/AppShell.tsx'), /min-h-\[calc\(100dvh-52px\)\]/);
  const v = ler('components/base/EstadoVazio.tsx');
  assert.match(v, /flex flex-1 flex-col items-center justify-center/);
});

test('Treino em andamento: Registrar e Próximo numa barra fixa acima do menu', () => {
  const s = ler('pages/workout/components/SetEntry.tsx');
  assert.match(s, /fixed inset-x-0 bottom-\[calc\(4\.25rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(s, /data-testid="registrar-serie"/);
  assert.match(s, /acaoAoLado/);
  const w = ler('pages/workout/page.tsx');
  assert.match(w, /data-testid="concluir-exercicio"/);
  assert.match(w, /data-testid="abrir-mais-opcoes"/);
  assert.match(w, /hidden aspect-\[16\/9\] max-h-\[16dvh\][^"]*alto:block/);
});

test('Telas com pouco conteúdo mostram aviso grande no meio, não cartão vazio', () => {
  assert.match(ler('pages/evolution/ResumoEvolucao.tsx'), /testId="resumo-vazio"/);
  assert.match(ler('pages/evolution/avaliacao/AbaAvaliacoes.tsx'), /testId="avaliacoes-vazio"/);
  assert.match(ler('pages/evolution/avaliacao/GraficosEvolucao.tsx'), /testId="graficos-vazio"/);
  assert.match(ler('pages/evolution/fotos/AbaFotos.tsx'), /testId="antes-depois-vazio"/);
  assert.match(ler('pages/exams/components/ExamList.tsx'), /testId="exames-vazio"/);
  assert.match(ler('pages/ferramentas/OfertasDoDia.tsx'), /testId="ofertas-vazio"/);
  assert.match(ler('pages/chat/page.tsx'), /testId="chat-vazio"/);
});

test('Cartões principais crescem até o menu (Nutrição, Cardápio, Hoje, Perfil, Ferramentas)', () => {
  assert.match(ler('pages/nutrition/components/CardapioDoDia.tsx'), /flex flex-1 flex-col rounded-2xl[^"]*data-testid="cardapio"|className="flex flex-1 flex-col rounded-2xl/);
  assert.match(ler('pages/home/components/TodayCard.tsx'), /data-testid="exercicios-hoje"/);
  assert.match(ler('pages/profile/page.tsx'), /flex flex-1 flex-col divide-y/);
  const f = ler('pages/ferramentas/page.tsx');
  assert.match(f, /const linhas = Math\.max\(4, Math\.ceil\(lista\.length \/ 3\)\)/);
  assert.match(f, /data-testid="grade-ferramentas"/);
});
