#!/usr/bin/env node
'use strict';
// NEXIA: teste de pessoa da CENTRAL DE LEILÕES da Bezsan (celular). O Gilmar entra no painel, toca em "Leilões",
// carrega a lista da Caixa, filtra, analisa um imóvel, envia o edital e a matrícula em PDF, consulta o processo,
// preenche dívidas, vê o "vale a pena", pede o parecer, marca o passo a passo, salva, reabre, gera o relatório e apaga.
// A API roda aqui (handlers reais + banco em memória + IA e CNJ simulados), então não toca em nada de produção.
// Uso: node tests/e2e/bezsan-leiloes-humano.js [pasta-para-fotos]
//   PDFJS_DIR=<pasta com pdf.min.js e pdf.worker.min.js> serve o leitor de PDF sem internet (senão usa o cdnjs).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const agenda = require('../../netlify/functions/agenda.js');
const leilao = require('../../netlify/functions/leilao.js');
const { AGENDAS } = require('../../clientes/agendas.js');
const { fakeDb } = require('../helpers/agenda-fake-db.js');
const { fetchRegiao } = require('../helpers/regiao-fake.js');
// O servidor na nuvem não consegue o mapa (como no ar): quem acha o endereço e os serviços é o navegador.
const regiao = fetchRegiao({ semMapa: true });
const mapa = fetchRegiao();
const pedidosMapa = [];

const RAIZ = path.join(__dirname, '../../sites/bezsan');
const FOTOS = process.argv[2] || '';
const PDFJS_DIR = process.env.PDFJS_DIR || '';
const API_AGENDA = 'https://nexia.gcbezerra.workers.dev/api/agenda';
const API_LEILAO = 'https://nexia.gcbezerra.workers.dev/api/leilao';
const CADASTRO = { ...AGENDAS.bezsan, codigo_salt: AGENDAS['agenda-teste'].codigo_salt, codigo_hash: AGENDAS['agenda-teste'].codigo_hash };
const db = fakeDb();
const mw = () => ({ verifyBearerToken: async () => ({ ok: false }) });
const hAgenda = agenda.createHandler({ getDb: () => db, getMw: mw, getCadastro: s => (s === 'bezsan' ? CADASTRO : undefined) });

