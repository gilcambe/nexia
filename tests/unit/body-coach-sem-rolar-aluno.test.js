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

test('Nutrição cabe numa tela: cardápio com só a próxima refeição aberta, Ideias e Gráficos mostram uma ferramenta por vez', () => {
  const c = ler('pages/nutrition/components/CardapioDoDia.tsx');
  assert.match(c, /const abertaAgora = aberta === undefined \? proxima : aberta/);
  assert.match(c, /aria-expanded=\{aberto\}/);
  const n = ler('pages/nutrition/page.tsx');
  assert.match(n, /const FERRAMENTAS = \[/);
  for (const f of ["ferramenta === 'rapida'", "ferramenta === 'receita'", "ferramenta === 'ajuste'", "ferramenta === 'tendencia'"]) assert.ok(n.includes(f), f);
  assert.match(n, /<WaterTracker/);
  const w = ler('pages/nutrition/components/WaterTracker.tsx');
  for (const ml of ['250', '500', '100']) assert.ok(w.includes(`aria-label="Bebi ${ml} ml"`), ml);
  const e = ler('pages/evolution/page.tsx');
  assert.match(e, /const GRAFICOS = \[/);
  for (const g of ["grafico === 'medidas'", "grafico === 'treino'", "grafico === 'musculos'", "grafico === 'periodo'"]) assert.ok(e.includes(g), g);
});

test('Corpo, fotos, perfil, avisos e acesso: compactos e sem perder nada', () => {
  const corpo = ler('pages/evolution/corpo3d/CorpoRealista.tsx');
  assert.match(corpo, /h-\[min\(35vh,392px\)\]/);
  assert.match(corpo, /aria-label="Personalizar corpo"/);
  const fotos = ler('pages/evolution/fotos/AbaFotos.tsx');
  assert.match(fotos, /grid grid-cols-4 gap-1\.5/);
  assert.match(fotos, /aria-label="Data das fotos"/);
  const sobre = ler('pages/profile/components/SobreVoce.tsx');
  assert.match(sobre, /aria-expanded=\{condicoes\}/);
  assert.match(sobre, /Como você quer ser chamado\(a\)\?/);
  const avisos = ler('pages/avisos/page.tsx');
  assert.match(avisos, /aria-label="Horário do lembrete do treino"/);
  assert.match(avisos, /Usar meus horários agora/);
  const painel = ler('components/feature/PainelAcesso.tsx');
  assert.match(painel, /Number\.isFinite\(acesso\.gratisAte\)/, 'sem "Invalid Date" quando a data do teste falta');
  assert.doesNotMatch(ler('components/feature/PagarPix.tsx'), /avisar o NEXIA|Fale com o NEXIA/, 'na tela a marca é a do app (Body Coach)');
});
