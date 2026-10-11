#!/usr/bin/env node
'use strict';
// NEXIA · Central de Leilões: teste no ar, com a IA grátis e o CNJ de verdade, na agenda de teste (dados de mentira).
// 1) API publicada: entrar, consultar um processo real no DataJud, analisar um edital, pedir parecer, salvar e apagar.
// 2) Site publicado no celular: painel com o botão "Leilões"; na Central, envia um edital em PDF (leitor de PDF do
//    cdnjs + IA de verdade), confere a conta, salva e apaga.
// Uso: node tests/e2e/leiloes-ao-vivo.js [https://bezsan.pages.dev] [pasta-para-fotos]
const fs = require('fs');
const os = require('os');
const path = require('path');

const API = process.env.LEILAO_API || 'https://nexia.gcbezerra.workers.dev/api/leilao';
const API_AGENDA = process.env.AGENDA_API || 'https://nexia.gcbezerra.workers.dev/api/agenda';
const SITE_URL = (process.argv[2] || 'https://bezsan.pages.dev').replace(/\/$/, '');
const FOTOS = process.argv[3] || '';
const SENHA = 'leilao-teste-2026'; // agenda de teste: código e senha públicos de propósito
const DATAJUD_CHAVE = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';

const falhas = [];
function confere(cond, msg) { if (!cond) falhas.push(msg); console.log((cond ? '  ✓ ' : '  ✗ ') + msg); return cond; }
const postar = async (url, corpo) => {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ site: 'agenda-teste', ...corpo }) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
const EDITAL = `EDITAL DE LEILÃO JUDICIAL ELETRÔNICO. Processo nº 1000123-45.2023.8.26.0100, 41ª Vara Cível do Foro Central de São Paulo/SP.
Exequente: Condomínio Edifício Palmeiras. Executado: João da Silva. Leiloeiro oficial: Maria Leiloeira, JUCESP 999, site www.leiloeira-exemplo.com.br.
BEM: Apartamento nº 31 do Edifício Palmeiras, Rua das Palmeiras, 200, Mooca, São Paulo/SP, com 62 m² de área privativa, matrícula 123.456 do 5º Oficial de Registro de Imóveis de São Paulo, contribuinte (IPTU) 030.045.0123-4.
AVALIAÇÃO: R$ 420.000,00 (quatrocentos e vinte mil reais), atualizada em setembro de 2026.
1º LEILÃO: começa em 05/11/2026 e termina em 10/11/2026 às 14h, por valor igual ou superior à avaliação. 2º LEILÃO: termina em 24/11/2026 às 14h, lance mínimo de 50% da avaliação, ou seja, R$ 210.000,00.
PAGAMENTO: à vista em até 24 horas, ou parcelado com entrada de 25% e saldo em até 30 parcelas mensais corrigidas (art. 895 do CPC).
COMISSÃO: 5% sobre o valor da arrematação, paga pelo arrematante, que não está incluída no lance.
DÉBITOS: os débitos de IPTU sub-rogam-se no preço (art. 130, parágrafo único, do CTN). Os débitos de condomínio, de R$ 18.500,00 até agosto de 2026, serão pagos com o produto da arrematação.
ÔNUS: R.5 penhora em favor do Banco X S/A; AV.6 indisponibilidade de bens decretada pela 2ª Vara do Trabalho.
OCUPAÇÃO: o imóvel encontra-se ocupado pelo executado; a desocupação correrá por conta do arrematante, com expedição de mandado de imissão na posse.
São Paulo, 1º de outubro de 2026.`;

