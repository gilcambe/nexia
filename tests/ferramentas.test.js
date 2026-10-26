import test from 'node:test';
import assert from 'node:assert/strict';

const CAMINHO = '../nexia-ai/cortex/ferramentas.js';

async function carregarComFetch(mockFetch) {
  await test.mock.module('node-fetch', () => mockFetch);
  return await import(CAMINHO);
}

test('buscar_web retorna resultados e notícias', async (t) => {
  const urls = [];
  const fetch = async (url) => {
    urls.push(url);
    if (url.includes('duckduckgo.com')) {
      return { json: async () => ({ Abstract: 'Resultado teste', AbstractText: 'texto', Result: 'res' })};
    }
    if (url.includes('news.google.com/rss')) {
      return { text: async () => '<rss><channel><item><title>Notícia 1</title><link>https://exemplo.com/noticia1</link></item></channel></rss>'};
    }
    throw new Error('URL não mockada: ' + url);
  };
  const { buscar_web } = await carregarComFetch(fetch);
  const resultado = await buscar_web('teste');
  assert.ok(resultado.search);
  assert.ok(resultado.news);
  assert.equal(resultado.search.query, 'teste');
  assert.ok(Array.isArray(resultado.search.results));
  assert.ok(resultado.news.rss.includes('Notícia 1'));
});

test('abrir_pagina extrai texto e limita a 8000 caracteres', async (t) => {
  const html = '<html><body><h1>Título da Página</h1><p>Conteúdo importante da página.</p></body></html>';
  const fetch = async () => ({ ok: true, text: async () => html });
  await test.mock.module('node-fetch', () => fetch);
  await test.mock.module('jsdom', () => ({
    JSDOM: class {
      constructor(html) {
        this.window = { document: { body: { textContent: 'Título da Página Conteúdo importante da página.' } } };
      }
    }
  }));
  const { abrir_pagina } = await import(CAMINHO);
  const resultado = await abrir_pagina('https://exemplo.com');
  assert.equal(resultado.url, 'https://exemplo.com');
  assert.ok(resultado.content.includes('Título da Página'));
  assert.ok(resultado.content.includes('Conteúdo importante da página'));
  assert.ok(resultado.length <= 8000);
  assert.ok(!resultado.error);
});

test('abrir_pagina bloqueia localhost', async (t) => {
  const fetch = async () => ({ ok: true, text: async () => '' });
  await test.mock.module('node-fetch', () => fetch);
  const { abrir_pagina } = await import(CAMINHO);
  const resultado = await abrir_pagina('http://localhost:3000/pagina');
  assert.ok(resultado.error);
  assert.equal(resultado.message, 'Falha ao acessar página');
});

test('abrir_pagina bloqueia file:', async (t) => {
  const fetch = async () => ({ ok: true, text: async () => '' });
  await test.mock.module('node-fetch', () => fetch);
  const { abrir_pagina } = await import(CAMINHO);
  const resultado = await abrir_pagina('file:///etc/passwd');
  assert.ok(resultado.error);
});

test('abrir_pagina bloqueia IP interno 192.168.x', async (t) => {
  const fetch = async () => ({ ok: true, text: async () => '' });
  await test.mock.module('node-fetch', () => fetch);
  const { abrir_pagina } = await import(CAMINHO);
  const resultado = await abrir_pagina('http://192.168.1.1/admin');
  assert.ok(resultado.error);
});

test('abrir_pagina bloqueia IP interno 10.x', async (t) => {
  const fetch = async () => ({ ok: true, text: async () => '' });
  await test.mock.module('node-fetch', () => fetch);
  const { abrir_pagina } = await import(CAMINHO);
  const resultado = await abrir_pagina('http://10.0.0.1/');
  assert.ok(resultado.error);
});

test('abrir_pagina bloqueia IP interno 172.x', async (t) => {
  const fetch = async () => ({ ok: true, text: async () => '' });
  await test.mock.module('node-fetch', () => fetch);
  const { abrir_pagina } = await import(CAMINHO);
  const resultado = await abrir_pagina('http://172.16.0.1/');
  assert.ok(resultado.error);
});

test('calcular soma, subtração, multiplicação, divisão', (t) => {
  const { calcular } = require(CAMINHO);
  assert.equal(calcular('2 + 2').result, 4);
  assert.equal(calcular('10 - 3').result, 7);
  assert.equal(calcular('3 * 4').result, 12);
  assert.equal(calcular('10 / 2').result, 5);
  assert.ok(!calcular('2 + 2').error);
});

test('calcular potencia e modulo', (t) => {
  const { calcular } = require(CAMINHO);
  assert.equal(calcular('2 ^ 3').result, 8);
  assert.equal(calcular('10 % 3').result, 1);
  assert.ok(!calcular('2 ^ 3').error);
  assert.ok(!calcular('10 % 3').error);
});

