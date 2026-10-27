const { test } = require('node:test');
const assert = require('node:assert/strict');

// Simula o buildSystemPrompt do Cortex (netlify/functions/cortex-chat.js).
// Regras de prompt que o time quer garantir para toda resposta gerada.
function buildSystemPrompt(mensagem, { tenantId = 'nexia', plan = 'gratuito' } = {}) {
  const dataHoje = new Date().toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const ehSaudacaoCurta = /^(oi|ol[aá]|eai|fala|bom dia|boa tarde|boa noite)\s*[!?]?$/i.test(mensagem.trim());
  const ehPedidoLongo = mensagem.length >= 200;

  const partes = [];
  partes.push(`Você é o Cortex, um assistente de inteligência artificial. Data de hoje (BRT): ${dataHoje}.`);
  partes.push(`TENANT: ${tenantId} | PLANO: ${plan.toUpperCase()}`);
  partes.push('- Responda no mesmo idioma da última mensagem da pessoa (português do Brasil quando escrever em português).');
  partes.push('- Seja direto e acionável. Sem rodeios.');

  // Regra absoluta: nunca usar LaTeX.
  partes.push('- Não use LaTeX. Escreva equações e fórmulas em texto simples, nunca com \\\\, \\begin, \\end, \\frac ou $.');

  if (ehSaudacaoCurta) {
    // Saudação curta: resposta curta, sem listar capacidades.
    partes.push('RESPOSTA ESPERADA: apenas uma saudação curta (ex.: "Olá!"). Não liste capacidades.');
  } else {
    partes.push('## CAPACIDADES');
    partes.push('- Estratégia e Negócios, Desenvolvimento, Segurança, CRM, Jurídico, Análise Financeira.');

    if (ehPedidoLongo) {
      // Pedido longo: estrutura com títulos, números e exemplos.
      partes.push('## ESTRUTURA PARA TEXTO LONGO');
      partes.push('- Use títulos claros para separar as seções.');
      partes.push('- Use listas numeradas para passos ou itens.');
      partes.push('- Inclua exemplos concretos para ilustrar cada ponto.');
    }
  }

  return partes.join('\n');
}

const PADROES_LATEX = [
  /\\begin\s*{\S*}/,
  /\\end\s*{\S*}/,
  /\\frac/,
  /\\sqrt/,
  /\\sum/,
  /\\int/,
  /\\documentclass/,
  /\\usepackage/,
  /\\\[/,
  /\\\]/,
  /\$\s/,
  /\s\$/,
  /\\emph/,
  /\\textbf/,
  /\\item/,
  /\\section/,
];

test('buildSystemPrompt inclui a frase "Não use LaTeX" e não contém padrões LaTeX', () => {
  const prompt = buildSystemPrompt('Explique como funciona fluxo de caixa.', {
    tenantId: 'nexia',
    plan: 'gratuito',
  });

  assert.ok(prompt.includes('Não use LaTeX'), 'deve conter a frase "Não use LaTeX"');

  for (const padrao of PADROES_LATEX) {
    assert.ok(!padrao.test(prompt), `não deve conter padrão LaTeX: ${padrao}`);
  }
});

test('saudação curta "oi" gera apenas uma saudação, sem a lista de capacidades', () => {
  const prompt = buildSystemPrompt('oi', { tenantId: 'nexia', plan: 'gratuito' });

  assert.ok(/Ol[áa]!?/.test(prompt), 'deve conter uma saudação curta (ex.: "Olá!")');
  assert.ok(!prompt.includes('CAPACIDADES'), 'não deve listar capacidades para saudação curta');
  assert.ok(!/Estratégia e Negócios/.test(prompt), 'não deve conter itens de capacidades');
});

test('pedido de plano/artigo/e-mail longo inclui instrução de estrutura com títulos, números e exemplos', () => {
  const longo =
    'Preciso de um artigo detalhado sobre como estruturar um plano de negócios para uma startup de tecnologia, ' +
    'incluindo análise de mercado, projeções financeiras, estratégia de precificação e plano de marketing. ' +
    'A gente precisa disso com bastante detalhe, com exemplos práticos e passo a passo para seguir. '.repeat(6);

  const prompt = buildSystemPrompt(longo, { tenantId: 'nexia', plan: 'gratuito' });

  assert.ok(/t[eé]tulos/.test(prompt), 'deve mencionar títulos');
  assert.ok(/numerad[oa]s/.test(prompt), 'deve mencionar listas numeradas');
  assert.ok(/exemplos/.test(prompt), 'deve mencionar exemplos');
});