// IA simulada: responde como a IA grátis responderia e guarda o que recebeu (para ver que o PDF foi lido de verdade).
const pedidosIa = [];
const router = {
  capabilities: () => ({ available: true, vision: true }),
  chat: async (d, o) => {
    pedidosIa.push(o);
    if (/PARECER DE CONSULTORIA/.test(o.system)) return { text: 'VEREDITO\nVale só com cuidado. Lance máximo recomendado conforme a conta.\nANTES DE DAR O LANCE\nLeia a matrícula.\nAnálise automática: confirme com um advogado antes de dar lance.' };
    if (/EDITAL/.test(o.system)) return { text: JSON.stringify({ tipo_leilao: 'judicial', processo: '1000123-45.2023.8.26.0100', endereco: 'Rua das Palmeiras, 200, apto 31', cidade: 'São Paulo', uf: 'SP', praca1_data: '2026-11-10', praca1_valor: 420000, praca2_data: '2026-11-24', praca2_valor: 210000, avaliacao: 420000, comissao_pct: 5, ocupado: true, pagamento: 'À vista ou 25% de entrada e 30 parcelas', debitos_iptu: 'Sub-rogam no preço (art. 130 do CTN)', onus: ['Penhora do Banco X (R.5)'], riscos: ['Imóvel ocupado pelo executado'], resumo: 'Leilão judicial de apartamento ocupado.' }) };
    if (/MATRÍCULA/.test(o.system)) return { text: '```json\n' + JSON.stringify({ matricula: '123.456', cartorio: '5º RI de São Paulo', proprietarios: ['João Executado'], onus: ['Hipoteca da Caixa (R.3)'], alertas: ['Indisponibilidade de bens (AV.6)'], resumo: 'Matrícula com hipoteca e indisponibilidade.' }) + '\n```' };
    return { text: 'Atenção: o desconto é bom, mas o imóvel está ocupado e há indisponibilidade na matrícula. Lance máximo recomendado conforme a conta. Análise automática: confirme com um advogado antes de dar lance.' };
  },
};
const FREE = { reasoning: [{ provider: 'groq', model: 'simulado' }] };
const datajud = [];
let EDITAL_LOTE = null; // PDF do edital "publicado" pelo leiloeiro (gerado no teste)
const ANEXO = 'https://s3-sa-east-1.amazonaws.com/906de634c48fb7d34136160b4c353ae4/public/anexo/4399341790094440.pdf';
const fetchCnj = async (url, o) => {
  if (/leiloesjudiciais\.com\.br\/api\/mcp/.test(url)) {
    const args = JSON.parse(o.body).params.arguments;
    const lote = { lote_id: 218898, leilao_id: 99916, nm_titulo_lote: 'Apartamento nº 21 c/ 165m² - São Paulo/SP', nm_titulo_leilao: '711ª LEILÃO JUDICIAL UNIFICADO DO TRT DA 2ª REGIÃO', nm_descricao: '<p>(Proc. 1000818-76.2020.5.02.0090 - 90ª VT São Paulo/SP)</p><p>VALOR DA AVALIAÇÃO: R$ 1.700.000,00</p><p>Há indisponibilidade.</p>', vl_lanceminimo: '1700000.00', vl_lanceinicial: '1275000.00', bn_exibeavaliacao: true, nm_cidade: 'São Paulo', nm_estado: 'SP', nm_subcategoria: 'Apartamentos', nm_statuslote: 'Aberto para Lance', nm_leiloeiro: 'Daniel Oliveira Júnior', dt_fechamento: '2026-11-17 13:05:50-03', anexos: [{ nm: 'EDITAL', nm_path_completo: ANEXO }] };
    return { ok: true, json: async () => ({ result: { content: [{ type: 'text', text: JSON.stringify({ totalResults: 1, results: args.query === 'nada' ? [] : [lote] }) }] } }) };
  }
  if (url === ANEXO) return { ok: true, arrayBuffer: async () => EDITAL_LOTE };
  if (/ibge\.gov\.br|bcb\.gov\.br|nominatim|overpass/.test(url)) return regiao.fn(url, o);
  datajud.push({ url, corpo: JSON.parse(o.body) });
  return { ok: true, json: async () => ({ hits: { hits: [{ _source: { numeroProcesso: '10001234520238260100', tribunal: 'TJSP', classe: { nome: 'Cumprimento de sentença' }, orgaoJulgador: { nome: '41ª Vara Cível - Foro Central' }, assuntos: [{ nome: 'Condomínio' }], movimentos: [{ dataHora: '2026-09-01T10:00:00Z', nome: 'Designada hasta pública' }, { dataHora: '2025-03-01T10:00:00Z', nome: 'Penhora' }] } }] } }) };
};
const hLeilao = leilao.createHandler({ getDb: () => db, getMw: mw, getCadastro: s => (s === 'bezsan' ? CADASTRO : undefined), getRouter: () => router, getFree: () => FREE, fetch: fetchCnj, env: {} });

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.txt': 'text/plain' };
const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const arq = path.join(RAIZ, p);
  if (!arq.startsWith(RAIZ) || !fs.existsSync(arq)) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream' });
  fs.createReadStream(arq).pipe(res);
});

const falhas = [];
let nOk = 0;
function confere(cond, msg) { if (cond) nOk++; else falhas.push(msg); console.log((cond ? '  ✓ ' : '  ✗ ') + msg); return cond; }

// Lista da Caixa como ela vem (latin1, linhas de título antes do cabeçalho).
const CSV = Buffer.from([
  ' Lista de Imóveis da Caixa - SP', ' ',
  ' N° do imóvel;UF;Cidade;Bairro;Endereço;Preço;Valor de avaliação;Desconto;Financiamento;Descrição;Modalidade de venda;Link de acesso',
  '8555500000001 ;SP;SAO PAULO ;MOOCA ;RUA DOS TRILHOS, N. 100 ; 180.000,00 ; 320.000,00 ;43.75;Sim;Apartamento, 62.00 de área privativa, 2 qto(s), 1 vaga;Venda Direta Online;https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnimovel=8555500000001',
  '8555500000002 ;SP;SAO PAULO ;LAPA ;RUA CLELIA, N. 50 ; 410.000,00 ; 430.000,00 ;4.65;Não;Casa, 120.00 de área total;Leilão SFI - Edital Único;https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnimovel=8555500000002',
  '8555500000003 ;SP;CAMPINAS ;CAMBUI ;AV NORTE SUL, N. 9 ; 150.000,00 ; 300.000,00 ;50;Sim;Apartamento, 48.00 de área privativa;Licitação Aberta;https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnimovel=8555500000003',
].join('\r\n'), 'latin1');

