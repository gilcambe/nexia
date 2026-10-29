const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const VP_LANDING_PATH = path.join(__dirname, '../../viajante-pro/vp-landing.html');
const SITE_INDEX_PATH = path.join(__dirname, '../../sites/viajantepro/index.html');

test('Viajante Pro Site: vp-landing.html existe e contém estrutura comercial completa', (t) => {
  assert.ok(fs.existsSync(VP_LANDING_PATH), 'viajante-pro/vp-landing.html deve existir');
  const html = fs.readFileSync(VP_LANDING_PATH, 'utf8');

  // Validação do DOCTYPE e fechamento
  assert.ok(html.includes('<!DOCTYPE html>'), 'Deve conter <!DOCTYPE html>');
  assert.ok(html.trim().endsWith('</html>'), 'Deve fechar com </html>');

  // Validação da marca Kernex em vez de Nexia na apresentação
  assert.ok(html.includes('Kernex'), 'Deve referenciar a marca Kernex');
  assert.ok(html.includes('https://kernex.com.br/?utm_source=viajantepro&utm_medium=selo'), 'Deve conter link do selo Kernex');

  // Validação das Seções Comerciais
  assert.ok(html.includes('id="hero"'), 'Deve possuir seção Hero');
  assert.ok(html.includes('id="destinos"'), 'Deve possuir seção de Destinos');
  assert.ok(html.includes('id="pacotes"'), 'Deve possuir seção de Pacotes');
  assert.ok(html.includes('id="servicos"'), 'Deve possuir seção de Serviços');
  assert.ok(html.includes('id="como-funciona"'), 'Deve possuir seção Como Funciona');
  assert.ok(html.includes('id="sobre"'), 'Deve possuir seção Sobre');
  assert.ok(html.includes('id="faq"'), 'Deve possuir seção FAQ');
  assert.ok(html.includes('id="orcamento"'), 'Deve possuir seção de Orçamento');
  assert.ok(html.includes('id="contato"'), 'Deve possuir seção de Contato');

  // Validação da integração do formulário de orçamento com /api/leads
  assert.ok(html.includes('/api/leads'), 'Deve conter chamada para o endpoint /api/leads');
  assert.ok(html.includes('orcDestino'), 'Formulário deve ter campo de destino');
  assert.ok(html.includes('orcOrigem'), 'Formulário deve ter campo de origem');
  assert.ok(html.includes('orcPeriodo'), 'Formulário deve ter campo de período');
  assert.ok(html.includes('orcViajantes'), 'Formulário deve ter campo de viajantes');
  assert.ok(html.includes('orcServico'), 'Formulário deve ter campo de serviço');
  assert.ok(html.includes('orcNome'), 'Formulário deve ter campo de nome');
  assert.ok(html.includes('orcEmail'), 'Formulário deve ter campo de e-mail');
  assert.ok(html.includes('orcTelefone'), 'Formulário deve ter campo de telefone');
});

test('Viajante Pro Site: filtro de categorias por lista exata (split)', (t) => {
  const html = fs.readFileSync(VP_LANDING_PATH, 'utf8');
  assert.ok(html.includes('.split('), 'Função de filtro deve dividir data-cat por espaço para evitar correspondência parcial de substring');
});

test('Viajante Pro Site: sites/viajantepro/index.html e rota /api/leads estao alinhados', (t) => {
  assert.ok(fs.existsSync(SITE_INDEX_PATH), 'sites/viajantepro/index.html deve existir');
  const html = fs.readFileSync(SITE_INDEX_PATH, 'utf8');

  assert.ok(html.includes('Viajante Pro'), 'Deve conter nome Viajante Pro');
  assert.ok(html.includes('/api/leads'), 'Deve ter integração com /api/leads');
  assert.ok(html.includes('Feito com Kernex'), 'Deve conter o selo Feito com Kernex');
});
