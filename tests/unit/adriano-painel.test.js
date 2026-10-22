'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const painelJsPath = path.join(__dirname, '../../sites/adrianoblumer/painel/painel.js');
const painelHtmlPath = path.join(__dirname, '../../sites/adrianoblumer/painel/index.html');
const nutriFnPath = path.join(__dirname, '../../netlify/functions/nutri.js');

const AdrianoPainel = require(painelJsPath);

test('PAINEL-NUTRI1. funções puras de sanitização e escape funcionam corretamente', () => {
  assert.equal(AdrianoPainel.escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(AdrianoPainel.sanitizarTexto('  Nutrição Esportiva \u0000 ', 50), 'Nutrição Esportiva');
  assert.equal(AdrianoPainel.validarUrlHttps('http://invalido.com'), '');
  assert.equal(AdrianoPainel.validarUrlHttps('https://biolink.website/nutriadriano'), 'https://biolink.website/nutriadriano');
});

test('PAINEL-NUTRI2. nomes de ações no painel conferem exatamente com a API nutri.js', () => {
  const acoesPainel = AdrianoPainel.acoesSuportadasApiNutri();
  const nutriCode = fs.readFileSync(nutriFnPath, 'utf8');

  acoesPainel.forEach(acao => {
    assert.ok(nutriCode.includes(`acao === '${acao}'`), `API nutri.js deve suportar a ação '${acao}'`);
  });
});

test('PAINEL-NUTRI3. aviso do CFN está presente de forma explícita no painel.js e na interface HTML', () => {
  const html = fs.readFileSync(painelHtmlPath, 'utf8');

  assert.ok(AdrianoPainel.AVISO_CFN_TEXTO.includes('CFN'), 'Aviso do CFN deve citar o conselho');
  assert.ok(AdrianoPainel.AVISO_CFN_TEXTO.includes('antes e depois'), 'Aviso do CFN deve explicitar fotos de antes e depois');

  assert.ok(html.includes('cfn-aviso-texto'), 'O HTML do painel deve conter o id do aviso do CFN');
  assert.ok(html.includes('Atenção: o conselho de nutrição (CFN) restringe fotos de antes e depois'), 'O HTML do painel deve ter a mensagem de alerta do CFN');
});

test('PAINEL-NUTRI4. higienização e prevenção de XSS na renderização do HTML', () => {
  const html = fs.readFileSync(painelHtmlPath, 'utf8');

  assert.ok(html.includes('AdrianoPainel.escapeHtml('), 'O HTML do painel deve usar AdrianoPainel.escapeHtml para valores de usuário');
  assert.ok(!html.includes('innerHTML = r.mensagem'), 'Não deve interpolar mensagem bruta de usuário diretamente via innerHTML');
});

test('PAINEL-NUTRI5. compatibilidade e suporte a telas de 360 px', () => {
  const html = fs.readFileSync(painelHtmlPath, 'utf8');

  assert.ok(html.includes('min-width: 320px;'), 'CSS deve prever suporte a telas pequenas a partir de 320px/360px');
  assert.ok(html.includes('nav-abas'), 'Navegação por abas mobile deve estar presente no HTML');
  assert.ok(html.includes('id="tab-editor"'), 'Aba para edição do site deve estar na barra de navegação');
});

test('PAINEL-NUTRI6. sanitização das regras de palavra-chave do Instagram DM', () => {
  const entrada = [
    { palavras: ['CONSULTA', '  VALOR '], mensagem: 'Olá! Veja o biolink.', link: 'https://biolink.website/nutriadriano', ativa: true },
    { palavras: ['sem-link-https'], mensagem: 'Link invalido', link: 'http://site-nao-https.com' },
  ];

  const regras = AdrianoPainel.sanitizarRegrasInstagram(entrada);
  assert.equal(regras.length, 2);
  assert.deepEqual(regras[0].palavras, ['consulta', 'valor']);
  assert.equal(regras[0].link, 'https://biolink.website/nutriadriano');
  assert.equal(regras[1].link, '');
});