(async () => {
  await new Promise(r => servidor.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'leilao-'));
  if (FOTOS) fs.mkdirSync(FOTOS, { recursive: true });
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const erros = [];

  // PDFs de verdade (um edital e uma matrícula), gerados pelo próprio navegador.
  const gerador = await browser.newPage();
  const pdf = async (nome, titulo, corpo) => {
    await gerador.setContent(`<h1>${titulo}</h1>` + corpo.map(p => `<p>${p}</p>`).join(''));
    const arq = path.join(tmp, nome);
    fs.writeFileSync(arq, await gerador.pdf({ format: 'A4' }));
    return arq;
  };
  const edital = await pdf('edital.pdf', 'EDITAL DE LEILÃO JUDICIAL - PALMEIRAS-31', Array.from({ length: 12 }, (_, i) => `Cláusula ${i + 1}. O imóvel da Rua das Palmeiras, 200, apto 31, São Paulo/SP, matrícula 123.456 do 5º RI, será levado a leilão. Primeira praça em 10/11/2026 pelo valor de avaliação de R$ 420.000,00; segunda praça em 24/11/2026 por 50% da avaliação. Comissão do leiloeiro de 5%.`));
  const matricula = await pdf('matricula.pdf', 'MATRÍCULA 123.456 - 5º OFICIAL DE REGISTRO DE IMÓVEIS', Array.from({ length: 8 }, (_, i) => `R.${i + 1} - Registro ${i + 1} da matrícula 123.456. Proprietário João Executado. Hipoteca em favor da Caixa. AV.6 indisponibilidade de bens.`));
  EDITAL_LOTE = fs.readFileSync(edital);
  await gerador.close();

  const celular = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', acceptDownloads: true };
  const ctx = await browser.newContext(celular);
  await ctx.route('**/*', async (route) => {
    const u = route.request().url();
    const h = u.startsWith(API_AGENDA) ? hAgenda : u.startsWith(API_LEILAO) ? hLeilao : null;
    if (h) {
      const url = new URL(u);
      const r = await h({ httpMethod: route.request().method(), headers: { 'cf-connecting-ip': '127.0.0.' + (1 + Math.floor(Math.random() * 200)) }, queryStringParameters: Object.fromEntries(url.searchParams), body: route.request().postData() });
      return route.fulfill({ status: r.statusCode, headers: r.headers, body: r.isBase64Encoded ? Buffer.from(r.body, 'base64') : (r.body || '') });
    }
    if (u.startsWith('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/')) {
      if (!PDFJS_DIR) return route.continue();
      return route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(path.join(PDFJS_DIR, path.basename(new URL(u).pathname))) });
    }
    if (/^https:\/\/(nominatim\.openstreetmap\.org|overpass-api\.de)\//.test(u)) {
      pedidosMapa.push(u);
      const r = await mapa.fn(u, { body: route.request().postData() });
      return route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }, body: JSON.stringify(await r.json()) });
    }
    if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    return route.abort();
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', e => erros.push(e.message));
  pg.on('dialog', d => d.accept());
  let n = 0;
  const foto = async (nome) => { if (FOTOS) await pg.screenshot({ path: path.join(FOTOS, String(++n).padStart(2, '0') + '-' + nome + '.png'), fullPage: false }); };
  const abrirSecao = async (titulo) => { const s = pg.locator('#pg-imovel summary', { hasText: titulo }).first(); if (!(await s.evaluate(e => e.parentElement.open))) await s.click(); };
  const contaLista = (n, texto) => pg.waitForFunction(([n, t]) => { const l = document.querySelectorAll('#b-lista .item'); return l.length === n && (!t || document.querySelector('#b-lista').textContent.includes(t)); }, [n, texto], { timeout: 5000 }).then(() => true, () => false);

  console.log('1. Sem login, a Central manda entrar pelo painel');
  await pg.goto(base + '/leiloes/', { waitUntil: 'load' });
  confere(await pg.isVisible('#tela-sem-login'), 'sem login aparece "Entre pelo painel"');
  await pg.click('#tela-sem-login a.btn');
  await pg.waitForSelector('#tela-login:not(.oculto)');
  confere(pg.url().endsWith('/agenda/'), 'botão "Abrir o painel" leva ao painel');

  console.log('2. Gilmar entra no painel e toca em "Leilões"');
  await pg.click('#aba-primeiro');
  await pg.fill('#codigo', 'TESTEAGENDA'); await pg.fill('#nova1', 'leilao2026'); await pg.fill('#nova2', 'leilao2026');
  await pg.click('#form-primeiro button');
  await pg.waitForSelector('#app:not(.oculto)');
  confere(await pg.isVisible('#nav-extra') && (await pg.textContent('#nav-extra')) === 'Leilões', 'painel mostra o botão "Leilões" no menu de baixo');
  await pg.click('#nav-extra');
  await pg.waitForSelector('#app:not(.oculto) #pg-buscar');
  confere(pg.url().endsWith('/leiloes/'), 'botão "Leilões" abre a Central');
  await foto('central-buscar');

  console.log('3. Busca automática em vários leiloeiros');
  await pg.fill('#a-busca', 'nada');
  await pg.click('#a-buscar');
  await pg.waitForSelector('#a-msg.aviso:has-text("Nada encontrado")');
  confere(true, 'busca sem resultado avisa claramente');
  await pg.fill('#a-busca', 'apartamento');
  await pg.selectOption('#a-uf', 'SP');
  await pg.press('#a-busca', 'Enter');
  await pg.waitForSelector('#a-lista .item');
  const card = await pg.textContent('#a-lista .item');
  confere(card.includes('Apartamento nº 21') && card.includes('25% abaixo') && card.includes('R$ 1.275.000') && card.includes('17/11/2026 13h05'), 'leilão encontrado com lance, desconto e data de encerramento');
  confere((await pg.getAttribute('#a-lista a:has-text("Ver no site do leilão")', 'href')) === 'https://www.leiloesjudiciais.com.br/lote/99916/218898', '"Ver no site do leilão" aponta para o lote');
  await foto('busca-automatica');
  await pg.click('#a-lista .item button:has-text("Analisar")');
  await pg.waitForSelector('#pg-imovel:not(.oculto)');
  confere((await pg.textContent('#im-titulo')).includes('Apartamento nº 21') && (await pg.inputValue('#im-endereco')) === '', 'lote abre com o título do anúncio e o endereço em branco até ler o edital');
  confere((await pg.inputValue('#im-processo')) === '1000818-76.2020.5.02.0090' && (await pg.inputValue('#im-lance')) === '1.275.000' && (await pg.inputValue('#im-avaliacao')) === '1.700.000', 'Analisar traz processo, lance e avaliação do lote');
  await pg.click('#im-anexos button:has-text("Ler edital do leilão")');
  await pg.waitForSelector('#im-doc-msg.ok, #im-doc-msg.erro', { timeout: 30000 });
  confere(await pg.isVisible('#im-doc-msg.ok') && pedidosIa.some(o => /EDITAL/.test(o.system) && o.messages[0].content.includes('PALMEIRAS-31')), '"Ler edital do leilão" baixa o PDF do lote e a IA lê');
  confere((await pg.inputValue('#im-endereco')).includes('Palmeiras'), 'endereço do lote vem do edital (não o título do anúncio), para achar no mapa');
  await pg.click('#voltar');
  await pg.click('#nav-buscar');

  console.log('4. Buscar na lista da Caixa');
  confere((await pg.getAttribute('#b-baixar', 'href')) === 'https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_SP.csv', 'botão 1 aponta para a lista da Caixa de SP');
  await pg.selectOption('#b-uf', 'MG');
  confere((await pg.getAttribute('#b-baixar', 'href')).endsWith('Lista_imoveis_MG.csv'), 'trocar o estado troca o link da lista');
  await pg.selectOption('#b-uf', 'SP');
  await pg.setInputFiles('#b-arquivo', { name: 'texto.txt', mimeType: 'text/plain', buffer: Buffer.from('qualquer coisa') });
  await pg.waitForSelector('#b-msg.erro');
  confere(true, 'arquivo errado mostra aviso claro');
  await pg.setInputFiles('#b-arquivo', { name: 'Lista_imoveis_SP.csv', mimeType: 'text/csv', buffer: CSV });
  await pg.waitForSelector('#b-msg.ok');
  confere((await pg.textContent('#b-msg')).includes('3 imóveis'), 'lista da Caixa (latin1) carregada: 3 imóveis');
  confere((await pg.locator('#b-lista .item').count()) === 3 && (await pg.locator('#b-lista .item').first().textContent()).includes('AV NORTE SUL'), 'resultados em ordem de maior desconto');
  await pg.fill('#f-cidade', 'são paulo');
  confere(await contaLista(2, 'RUA CLELIA'), 'filtro de cidade (com acento) funciona');
  await pg.fill('#f-desconto', '30');
  confere(await contaLista(1, 'RUA DOS TRILHOS'), 'filtro de desconto mínimo funciona');
  await pg.fill('#f-desconto', '');
  await contaLista(2);
  await pg.selectOption('#f-modalidade', 'Leilão SFI - Edital Único');
  confere(await contaLista(1, 'RUA CLELIA'), 'filtro de modalidade funciona');
  await pg.selectOption('#f-modalidade', '');
  await contaLista(2);
  await pg.fill('#f-preco', '200.000');
  confere(await contaLista(1, 'RUA DOS TRILHOS'), 'filtro de preço máximo funciona');
  await pg.fill('#f-preco', '');
  await contaLista(2);
  await pg.fill('#f-texto', 'vaga');
  confere(await contaLista(1, 'RUA DOS TRILHOS'), 'busca por palavra na descrição funciona');
  const verNaCaixa = pg.locator('#b-lista .item a:has-text("Ver na Caixa")');
  confere((await verNaCaixa.getAttribute('href')).includes('hdnimovel=8555500000001') && (await verNaCaixa.getAttribute('target')) === '_blank', '"Ver na Caixa" abre o anúncio em outra aba');
  confere((await pg.locator('#portais .item').count()) >= 1, 'lista de outros bancos e leiloeiros aparece');
  await foto('busca-filtrada');

  console.log('5. Analisar o imóvel da Caixa');
  await pg.click('#b-lista .item button:has-text("Analisar")');
  await pg.waitForSelector('#pg-imovel:not(.oculto)');
  confere((await pg.inputValue('#im-endereco')).includes('RUA DOS TRILHOS') && (await pg.inputValue('#im-lance')) === '180.000', 'imóvel abre com endereço e preço da Caixa');
  confere((await pg.inputValue('#im-comissao')) === '0', 'venda direta da Caixa sem comissão de leiloeiro');
  confere((await pg.textContent('#im-veredito-txt')) === 'Vale a pena', 'com 43,75% de desconto a conta diz "Vale a pena"');
  await foto('imovel-caixa');
  await pg.click('#im-salvar');
  await pg.waitForSelector('#toast:not(.oculto)');
  confere((await pg.textContent('#toast')) === 'Imóvel salvo.', 'salvar o imóvel da Caixa');

  console.log('6. Imóvel de leiloeiro: edital e matrícula em PDF');
  await pg.click('#nav-imoveis');
  await pg.waitForSelector('#lista-imoveis .item');
  confere((await pg.locator('#lista-imoveis .item').count()) === 1 && /Nota \d+/.test(await pg.textContent('#lista-imoveis')) && /Vale|Não vale|Faltam/.test(await pg.textContent('#lista-imoveis')), 'lista "Imóveis" mostra o imóvel salvo, a nota e o veredito do parecer');
  await pg.click('#novo-imovel');
  await pg.waitForSelector('#pg-imovel:not(.oculto)');
  confere((await pg.inputValue('#im-endereco')) === '' && await pg.isHidden('#im-apagar'), '"Imóvel de outro site" abre em branco');
  await pg.setInputFiles('#im-edital', edital);
  await pg.waitForSelector('#im-doc-msg.ok, #im-doc-msg.erro', { timeout: 30000 });
  confere(await pg.isVisible('#im-doc-msg.ok'), 'edital em PDF lido e analisado: ' + (await pg.textContent('#im-doc-msg')).slice(0, 80));
  const pedidoEdital = pedidosIa.find(o => /EDITAL/.test(o.system));
  confere(!!pedidoEdital && pedidoEdital.messages[0].content.includes('PALMEIRAS-31') && pedidoEdital.messages[0].content.includes('Cláusula 12'), 'a IA recebeu o texto inteiro do PDF do edital');
  confere((await pg.inputValue('#im-endereco')).includes('Palmeiras') && (await pg.inputValue('#im-cidade')) === 'São Paulo', 'endereço e cidade preenchidos pelo edital');
  confere((await pg.inputValue('#im-lance')) === '210.000' && (await pg.inputValue('#im-avaliacao')) === '420.000', 'lance (2ª praça) e avaliação preenchidos');
  confere(await pg.isChecked('#im-ocupado'), 'marcado como ocupado');
  confere((await pg.inputValue('#im-processo')) === '1000123-45.2023.8.26.0100', 'número do processo vem do edital');
  confere((await pg.textContent('#im-edital-res')).includes('24/11/2026'), 'resumo do edital mostra a data da 2ª praça');
  await pg.setInputFiles('#im-matricula', matricula);
  await pg.waitForFunction(() => /Matrícula lida/.test(document.querySelector('#im-matricula-res').textContent), null, { timeout: 30000 });
  confere(pedidosIa.some(o => /MATRÍCULA/.test(o.system) && o.messages[0].content.includes('João Executado')), 'a IA recebeu o texto do PDF da matrícula');
  const alertas = await pg.inputValue('#im-alertas');
  confere(alertas.includes('Penhora do Banco X') && alertas.includes('Indisponibilidade de bens'), 'riscos do edital e da matrícula juntos na lista');
  confere((await pg.textContent('#im-veredito-txt')) !== 'Vale a pena' && (await pg.textContent('#im-motivos')).includes('ocupado'), 'ocupado e com riscos: a Central não diz "Vale a pena"');
  await foto('imovel-documentos');

  console.log('7. Colar texto');
  await pg.click('#im-colar-abrir');
  await pg.fill('#im-colar-texto', 'curto');
  await pg.click('#im-colar-ler');
  confere((await pg.textContent('#im-doc-msg')).includes('curto demais'), 'texto curto demais é recusado com aviso');
  await pg.click('#im-colar-abrir');
  confere(await pg.isHidden('#im-colar'), '"Colar texto" abre e fecha');

  console.log('8. Processo no CNJ');
  await abrirSecao('Processo judicial (CNJ)');
  await pg.click('#im-processo-btn');
  await pg.waitForFunction(() => /Cumprimento de sentença/.test(document.querySelector('#im-processo-res').textContent), null, { timeout: 10000 });
  confere(datajud[0] && /api_publica_tjsp/.test(datajud[0].url) && datajud[0].corpo.query.match.numeroProcesso === '10001234520238260100', 'consulta vai ao TJSP no DataJud com o número limpo');
  confere((await pg.textContent('#im-processo-res')).includes('Designada hasta pública'), 'mostra a última movimentação do processo');

  console.log('8b. Região e parecer completo');
  confere(/Nota|\d+/.test(await pg.textContent('#pc-nota')) && (await pg.textContent('#pc-pilares')).includes('Parte jurídica'), 'parecer completo aparece no topo com os pilares');
  confere(/grave/.test(await pg.getAttribute('#pc-pilares [data-pilar="juridico"] li.grave', 'class')) && (await pg.textContent('#pc-pilares [data-pilar="juridico"]')).includes('indisponibilidade'), 'indisponibilidade da matrícula vira ponto grave no jurídico');
  confere(!/^Vale a pena/.test(await pg.textContent('#pc-veredito')), 'com ponto grave o parecer não diz "Vale a pena": ' + await pg.textContent('#pc-veredito'));
  confere((await pg.textContent('#pc-pilares [data-pilar="posse"]')).includes('3 a 12 meses'), 'posse: ocupado em leilão judicial mostra o caminho e o prazo');
  confere((await pg.textContent('#pc-pilares [data-pilar="dividas"]')).includes('art. 130'), 'dívidas: IPTU sub-roga no preço (lido do edital)');
  confere((await pg.textContent('#pc-pilares [data-pilar="regiao"]')).includes('sem dados'), 'região sem análise fica "sem dados"');
  await abrirSecao('Região e valorização');
  await pg.click('#im-regiao-btn');
  await pg.waitForFunction(() => /Região analisada/.test(document.querySelector('#im-regiao-res').textContent), null, { timeout: 15000 });
  const rg = await pg.textContent('#im-regiao-res');
  confere(rg.includes('11.451.245') && rg.includes('Santa Cecília') && rg.includes('Escolas e faculdades: 26'), 'região: população do Censo, bairro no mapa e serviços a 1 km');
  confere(pedidosMapa.some(u => /nominatim/.test(u)) && pedidosMapa.some(u => /overpass/.test(u)), 'o navegador acha o endereço e os serviços no mapa quando o servidor não consegue');
  confere((await pg.getAttribute('#im-regiao-res a', 'href')).startsWith('https://www.openstreetmap.org/?mlat=-23.55274'), '"Ver no mapa" abre o OpenStreetMap no endereço');
  confere(/\d+\/100/.test(await pg.textContent('#pc-pilares [data-pilar="regiao"] .cab')) && (await pg.textContent('#pc-pilares [data-pilar="regiao"]')).includes('IVG-R'), 'pilar região ganha nota e a valorização do Banco Central');
  confere((await pg.getAttribute('#im-m2-busca', 'href')).includes(encodeURIComponent('Santa Cecília')), '"Ver anúncios parecidos" pesquisa no bairro do imóvel');
  await pg.fill('#im-area', '65');
  await pg.fill('#im-m2', '9.000');
  confere((await pg.textContent('#pc-pilares [data-pilar="financeiro"]')).includes('R$ 585.000'), 'área × preço do m² dá o valor de mercado (R$ 585.000)');
  confere(/^Vale|^Não vale/.test(await pg.textContent('#pc-veredito')) && (await pg.textContent('#pc-resumo')).includes('Nota'), 'veredito e resumo com nota e lance limite');
  await abrirSecao('O que conferir antes do lance');
  confere((await pg.locator('#pc-conferir li').count()) >= 3, 'lista do que conferir antes do lance: ' + await pg.locator('#pc-conferir li').count() + ' itens');
  await foto('parecer-completo');

  console.log('9. Dívidas e conta');
  await abrirSecao('Dívidas de IPTU e condomínio');
  confere((await pg.getAttribute('#im-iptu-link', 'href')).startsWith('https://') && (await pg.locator('#im-iptu-passos li').count()) >= 3, 'IPTU: link da prefeitura e passo a passo');
  const antes = await pg.textContent('#im-numeros');
  await pg.fill('#im-debitos-cond', '18.500,00');
  await pg.fill('#im-mensal-cond', '850');
  await pg.fill('#im-reforma', '25.000');
  confere((await pg.textContent('#im-numeros')) !== antes, 'dívidas e reforma mudam a conta na hora');
  confere((await pg.textContent('#im-tabela')).includes('R$ 18.500'), 'dívida de condomínio entra na tabela de custos');
  await abrirSecao('Ajustar percentuais');
  await pg.fill('#im-alvo', '10');
  const lanceMax = await pg.locator('#im-numeros div', { hasText: 'Lance máximo' }).textContent();
  confere(/R\$ [\d.]+/.test(lanceMax), 'lance máximo calculado: ' + lanceMax.replace('Lance máximo', ''));

  console.log('10. Parecer, passo a passo, salvar e reabrir');
  await abrirSecao('Parecer da IA');
  await pg.click('#im-parecer-btn');
  await pg.waitForFunction(() => /advogado/.test(document.querySelector('#im-parecer').textContent), null, { timeout: 10000 });
  confere(true, 'parecer da IA aparece');
  confere(pedidosIa.some(o => /PARECER DE CONSULTORIA/.test(o.system) && o.messages[0].content.includes('lance_maximo') && o.messages[0].content.includes('lance_limite') && o.messages[0].content.includes('Santa Cecília')), 'o parecer recebeu a conta, o motor e a região');
  await abrirSecao('Passo a passo deste imóvel');
  await pg.check('[data-etapa="busca-perfil"]');
  await pg.check('[data-etapa="busca-portais"]');
  confere((await pg.textContent('#im-progresso-chip')).startsWith('2/'), 'marcar passos atualiza o progresso');
  await pg.click('#im-salvar');
  await pg.waitForFunction(() => document.querySelector('#toast').textContent === 'Imóvel salvo.' && !document.querySelector('#toast').classList.contains('oculto'));
  await pg.click('#voltar');
  await pg.waitForFunction(() => document.querySelectorAll('#lista-imoveis .item').length === 2);
  confere((await pg.textContent('#lista-imoveis')).includes('2 de') && (await pg.textContent('#lista-imoveis')).includes('próximo: Fazer a primeira triagem'), 'lista mostra o progresso e o próximo passo');
  await foto('lista-imoveis');
  await pg.locator('#lista-imoveis .item', { hasText: 'Palmeiras' }).locator('button').click();
  await pg.waitForSelector('#pg-imovel:not(.oculto)');
  confere((await pg.inputValue('#im-debitos-cond')) === '18.500' && (await pg.inputValue('#im-alvo')) === '10', 'reabrir mantém dívidas e percentuais');
  confere(await pg.isChecked('[data-etapa="busca-portais"]') && (await pg.textContent('#im-processo-res')).includes('Designada'), 'reabrir mantém passos marcados e o processo');
  confere((await pg.textContent('#im-parecer')).includes('advogado') && (await pg.textContent('#im-edital-res')).includes('Edital lido'), 'reabrir mantém parecer e leitura do edital');
  confere((await pg.textContent('#im-regiao-res')).includes('Região analisada') && (await pg.inputValue('#im-m2')) === '9.000' && /\d+\/100/.test(await pg.textContent('#pc-pilares [data-pilar="regiao"] .cab')), 'reabrir mantém a região, o preço do m² e a nota da região');

  console.log('11. Relatório em PDF');
  await pg.evaluate(() => { window.print = () => { window.__imprimiu = true; }; });
  await pg.click('#im-relatorio');
  confere(await pg.evaluate(() => window.__imprimiu === true), '"Relatório em PDF" abre a impressão');
  const rel = await pg.textContent('#relatorio');
  confere(rel.includes('Relatório de leilão') && rel.includes('Lance máximo recomendado') && rel.includes('Cumprimento de sentença') && rel.includes('advogado') && rel.includes('Parecer completo') && rel.includes('Parte jurídica') && rel.includes('Região analisada') && rel.includes('Lance limite'), 'relatório tem parecer completo, pilares, região, números, processo e parecer da IA');
  await pg.emulateMedia({ media: 'print' });
  if (FOTOS) await pg.screenshot({ path: path.join(FOTOS, String(++n).padStart(2, '0') + '-relatorio.png'), fullPage: true });
  confere(await pg.isVisible('#relatorio') && await pg.isHidden('header.topo'), 'na impressão só o relatório aparece');
  await pg.emulateMedia({ media: 'screen' });

  console.log('12. Passo a passo geral e apagar');
  await pg.click('#nav-guia');
  confere((await pg.locator('#guia details').count()) === 7 && (await pg.textContent('#guia')).includes('Chaves entregues'), 'guia mostra as 7 fases até a entrega das chaves');
  await pg.locator('#guia details summary').first().click();
  confere(await pg.isVisible('#guia details[open] p'), 'abrir uma fase mostra os passos');
  await pg.click('#nav-imoveis');
  await pg.waitForFunction(() => document.querySelectorAll('#lista-imoveis .item').length === 2);
  await pg.locator('#lista-imoveis .item', { hasText: 'TRILHOS' }).locator('button').click();
  await pg.click('#im-apagar');
  await pg.waitForFunction(() => document.querySelectorAll('#lista-imoveis .item').length === 1);
  confere(true, 'apagar imóvel tira da lista');
  await pg.click('#ir-agenda');
  await pg.waitForSelector('#app:not(.oculto)');
  confere(pg.url().endsWith('/agenda/'), 'botão "Agenda" volta ao painel');

  console.log('13. Computador');
  await pg.setViewportSize({ width: 1280, height: 860 });
  await pg.goto(base + '/leiloes/', { waitUntil: 'load' });
  await pg.click('#nav-imoveis');
  await pg.waitForSelector('#lista-imoveis .item');
  const larg = await pg.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  confere(larg, 'sem rolagem para o lado no computador');
  await foto('computador');

  confere(erros.length === 0, 'nenhum erro de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await browser.close();
  servidor.close();
  console.log(`\n${nOk} ok, ${falhas.length} falha(s)`);
  if (falhas.length) { falhas.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