(async () => {
  console.log('1. API publicada (agenda de teste)');
  const ent = await postar(API_AGENDA, { acao: 'primeiro-acesso', codigo: 'TESTEAGENDA', senha_nova: SENHA });
  if (!confere(ent.status === 200 && ent.json.token, `entrar (${ent.status} ${ent.json.error || ''})`)) throw new Error('sem login');
  const token = ent.json.token;
  const sem = await postar(API, { acao: 'listar', token: 'f'.repeat(64) });
  confere(sem.status === 401, 'sem login a Central recusa (401)');
  const lista = await postar(API, { acao: 'listar', token });
  confere(lista.status === 200 && Array.isArray(lista.json.imoveis), `listar imóveis (${lista.status})`);

  // Processo real: pega um número qualquer do TJSP direto no DataJud e consulta pela Central.
  const dj = await fetch('https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search', { method: 'POST', headers: { Authorization: 'APIKey ' + DATAJUD_CHAVE, 'Content-Type': 'application/json' }, body: JSON.stringify({ size: 1, query: { match_all: {} } }) }).then(r => r.json()).catch(() => null);
  const numero = dj && dj.hits && dj.hits.hits[0] && dj.hits.hits[0]._source.numeroProcesso;
  if (confere(!!numero, 'achou um processo real do TJSP no DataJud')) {
    const fmt = `${numero.slice(0, 7)}-${numero.slice(7, 9)}.${numero.slice(9, 13)}.${numero.slice(13, 14)}.${numero.slice(14, 16)}.${numero.slice(16)}`;
    const p = await postar(API, { acao: 'processo', token, numero: fmt });
    confere(p.status === 200 && p.json.processo && p.json.processo.numero === numero && p.json.processo.movimentos.length > 0, `consulta do processo ${fmt} pela Central (${p.status} ${p.json.error || ''})`);
  }

  const t0 = Date.now();
  const a = await postar(API, { acao: 'analisar', tipo: 'edital', token, texto: EDITAL });
  const d = a.json.dados || {};
  confere(a.status === 200, `IA grátis analisou o edital em ${Math.round((Date.now() - t0) / 1000)} s (${a.status} ${a.json.error || ''} ${a.json.modelo || ''})`);
  confere(Math.abs(Number(d.avaliacao) - 420000) < 1 && Math.abs(Number(d.praca2_valor) - 210000) < 1, `avaliação e 2ª praça certas (${d.avaliacao} / ${d.praca2_valor})`);
  confere(d.ocupado === true && /judicial/i.test(String(d.tipo_leilao)), `ocupado e judicial (${d.ocupado} / ${d.tipo_leilao})`);
  confere(Array.isArray(d.onus) && d.onus.join(' ').match(/penhora/i), 'achou a penhora nos ônus');
  const par = await postar(API, { acao: 'parecer', token, imovel: { endereco: 'Rua das Palmeiras, 200', ocupado: true, edital: d }, conta: { resultado: { lance_maximo: 258000, roi_anual: 0.26 }, veredito: { nivel: 1, texto: 'Atenção' } } });
  confere(par.status === 200 && par.json.texto && par.json.texto.length > 80, `parecer da IA (${par.status} ${par.json.error || ''})`);
  const bu = await postar(API, { acao: 'buscar', token, busca: 'apartamento', uf: 'SP' });
  const lotes = bu.json.imoveis || [];
  confere(bu.status === 200 && lotes.length > 0 && lotes.every(l => /^https:\/\/www\.leiloesjudiciais\.com\.br\/lote\//.test(l.link)), `busca automática em vários leiloeiros: ${lotes.length} lotes (${bu.status} ${bu.json.error || ''})`);
  confere(lotes.some(l => l.lance > 0), 'lotes vêm com valor de lance');
  const comAnexo = lotes.find(l => l.anexos && l.anexos.length);
  if (confere(!!comAnexo, 'algum lote traz edital ou matrícula')) {
    const arq = await postar(API, { acao: 'arquivo', token, url: comAnexo.anexos[0].url });
    confere(arq.status === 200 && Buffer.from(arq.json.pdf || '', 'base64').slice(0, 4).toString() === '%PDF', `baixa o PDF do lote (${arq.status} ${arq.json.error || ''})`);
  }
  const alvo = lotes.find(l => l.cidade && l.uf) || { cidade: 'São Paulo', uf: 'SP', endereco: 'Avenida Paulista, 1000' };
  const rg = await postar(API, { acao: 'regiao', token, endereco: alvo.endereco || '', cidade: alvo.cidade, uf: alvo.uf });
  const g = rg.json.regiao || {};
  confere(rg.status === 200 && g.municipio && g.populacao && g.populacao.censo_2022 > 0, `região de ${alvo.cidade}/${alvo.uf} pelo IBGE (${rg.status} ${rg.json.error || ''}): Censo 2022 ${g.populacao && g.populacao.censo_2022}, PIB por pessoa ${g.pib_per_capita && g.pib_per_capita.valor}`);
  confere(g.mercado && typeof g.mercado.ivgr_12m_pct === 'number', `preço dos imóveis no Brasil pelo Banco Central: ${g.mercado && g.mercado.ivgr_12m_pct}% em 12 meses`);
  const sp = await postar(API, { acao: 'regiao', token, endereco: 'Avenida Paulista, 1000', cidade: 'São Paulo', uf: 'SP' });
  const sv = (sp.json.regiao && sp.json.regiao.servicos) || [];
  confere(sp.status === 200 && sv.length === 6 && sv.every(x => x.qtd > 0), 'endereço no mapa e serviços a 1 km pelo OpenStreetMap: ' + sv.map(x => x.id + ' ' + x.qtd).join(', '));
  const s = await postar(API, { acao: 'salvar', token, imovel: { endereco: 'Teste automático', lance: 1 } });
  confere(s.status === 200 && s.json.id, 'salvar imóvel');
  const ap = await postar(API, { acao: 'apagar', token, id: s.json.id });
  confere(ap.status === 200, 'apagar imóvel');

  console.log('2. Site publicado no celular');
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('@playwright/test')); }
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const erros = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  const pg = await ctx.newPage();
  pg.on('pageerror', e => erros.push(e.message));
  pg.on('dialog', x => x.accept());
  pg.on('console', m => { if (m.type() === 'error') console.log('    [console] ' + m.text().slice(0, 200)); });
  pg.on('requestfailed', r => { if (/api\/leilao/.test(r.url())) console.log('    [rede] falhou ' + (r.failure() && r.failure().errorText)); });
  pg.on('response', async r => { if (/api\/leilao/.test(r.url())) { let corpo = ''; try { corpo = (await r.text()).slice(0, 160); } catch (e) {} console.log(`    [api] ${r.status()} ${r.request().postData() ? JSON.parse(r.request().postData()).acao : ''} ${corpo}`); } });
  let n = 0;
  if (FOTOS) fs.mkdirSync(FOTOS, { recursive: true });
  const foto = async nome => { if (FOTOS) await pg.screenshot({ path: path.join(FOTOS, 'leiloes-' + String(++n).padStart(2, '0') + '-' + nome + '.png') }); };

  const html = await (await fetch(SITE_URL + '/agenda/')).text();
  confere(html.includes('<meta name="agenda-extra" content="Leilões|../leiloes/">'), 'painel publicado tem o botão "Leilões"');
  const robots = await (await fetch(SITE_URL + '/robots.txt')).text();
  confere(robots.includes('Disallow: /leiloes/'), 'robots.txt esconde a Central dos buscadores');

  await pg.goto(SITE_URL + '/agenda/?site=agenda-teste', { waitUntil: 'load' });
  await pg.fill('#senha', SENHA); await pg.click('#form-entrar button');
  await pg.waitForSelector('#app:not(.oculto)', { timeout: 20000 });
  confere(await pg.isVisible('#nav-extra'), 'painel no ar mostra "Leilões"');
  await pg.goto(SITE_URL + '/leiloes/?site=agenda-teste', { waitUntil: 'load' });
  await pg.waitForSelector('#app:not(.oculto)', { timeout: 20000 });
  confere(true, 'Central abre com o login do painel');
  await foto('central');
  await pg.click('#nav-imoveis');
  await pg.click('#novo-imovel');
  const gerador = await browser.newPage();
  await gerador.setContent('<h1>Edital</h1>' + EDITAL.split('\n').map(l => `<p>${l}</p>`).join(''));
  const arq = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'leilao-')), 'edital.pdf');
  fs.writeFileSync(arq, await gerador.pdf({ format: 'A4' }));
  await gerador.close();
  await pg.setInputFiles('#im-edital', arq);
  await pg.waitForSelector('#im-doc-msg.ok, #im-doc-msg.erro', { timeout: 110000 }).catch(() => {});
  confere(await pg.isVisible('#im-doc-msg.ok'), 'edital em PDF lido pela IA no site: ' + (await pg.textContent('#im-doc-msg')).slice(0, 90));
  confere((await pg.inputValue('#im-avaliacao')) === '420.000', `avaliação preenchida (${await pg.inputValue('#im-avaliacao')})`);
  confere((await pg.inputValue('#im-lance')) === '210.000', `lance da 2ª praça preenchido (${await pg.inputValue('#im-lance')})`);
  confere(await pg.isChecked('#im-ocupado'), 'marcado como ocupado');
  confere(/Vale a pena|Atenção|Não vale/.test(await pg.textContent('#im-veredito-txt')), 'veredito aparece: ' + await pg.textContent('#im-veredito-txt'));
  await foto('edital-lido');
  await pg.click('#im-salvar');
  await pg.waitForFunction(() => document.querySelector('#toast').textContent === 'Imóvel salvo.', null, { timeout: 20000 }).catch(() => {});
  confere((await pg.textContent('#toast')) === 'Imóvel salvo.', 'salvar no site (' + await pg.textContent('#toast') + ')');
  if (await pg.isVisible('#im-apagar')) {
    await pg.click('#im-apagar');
    await pg.waitForSelector('#pg-imoveis:not(.oculto)', { timeout: 20000 }).catch(() => {});
  }
  confere(!(await pg.textContent('#lista-imoveis')).includes('Palmeiras'), 'apagar no site');
  console.log('3. Consultoria completa de um lote real (busca, edital do leiloeiro, região, parecer, relatório)');
  await pg.click('#nav-buscar');
  await pg.fill('#a-busca', 'apartamento'); await pg.selectOption('#a-uf', 'SP');
  await pg.click('#a-buscar');
  await pg.waitForSelector('#a-lista .item', { timeout: 30000 }).catch(() => {});
  const cartao = pg.locator('#a-lista .item', { hasText: /Documentos: .*EDITAL/i }).first();
  if (confere(await cartao.count() > 0, 'busca no site acha lote real com edital')) {
    console.log('    lote: ' + (await cartao.locator('.nome').textContent()).slice(0, 120));
    await cartao.locator('button:has-text("Analisar")').click();
    await pg.waitForSelector('#pg-imovel:not(.oculto)');
    const ler = pg.locator('#im-anexos button', { hasText: /Ler edital/i }).first();
    if (await ler.count()) {
      await ler.click();
      await pg.waitForSelector('#im-doc-msg.ok, #im-doc-msg.erro', { timeout: 120000 }).catch(() => {});
      confere(await pg.isVisible('#im-doc-msg.ok'), 'edital real do leiloeiro lido pela IA: ' + (await pg.textContent('#im-doc-msg')).slice(0, 90));
    }
    await pg.locator('#pg-imovel summary', { hasText: 'Região e valorização' }).click();
    await pg.click('#im-regiao-btn');
    await pg.waitForFunction(() => /Região analisada|erro/.test(document.querySelector('#im-regiao-res').textContent + document.querySelector('#im-regiao-res').innerHTML), null, { timeout: 60000 }).catch(() => {});
    confere((await pg.textContent('#im-regiao-res')).includes('Região analisada'), 'região do lote real analisada no site');
    console.log('    região: ' + (await pg.textContent('#im-regiao-res')).replace(/\s+/g, ' ').slice(0, 600));
    const nota = await pg.textContent('#pc-nota'), ver = await pg.textContent('#pc-veredito');
    confere(/^\d+$/.test(nota) && ver.length > 5, `parecer completo: nota ${nota}, ${ver}`);
    for (const pl of await pg.locator('#pc-pilares .pilar').all()) console.log('    ' + (await pl.innerText()).replace(/\n+/g, ' | ').slice(0, 700));
    await foto('parecer-completo-real');
    await pg.locator('#pg-imovel summary', { hasText: 'Parecer da IA' }).click();
    await pg.click('#im-parecer-btn');
    await pg.waitForFunction(() => /advogado|ocupada|Tente|Demorou/.test(document.querySelector('#im-parecer').textContent), null, { timeout: 90000 }).catch(() => {});
    const texto = await pg.textContent('#im-parecer');
    confere(/VEREDITO/.test(texto) && /advogado/.test(texto), 'parecer de consultoria da IA no lote real');
    console.log('    parecer da IA:\n' + texto.split('\n').map(l => '      ' + l).join('\n'));
    await pg.evaluate(() => { window.print = () => { window.__imprimiu = true; }; });
    await pg.click('#im-relatorio');
    const rel = await pg.textContent('#relatorio');
    confere(rel.includes('Parecer completo') && rel.includes('Região analisada'), 'relatório em PDF do lote real com parecer completo e região');
    if (FOTOS) { await pg.emulateMedia({ media: 'print' }); await pg.screenshot({ path: path.join(FOTOS, 'leiloes-' + String(++n).padStart(2, '0') + '-relatorio-real.png'), fullPage: true }); await pg.emulateMedia({ media: 'screen' }); }
  }
  confere(erros.length === 0, 'nenhum erro de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await browser.close();

  console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\nTudo certo.');
  process.exit(falhas.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