test('calcular com parenteses', (t) => {
  const { calcular } = require(CAMINHO);
  assert.equal(calcular('(2 + 3) * 4').result, 20);
  assert.ok(!calcular('(2 + 3) * 4').error);
});

test('calcular rejeita expressões perigosas', (t) => {
  const { calcular } = require(CAMINHO);
  const r1 = calcular('console.log(1)');
  assert.ok(r1.error);
  const r2 = calcular('2 + alert(1)');
  assert.ok(r2.error);
  const r3 = calcular('process.exit()');
  assert.ok(r3.error);
  const r4 = calcular('2 + ;');
  assert.ok(r4.error || !r4.result);
});

test('cotacao retorna dados da moeda USD', async (t) => {
  const fetch = async (url) => {
    if (url.includes('awesomeapi.com.br/last/USD-BRL')) {
      return { json: async () => ({ USDBRL: { code: 'USD', codein: 'BRL', name: 'Dólar Americano', high: '5.2000', low: '5.1000', varBid: '0.0500', pctChange: '1.0000', createDate: '2024-01-01 10:00:00' } })};
    }
    throw new Error('URL não mockada: ' + url);
  };
  const { cotacao } = await carregarComFetch(fetch);
  const resultado = await cotacao('USD');
  assert.equal(resultado.currency, 'USD');
  assert.equal(resultado.name, 'Dólar Americano');
  assert.equal(resultado.high, '5.2000');
  assert.ok(resultado.fetchedAt);
  assert.ok(!resultado.error);
});

test('cotacao retorna erro para moeda não encontrada', async (t) => {
  const fetch = async () => ({ json: async () => ({}) });
  const { cotacao } = await carregarComFetch(fetch);
  const resultado = await cotacao('XXX');
  assert.ok(resultado.error);
  assert.equal(resultado.currency, 'XXX');
});

test('clima retorna dados da cidade', async (t) => {
  const fetch = async (url) => {
    if (url.includes('geocoding-api.open-meteo.com')) {
      return { json: async () => ({ results: [{ name: 'São Paulo', country: 'Brasil', latitude: -23.55, longitude: -46.63, elevation: 760 }] })};
    }
    if (url.includes('api.open-meteo.com/v1/forecast')) {
      return { json: async () => ({ current: { temperature_2m: 25, relative_humidity_2m: 60, wind_speed_10m: 10, weather_code: 0, time: '2024-01-01T10:00' }, daily: { time: ['2024-01-01'], temperature_2m_max: [30], temperature_2m_min: [20], precipitation_sum: [0] } })};
    }
    throw new Error('URL não mockada: ' + url);
  };
  const { clima } = await carregarComFetch(fetch);
  const resultado = await clima('São Paulo');
  assert.equal(resultado.location.name, 'São Paulo');
  assert.equal(resultado.location.country, 'Brasil');
  assert.equal(resultado.current.temperature, 25);
  assert.equal(resultado.current.humidity, 60);
  assert.equal(resultado.daily.maxTemp, 30);
  assert.equal(resultado.daily.minTemp, 20);
  assert.ok(!resultado.error);
});

test('clima retorna erro para cidade inexistente', async (t) => {
  const fetch = async () => ({ json: async () => ({ results: [] }) });
  const { clima } = await carregarComFetch(fetch);
  const resultado = await clima('CidadeInexistenteXYZ');
  assert.ok(resultado.error);
  assert.equal(resultado.city, 'CidadeInexistenteXYZ');
});

test('data_hora retorna horário de Brasília', (t) => {
  const { data_hora } = require(CAMINHO);
  const resultado = data_hora();
  assert.equal(resultado.timezone, 'America/Sao_Paulo');
  assert.ok(resultado.formatted.date);
  assert.ok(resultado.formatted.time);
  assert.ok(resultado.formatted.full);
  assert.ok(resultado.timestamp);
  assert.ok(resultado.datetime);
  assert.ok(resultado.date);
  assert.ok(resultado.time);
});

test('tools exporta objeto compatível com OpenAI tool calling', (t) => {
  const { tools } = require(CAMINHO);
  const nomes = ['buscar_web', 'abrir_pagina', 'calcular', 'cotacao', 'clima', 'data_hora'];
  for (const nome of nomes) {
    assert.ok(tools[nome], `Ferramenta ${nome} não exportada`);
    const tool = tools[nome];
    assert.equal(tool.type, 'function');
    assert.equal(tool.function.name, nome);
    assert.ok(tool.function.description, `Descrição ausente em ${nome}`);
    assert.ok(tool.function.parameters, `Parâmetros ausentes em ${nome}`);
    assert.equal(tool.function.parameters.type, 'object');
  }
});
