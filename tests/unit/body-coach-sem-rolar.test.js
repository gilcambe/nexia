'use strict';
// Body Coach sem rolar (pedido do usuário em 24/10/2026): cada tópico cabe numa tela; detalhe abre no toque.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', '..', 'apps', 'body-coach', 'src');
const ler = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');

test('Topo do app em uma linha no celular (sem o subtítulo que quebrava em duas)', () => {
  const shell = ler('components/feature/AppShell.tsx');
  assert.match(shell, /size === 'md' && \(/);
  assert.match(shell, /px-3 py-1\.5 backdrop-blur lg:hidden/);
});

test('Coach: Meus alunos com números que filtram e uma linha curta por aluno', () => {
  const s = ler('pages/coach/MeusAlunos.tsx');
  assert.match(s, /grid grid-cols-4 gap-1\.5" data-testid="resumo-alunos"/);
  assert.match(s, /aria-pressed=\{ativo\}/, 'os números são botões de filtro');
  assert.match(s, /divide-y/, 'lista em linhas, não cartões grandes');
  assert.doesNotMatch(s, /grid grid-cols-2 gap-2">\s*<Link to="\/coach\/financeiro"/, 'atalhos repetidos do menu saíram');
  assert.match(ler('pages/coach/AlunoPlano.tsx'), /\/coach\/presenca\/\$\{uid\}/, 'Presença continua a um toque, na tela do aluno');
});

test('Coach: Evolução e Financeiro em linhas compactas', () => {
  assert.match(ler('pages/coach/AlunosEvolucao.tsx'), /divide-y/);
  const fin = ler('pages/coach/Financeiro.tsx');
  assert.match(fin, /grid grid-cols-3 gap-1\.5" data-testid="fin-resumo"/);
  assert.match(fin, /mt-1 h-24" data-testid="fin-grafico"/);
  assert.match(fin, /Cobrar \$\{a\.nome\} no WhatsApp/);
});
