'use strict';
// Body Coach sem rolar, lado do aluno (pedido do usuário em 24/10/2026): telas longas viram abas curtas; detalhe abre no toque.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', '..', 'apps', 'body-coach', 'src');
const ler = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');

test('Abas guardam a escolha no endereço (?aba=) e voltam ao topo', () => {
  const s = ler('components/base/Abas.tsx');
  assert.match(s, /p\.set\('aba', id\)/);
  assert.match(s, /window\.scrollTo\(\{ top: 0 \}\)/);
  assert.match(s, /role="tablist"/);
});

test('Nutrição: Hoje, Cardápio e Ferramentas, sem perder nenhuma parte', () => {
  const s = ler('pages/nutrition/page.tsx');
  assert.match(s, /aba === 'hoje'/);
  for (const n of ['MacroSummary', 'Favoritas', 'AjudaRefeicao', 'MealList', 'WaterTracker', 'CardapioDoDia', 'PlanoNutricionista', 'LembretesRefeicoes', 'RefeicaoRapida', 'ReceitaIA', 'AjusteSemanal', 'WeeklyTrend']) assert.ok(s.includes(`<${n}`), n);
  assert.match(ler('pages/nutrition/components/MacroSummary.tsx'), /grid grid-cols-\[auto_1fr\]/, 'anel e barras lado a lado no celular');
});

test('Evolução: aba Corpo separada; mulher sem foto não vê o corpo de exemplo masculino', () => {
  const p = ler('pages/evolution/page.tsx');
  assert.match(p, /\{ id: 'corpo', label: 'Corpo'/);
  assert.match(p, /parte="corpo"/);
  const r = ler('pages/evolution/ResumoEvolucao.tsx');
  assert.match(r, /\{\(!mulher \|\| comFotos\) && <Card/);
  assert.match(r, /perfil\.sexo === 'F'/);
});

test('Perfil em 3 abas, com tudo que existia (privacidade e excluir conta incluídos)', () => {
  const s = ler('pages/profile/page.tsx');
  for (const n of ['SobreVoce', 'CicloCard', 'ConviteCoach', 'TamanhoDaLetra']) assert.ok(s.includes(`<${n} />`), n);
  assert.match(s, /Excluir minha conta/);
  assert.match(s, /\{ id: 'saude', label: 'Saúde'/);
});

test('Ficha: só o próximo treino aberto, divisão e lembretes abrem no toque', () => {
  const s = ler('pages/plan/page.tsx');
  assert.match(s, /const mostra = proximo \|\| aberto === i/);
  assert.match(s, /const \[trocando, setTrocando\] = useState\(false\)/);
  assert.match(s, /Lembretes de treino no celular/);
});

test('Nenhuma tela rola só por causa do layout: o miolo não tem altura mínima de uma tela inteira no celular', () => {
  const shell = ler('components/feature/AppShell.tsx');
  assert.match(shell, /<main className="min-w-0 break-words lg:min-h-screen lg:pl-60">/);
});

test('Hoje cabe numa tela: recuperação em uma linha, nutrição com 4 barras numa linha, "Ver tudo" no topo', () => {
  const home = ler('pages/home/page.tsx');
  assert.match(home, /aria-label="Ver tudo" data-testid="ver-tudo"/);
  assert.match(ler('pages/home/components/RecuperacaoCard.tsx'), /aria-expanded=\{aberto\}/);
  const n = ler('pages/home/components/NutritionCard.tsx');
  assert.match(n, /grid grid-cols-4 gap-2/);
  assert.match(n, /faltam \$\{remainingCal/);
});

test('Treino: perguntas compactas e "Começar treino" fixo embaixo, sempre à vista', () => {
  const p = ler('pages/workout/components/PreTreino.tsx');
  assert.match(p, /fixed inset-x-0 bottom-\[68px\] z-30/);
  assert.match(p, /aria-label=\{item\.label\}/);
  assert.match(ler('pages/workout/components/MusicaTreino.tsx'), /data-testid="musica-cartao"/);
  assert.doesNotMatch(ler('pages/workout/components/MusicaTreino.tsx'), /volte para o NEXIA/);
});
