'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const siteHtmlPath = path.join(__dirname, '../../sites/splash/index.html');
const painelHtmlPath = path.join(__dirname, '../../sites/splash/agenda/index.html');

test('SPLASH-FRONT1. site público carrega conteúdo padrão se API falhar ou estiver offline', () => {
  const html = fs.readFileSync(siteHtmlPath, 'utf8');

  // Verifica resiliência no código JS do site
  assert.ok(html.includes('catch (e) { c = null; }'), 'Deve tratar exceção da API sem quebrar');
  assert.ok(html.includes('nxAplicar(c);'), 'Deve aplicar conteúdo nulo (padrão) caso a API falhe');
  assert.ok(html.includes('document.documentElement.classList.remove(\'nx-carregando\')'), 'Deve remover classe de carregamento mesmo se a API falhar');
});

test('SPLASH-FRONT2. marcações data-ed e data-secao existem em seções e elementos chave do site', () => {
  const html = fs.readFileSync(siteHtmlPath, 'utf8');

  // data-secao
  const secoes = ['menu', 'inicio', 'solicitar', 'espacos', 'videos', 'eventos', 'processo', 'depoimentos', 'contato', 'rodape'];
  secoes.forEach(sec => {
    assert.ok(html.includes(`data-secao="${sec}"`), `Deve conter data-secao="${sec}"`);
  });

  // data-ed em títulos, textos e botões
  assert.ok(html.includes('data-ed="hero-titulo"'), 'Deve conter data-ed para o título do hero');
  assert.ok(html.includes('data-ed="solicitar-titulo"'), 'Deve conter data-ed para o título da seção de reserva');
  assert.ok(html.includes('data-ed="espacos-titulo"'), 'Deve conter data-ed para o título da seção de espaços');
  assert.ok(html.includes('data-ed="rodape-brand"'), 'Deve conter data-ed para a marca do rodapé');
});

test('SPLASH-FRONT3. no-innerHTML para dados de usuário ou do editor para prevenção de XSS', () => {
  const htmlSite = fs.readFileSync(siteHtmlPath, 'utf8');
  const htmlPainel = fs.readFileSync(painelHtmlPath, 'utf8');

  // Site usa nxEscreverTexto que utiliza replaceChildren com textNodes
  assert.ok(htmlSite.includes('el.replaceChildren('), 'Site deve utilizar replaceChildren para inserção segura de texto');

  // Painel utiliza escapeHtml para renderização de dados
  assert.ok(htmlPainel.includes('SplashPainel.escapeHtml('), 'Painel deve higienizar dados com escapeHtml antes de interpolar HTML');
});

test('SPLASH-FRONT4. preservação da marca visível KERNEX e selo oficial no site', () => {
  const html = fs.readFileSync(siteHtmlPath, 'utf8');

  assert.ok(html.includes('Feito com Kernex'), 'Selo Feito com Kernex deve estar presente e visível');
  assert.ok(html.includes('https://kernex.com.br/?utm_source=splash&amp;utm_medium=selo') || html.includes('https://kernex.com.br/?utm_source=splash&utm_medium=selo'), 'URL do selo Kernex deve estar correta');
});

test('SPLASH-FRONT5. painel do editor possui os botões, instruções e modals para fotos e vídeos', () => {
  const htmlPainel = fs.readFileSync(painelHtmlPath, 'utf8');

  assert.ok(htmlPainel.includes('tab-editor'), 'Deve conter a aba tab-editor no menu inferior');
  assert.ok(htmlPainel.includes('Envie o vídeo do celular para o YouTube'), 'Deve conter a instrução em português simples para o envio de vídeo');
  assert.ok(htmlPainel.includes('id="midia-foto-input"'), 'Deve conter input para upload de fotos');
  assert.ok(htmlPainel.includes('id="midia-video-url"'), 'Deve conter input de link de vídeo');
  assert.ok(htmlPainel.includes('comprimirImagemClient'), 'Deve possuir a função client-side de compressão de foto para até 600 KB');
});

test('SPE-ESC: legendas de fotos e títulos de vídeos são escapados antes de ir para o HTML', () => {
  const fs = require('node:fs'), path = require('node:path');
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'sites', 'splash', 'index.html'), 'utf8');
  assert.match(html, /function esc\(/);
  assert.ok(!html.includes('${f.legenda}'), 'legenda sem escape');
  assert.ok(!html.includes('${v.titulo}'), 'título sem escape');
  assert.ok(!html.includes("alt=\"${f.legenda"), 'alt sem escape');
});
