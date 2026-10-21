'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SplashCalendario = require('../../sites/splash/calendario.js');

test('SPLASH-CALENDARIO1. gera grade de dias do mês corretamente no fuso de Brasília', () => {
  const mes = '2026-03';
  const hoje = '2026-03-15';
  const grade = SplashCalendario.gerarGradeMes(mes, hoje);

  assert.ok(Array.isArray(grade), 'Grade deve ser um array');
  assert.ok(grade.length % 7 === 0, 'Grade deve consistir em semanas completas (múltiplo de 7)');

  const dia15 = grade.find(d => d.data === '2026-03-15');
  assert.ok(dia15, 'Dia 15 de março deve existir na grade');
  assert.strictEqual(dia15.passado, false, 'Dia 15 de março não é passado em relação a 2026-03-15');

  const dia10 = grade.find(d => d.data === '2026-03-10');
  assert.ok(dia10, 'Dia 10 de março deve existir na grade');
  assert.strictEqual(dia10.passado, true, 'Dia 10 de março é passado em relação a 2026-03-15');

  assert.strictEqual(SplashCalendario.nomeMesPt('2026-03'), 'Março 2026');
  assert.strictEqual(SplashCalendario.somarMeses('2026-03', 1), '2026-04');
  assert.strictEqual(SplashCalendario.somarMeses('2026-03', -1), '2026-02');
});

test('SPLASH-SITE1. validação do HTML público de sites/splash/index.html', () => {
  const indexPath = path.join(__dirname, '../../sites/splash/index.html');
  const html = fs.readFileSync(indexPath, 'utf8');

  // 1. Calendário e formulário presentes
  assert.ok(html.includes('id="cal-dias-grid"'), 'HTML deve conter a grade do calendário');
  assert.ok(html.includes('id="form-pedir-reserva"'), 'HTML deve conter o formulário de reserva');

  // 2. Isca anti-robô (honeypot)
  assert.ok(html.includes('name="campo_extra"'), 'HTML deve conter o campo de isca anti-robô (campo_extra)');
  assert.ok(html.includes('name="site_url"'), 'HTML deve conter o campo de isca anti-robô (site_url)');

  // 3. Caixa de consentimento LGPD
  assert.ok(html.includes('id="req-consentimento"'), 'HTML deve conter checkbox de consentimento LGPD');
  assert.ok(html.includes('href="privacidade.html"'), 'HTML deve conter link para a política de privacidade');

  // 4. Texto informando sobre o sinal
  assert.ok(html.includes('A reserva só é confirmada depois do pagamento do sinal'), 'HTML deve conter o texto explicativo sobre o sinal');

  // 5. Selo Kernex visível e link correto
  assert.ok(html.includes('Feito com Kernex'), 'HTML deve conter a marca visível Feito com Kernex');
  assert.ok(html.includes('utm_source=splash&amp;utm_medium=selo') || html.includes('utm_source=splash&utm_medium=selo'), 'HTML deve conter a URL do selo com UTM');

  // 6. Sem "NEXIA" visível (com exceção de comentários/scripts internos se houver)
  const regexNexiaVisivel = />[^<]*NEXIA[^<]*</i;
  assert.ok(!regexNexiaVisivel.test(html), 'HTML não deve ter a palavra NEXIA visível no texto renderizado');

  // 7. Sem dados inventados ou padrão no código de contato do proprietário
  assert.ok(!html.includes('5511999994185'), 'Não deve conter números genéricos de teste/exemplo sensíveis');
  assert.ok(!html.includes('fs.writeFileSync') && !html.includes('require('), 'Não deve conter chamadas do Node fs no frontend');
});
