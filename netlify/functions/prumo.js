'use strict';

// Prumo (epic #2923): finanças pessoais do dono. API /api/prumo. Partes #2924 (carteira), #2925 (cartões e gastos),
// #2926 (lista de compras), #2927 (ler print com IA grátis) e #2936 (objetivos e histórico).
// Dados em prumo_users/{uid}/{colecao}/{id}, gravados SÓ aqui (servidor); cada pessoa só vê os seus.
// Nunca pede senha de banco. Nunca escreve valores da pessoa em log.

const { verifyBearerToken, checkRateLimit, makeHeaders } = require('./middleware');
const extra = require('./prumo-lib/extra');

const TIPOS = ['renda_fixa', 'acoes', 'fiis', 'etf', 'fundos', 'tesouro', 'cripto', 'previdencia', 'fgts', 'poupanca', 'outro'];
const CATEGORIAS = ['mercado', 'casa', 'transporte', 'saude', 'lazer', 'educacao', 'restaurante', 'assinaturas', 'outros'];
const PERFIS = ['conservador', 'moderado', 'arrojado'];
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const MES = /^\d{4}-\d{2}$/;

const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const numero = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(/\./g, '').replace(',', '.')) : NaN);
const erro = (m) => ({ ok: false, erro: m });
const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const dinheiro = (n) => Math.round(n * 100) / 100;

// ---------- Parte 1: carteira ----------
function validarItemCarteira(o) {
  if (!o || typeof o !== 'object') return erro('Dados do investimento faltando.');
  const nome = texto(o.nome, 120);
  if (!nome) return erro('Escreva o nome do investimento.');
  const valor = numero(o.valor);
  if (!Number.isFinite(valor) || valor < 0) return erro('O valor precisa ser um número igual ou maior que zero.');
  const tipo = o.tipo || 'outro';
  if (!TIPOS.includes(tipo)) return erro('Tipo de investimento inválido.');
  const data_valor = texto(o.data_valor, 10) || new Date().toISOString().slice(0, 10);
  if (!DATA.test(data_valor)) return erro('A data do valor precisa estar no formato AAAA-MM-DD.');
  const vencimento = texto(o.vencimento, 10);
  if (vencimento && !DATA.test(vencimento)) return erro('O vencimento precisa estar no formato AAAA-MM-DD.');
  const item = { nome, banco: texto(o.banco, 80), tipo, valor: dinheiro(valor), data_valor, vencimento: vencimento || null, taxa: texto(o.taxa, 60) || null, objetivo_id: texto(o.objetivo_id, 60) || null };
  // #3035: detalhes opcionais do ativo (renda variável). Inválido vira null, nunca derruba o item.
  const ticker = texto(o.ticker, 12).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (ticker) item.ticker = ticker;
  for (const k of ['quantidade', 'preco_medio', 'cotacao', 'rentabilidade_pct']) {
    const n = typeof o[k] === 'number' ? o[k] : (o[k] === undefined || o[k] === null || o[k] === '' ? NaN : numero(String(o[k]).replace(/[^\d.,-]/g, '')));
    if (Number.isFinite(n)) item[k] = k === 'quantidade' ? Math.round(n * 1e6) / 1e6 : dinheiro(n);
  }
  if (o.corrigido_por_cotacao === true) { item.corrigido_por_cotacao = true; const vl = numero(o.valor_lido); if (Number.isFinite(vl)) item.valor_lido = dinheiro(vl); }
  return { ok: true, item };
}

// ---------- Parte 2: cartões e gastos ----------
function validarCartao(o) {
  const nome = texto(o && o.nome, 60);
  if (!nome) return erro('Escreva o nome do cartão.');
  const limite = numero(o.limite ?? 0);
  if (!Number.isFinite(limite) || limite < 0) return erro('O limite precisa ser um número igual ou maior que zero.');
  const dia = (v) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 31;
  if (!dia(o.dia_fechamento) || !dia(o.dia_vencimento)) return erro('Os dias de fechamento e vencimento vão de 1 a 31.');
  const item = { nome, limite: dinheiro(limite), dia_fechamento: Number(o.dia_fechamento), dia_vencimento: Number(o.dia_vencimento), programa_pontos: texto(o.programa_pontos, 60) || null };
  // Kernex Finance (fase 4): detalhes opcionais do cartão. Vazio ou inválido simplesmente não entra.
  for (const k of ['bandeira', 'categoria_cartao', 'isencao', 'beneficios', 'adicionais']) { const t = texto(o[k], k === 'beneficios' ? 300 : 80); if (t) item[k] = t; }
  for (const k of ['anuidade', 'pontos_por_real', 'valor_milheiro', 'cashback_pct']) {
    if (o[k] === undefined || o[k] === null || o[k] === '') continue;
    const n = typeof o[k] === 'number' ? o[k] : numero(o[k]);
    if (!Number.isFinite(n) || n < 0) return erro(`O campo ${k.replace(/_/g, ' ')} precisa ser um número igual ou maior que zero.`);
    item[k] = dinheiro(n);
  }
  return { ok: true, item };
}
function validarGasto(o) {
  const cartao_id = texto(o && o.cartao_id, 60);
  if (!cartao_id) return erro('Escolha o cartão.');
  const descricao = texto(o.descricao, 120);
  if (!descricao) return erro('Escreva o que foi comprado.');
  const valor = numero(o.valor);
  if (!Number.isFinite(valor) || valor <= 0) return erro('O valor precisa ser maior que zero.');
  const data = texto(o.data, 10);
  if (!DATA.test(data)) return erro('A data precisa estar no formato AAAA-MM-DD.');
  const categoria = o.categoria || 'outros';
  if (!CATEGORIAS.includes(categoria)) return erro('Categoria inválida.');
  const parcelas = o.parcelas === undefined || o.parcelas === null || o.parcelas === '' ? 1 : Number(o.parcelas);
  if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 48) return erro('As parcelas vão de 1 a 48.');
  return { ok: true, item: { cartao_id, descricao, valor: dinheiro(valor), data, categoria, parcelas } };
}
const somarMes = (mes, n) => { const [a, m] = mes.split('-').map(Number); const t = a * 12 + (m - 1) + n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; };
/** Gastos do mês: parcelado conta valor/parcelas em cada mês da parcela. */
function resumoMes(gastos, mes) {
  const doMes = [];
  let total = 0;
  const por_categoria = {};
  const por_cartao = {};
  for (const g of gastos || []) {
    const inicio = String(g.data || '').slice(0, 7);
    const n = Math.max(1, Number(g.parcelas) || 1);
    let parcela = 0;
    for (let i = 0; i < n; i++) if (somarMes(inicio, i) === mes) parcela = i + 1;
    if (!parcela) continue;
    const v = dinheiro(Number(g.valor) / n);
    doMes.push({ ...g, valor_mes: v, parcela });
    total += v;
    por_categoria[g.categoria] = dinheiro((por_categoria[g.categoria] || 0) + v);
    por_cartao[g.cartao_id] = dinheiro((por_cartao[g.cartao_id] || 0) + v);
  }
  return { gastos: doMes, total: dinheiro(total), por_categoria, por_cartao };
}

// ---------- Parte 3: lista de compras ----------
function validarLista(o) {
  const nome = texto(o && o.nome, 80);
  if (!nome) return erro('Dê um nome para a lista.');
  const lembrete = texto(o.lembrete, 40);
  if (lembrete && Number.isNaN(Date.parse(lembrete))) return erro('Lembrete com data inválida.');
  const brutos = Array.isArray(o.itens) ? o.itens : [];
  if (brutos.length > 200) return erro('A lista pode ter até 200 itens.');
  const itens = [];
  for (const it of brutos) {
    const n = texto(it && it.nome, 80);
    if (!n) return erro('Todo item precisa de nome.');
    const qtd = numero(it.qtd ?? 1);
    if (!Number.isFinite(qtd) || qtd <= 0) return erro(`Quantidade inválida em "${n}".`);
    const preco = it.preco_estimado === undefined || it.preco_estimado === null || it.preco_estimado === '' ? null : numero(it.preco_estimado);
    if (preco !== null && (!Number.isFinite(preco) || preco < 0)) return erro(`Preço inválido em "${n}".`);
    itens.push({ nome: n, qtd, unidade: texto(it.unidade, 10), preco_estimado: preco === null ? null : dinheiro(preco), comprado: !!it.comprado });
  }
  return { ok: true, item: { nome, lembrete: lembrete || null, itens } };
}
function detalharLista(l) {
  const itens = l.itens || [];
  return { ...l, total_estimado: dinheiro(itens.reduce((s, i) => s + (Number(i.preco_estimado) || 0) * (Number(i.qtd) || 1), 0)), faltam: itens.filter((i) => !i.comprado).length };
}
/** Listas com lembrete vencido e itens faltando. */
function avisosPendentes(listas, agoraISO) {
  const agora = Date.parse(agoraISO || new Date().toISOString());
  return (listas || []).filter((l) => l.lembrete && Date.parse(l.lembrete) <= agora && (l.itens || []).some((i) => !i.comprado))
    .map((l) => ({ id: l.id, nome: l.nome, faltam: (l.itens || []).filter((i) => !i.comprado).length, lembrete: l.lembrete }));
}

// ---------- Parte 4: ler print com IA grátis ----------
const LER_PRINT = `Você lê prints de apps de banco, corretora, previdência e FGTS do Brasil. Devolva SOMENTE um JSON, sem texto fora dele:
{"total_print": número ou null, "data_print": "AAAA-MM-DD ou null", "itens":[{"nome":"","banco":"","banco_escrito":false,"tipo":"","ticker":"","quantidade":null,"preco_medio":null,"cotacao":null,"conta":"","valor":0,"data_valor":"AAAA-MM-DD ou null","vencimento":"AAAA-MM-DD ou null","taxa":""}]}
Regras:
1. Um item para CADA ativo/aplicação/plano/conta que aparece com valor (não junte vários num só). Se só existir um total, devolva um item com ele.
2. "valor" é o valor ATUAL da posição: "Saldo bruto", "Valor atual", "Posição", "Saldo", o valor grande em destaque logo abaixo do nome do ativo, ou quantidade × cotação. NUNCA use "Preço médio", "Custo médio", "Valor aplicado", "Valor investido", a variação (seta ↑/↓ ao lado) nem rentabilidade como valor.
3. "total_print" é o total que o próprio print mostra ("Total investido", "Patrimônio", "Saldo total", "TOTAL"), ou null se não houver.
4. "banco" SÓ se o nome da instituição estiver ESCRITO no print (aí "banco_escrito": true). Se não estiver escrito, "banco": "" e "banco_escrito": false. NUNCA adivinhe pelo logo, cor, ticker ou nome do fundo (BTLG11 não é BTG, XPML11 não é XP).
5. "ticker" é o código da B3 quando houver (PETR4, MXRF11, IVVB11). Fundo imobiliário (grupo "FIIs") é "fiis"; ETF (grupo "ETFs", ex.: IVVB11, BOVA11) é "etf". FII e ETF NUNCA são "renda_fixa".
5b. "data_print" é a data escrita no print ("Atualizado em 11/11/2026"). "data_valor" só se houver data escrita junto do item; senão null. NUNCA invente data.
5c. Se houver Quantidade e Cotação, "valor" tem que ser igual a quantidade × cotação (confira a vírgula).
6. tipo é um destes: ${TIPOS.join(', ')}.
7. Mesmo plano/fundo em VÁRIAS linhas (ex.: previdência com conta "Participante" e "Patrocinadora", ou "Básica" e "Adicional") = um item POR LINHA, cada um com seu valor, e o nome da linha em "conta". Nunca devolva só a primeira linha.
8. Números com ponto decimal (R$ 1.234,56 vira 1234.56). Não invente nada que não esteja legível.
9. Título de grupo com subtotal NÃO é item: "CDB (92,77%) R$ 138.122,79", "FIIs", "Ações", "ETFs", "Renda fixa R$ ...". Só os ativos dentro do grupo são itens.
10. Ativo cortado no topo ou no fim do print (sem o valor visível) fica de fora; ele aparece inteiro no próximo print.`;
/** Grupo com subtotal ("CDB (92,77%)", "FIIs") que a IA devolveu como item: some se o valor dele é a soma dos itens logo abaixo. */
const NOME_GRUPO = /^(cdbs?|lcis?|lcas?|lcs?|fiis?|fundos?( imobili[aá]rios)?|a[cç](ão|oes|ões)|etfs?|bdrs?|renda (fixa|vari[aá]vel)|tesouro( direto)?|deb[eê]ntures|cris?|cras?|previd[eê]ncia|criptos?|total.*)$/i;
function tirarSubtotais(itens) {
  const ehGrupo = (x) => !x.ticker && !x.quantidade && (/\(\s*\d+(?:[.,]\d+)?\s*%\s*\)/.test(x.nome || '') || NOME_GRUPO.test(String(x.nome || '').replace(/\(.*?\)/g, '').trim()));
  const fora = new Set();
  itens.forEach((x, i) => {
    if (!ehGrupo(x)) return;
    const tol = Math.max(0.02, x.valor * 0.005);
    let acc = 0;
    for (let j = i + 1; j < itens.length; j++) {
      if (fora.has(j)) continue;
      acc += itens[j].valor;
      if (Math.abs(acc - x.valor) <= tol) { fora.add(i); break; }
      if (acc > x.valor + tol) break;
    }
  });
  return itens.filter((_, i) => !fora.has(i));
}
/** No MESMO print, duas linhas com mesmo banco e nome mas valores diferentes são posições diferentes
 *  (ex.: previdência Participante e Patrocinadora). Numera a 2ª em diante para o app não tratar como repetida. */
function separarLinhasIguais(itens) {
  const lista = Array.isArray(itens) ? itens : [];
  const k = (x) => `${String((x && x.banco) || '').toLowerCase().trim()}|${String((x && (x.ticker || x.nome)) || '').toLowerCase().trim()}|${String((x && x.conta) || '').toLowerCase().trim()}`;
  const vistos = new Map();
  return lista.map((x) => {
    if (!x || typeof x !== 'object') return x;
    const key = k(x); const valores = vistos.get(key) || [];
    const v = valorLido(x.valor);
    vistos.set(key, valores.concat(v));
    if (!valores.length || valores.includes(v) || x.ticker) return x;
    return { ...x, nome: `${x.nome || x.banco || ''} (linha ${valores.length + 1})` };
  });
}
/** Primeiro objeto JSON do texto da IA (aceita cerca ```json). */
function extrairJson(t) {
  const s = String(t || '');
  const cerca = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  const fonte = cerca ? cerca[1] : s;
  const ini = fonte.indexOf('{');
  if (ini < 0) return null;
  let nivel = 0; let dentroTexto = false; let escape = false;
  for (let i = ini; i < fonte.length; i++) {
    const c = fonte[i];
    if (dentroTexto) { if (escape) escape = false; else if (c === '\\') escape = true; else if (c === '"') dentroTexto = false; continue; }
    if (c === '"') dentroTexto = true;
    else if (c === '{') nivel++;
    else if (c === '}' && --nivel === 0) { try { return JSON.parse(fonte.slice(ini, i + 1)); } catch { return null; } }
  }
  return null;
}
const IMG = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;
const MAX_IMG = Math.floor(4 * 1024 * 1024 * 4 / 3); // 4 MB em base64
function lerImagens(lista) {
  if (!Array.isArray(lista) || lista.length < 1 || lista.length > 5) return erro('Mande de 1 a 5 prints.');
  const out = [];
  for (const b of lista) {
    const m = typeof b === 'string' ? IMG.exec(b) : null;
    if (!m) return erro('Imagem inválida. Use foto ou print em JPG, PNG ou WEBP.');
    if (m[2].length > MAX_IMG) return erro('Imagem grande demais.');
    out.push({ mime: m[1], data: m[2] });
  }
  return { ok: true, imagens: out };
}
// Valor vindo da IA: aceita 1234.56, "1.234,56", "R$ 1.234,56", "1234,56" e "-".
function valorLido(v) {
  if (typeof v === 'number') return v;
  let t = String(v == null ? '' : v).replace(/[^\d.,-]/g, '');
  if (!t || t === '-') return NaN;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if ((t.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(t)) t = t.replace(/\./g, '');
  return Number(t);
}
function dataLida(v) {
  const t = String(v == null ? '' : v).trim();
  if (DATA.test(t)) return t;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(t);
  if (!m) return '';
  const ano = m[3].length === 2 ? '20' + m[3] : m[3];
  return `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
const APELIDO_TIPO = [[/tesouro/i, 'tesouro'], [/fgts/i, 'fgts'], [/prev|pgbl|vgbl/i, 'previdencia'], [/poupan/i, 'poupanca'],
  [/cripto|bitcoin|btc|eth/i, 'cripto'], [/a[cç][aã]o|a[cç][oõ]es|fii|bdr|etf|renda vari/i, 'acoes'], [/fundo/i, 'fundos'],
  [/cdb|lci|lca|cri|cra|deb[eê]nt|renda fixa|lc\b|rdb/i, 'renda_fixa']];
// #3532: ETFs e units da B3 que terminam em 11 mas NÃO são FII.
const ETFS = new Set(['IVVB11', 'BOVA11', 'SMAL11', 'HASH11', 'NASD11', 'GOLD11', 'DIVO11', 'SPXI11', 'XINA11', 'BOVV11', 'BBSD11', 'ECOO11', 'FIND11', 'MATB11', 'PIBB11', 'BRAX11', 'ACWI11', 'EURP11', 'WRLD11', 'QBTC11', 'ETHE11', 'BITH11', 'B5P211', 'IMAB11', 'IRFM11', 'FIXA11', 'TECK11', 'GOVE11', 'BOVB11', 'DEFI11', 'META11', 'SPXR11', 'USTK11']);
const UNITS = new Set(['TAEE11', 'SANB11', 'KLBN11', 'ALUP11', 'BPAC11', 'ENGI11', 'SAPR11', 'IGTI11', 'CPLE11', 'BRBI11', 'TIET11', 'RNEW11', 'AESB11', 'CMIG11', 'ITSA11', 'SULA11', 'PPLA11', 'BIDI11', 'INBR11', 'NEOE11']);
/** Tipo pelo ticker (#3532): ETF conhecido = etf; unit = acoes; outro XXXX11 = fiis (nunca renda fixa). */
function tipoPeloTicker(tk, tipo) {
  if (ETFS.has(tk)) return 'etf';
  if (UNITS.has(tk)) return 'acoes';
  if (/^[A-Z]{4}11$/.test(tk) && tipo !== 'fiis' && tipo !== 'etf') return 'fiis';
  if (/^[A-Z]{4}\d{1,2}$/.test(tk) && (tipo === 'outro' || tipo === 'renda_fixa')) return 'acoes';
  return tipo;
}
/** #3532: se tem quantidade e cotação, o valor da posição é quantidade × cotação (a IA erra a vírgula: 1.883,70 em vez de 188,37). */
function conferirValor(it) {
  const q = Number(it && it.quantidade); const c = Number(it && it.cotacao);
  if (!(q > 0 && c > 0)) return it;
  const qc = Math.round(q * c * 100) / 100;
  // Tolerância só do arredondamento da cotação (2 casas): até meio centavo por cota.
  if (Math.abs(Number(it.valor) - qc) <= Math.max(0.05, q * 0.005 + 0.01)) return it;
  return { ...it, valor: qc, valor_lido: it.valor, corrigido_por_cotacao: true };
}
/** Arruma o que a IA devolveu (tipo, valor, datas) para não descartar item bom por formato. */
function normalizarLido(b, dataPrint) {
  if (!b || typeof b !== 'object') return b;
  const bruto = String(b.tipo || '').trim();
  const tk = String(b.ticker || '').toUpperCase();
  let tipo = TIPOS.includes(bruto) ? bruto : ((APELIDO_TIPO.find(([re]) => re.test(`${bruto} ${b.nome || ''}`)) || [])[1] || 'outro');
  if (/etf/i.test(bruto)) tipo = 'etf';
  if (tk) tipo = tipoPeloTicker(tk, tipo);
  const val = valorLido(b.valor);
  // "conta" separa linhas do mesmo plano (Participante x Patrocinadora) para não virar "repetido".
  const conta = String(b.conta || '').trim();
  let nome = String(b.nome || b.banco || '');
  if (conta && !nome.toLowerCase().includes(conta.toLowerCase())) nome = `${nome} — ${conta}`;
  // Banco: se b.banco_escrito for verdadeiro, usa b.banco; caso contrário, vazio (""). Sem adivinhação.
  const banco = b.banco_escrito ? String(b.banco || '').trim() : '';
  const { banco_escrito: _bancoEscrito, instituicao, ...resto } = b; // eslint-disable-line no-unused-vars
  const dataValor = dataLida(b.data_print) || dataLida(b.data_valor) || new Date().toISOString().slice(0, 10);
  // "banco" é declarado num objeto só para o campo sair vazio ("") quando não há nome escrito no texto.
  const camposBanco = { banco };
  return conferirValor({ ...resto, ...camposBanco, nome, tipo, valor: Number.isFinite(val) ? Math.abs(val) : b.valor,
    data_valor: dataValor, vencimento: dataLida(b.vencimento) || null });
}
// Modelos grátis com visão, do mais rápido ao mais forte. Vários provedores: se a cota de um acabar
// (o Gemini grátis vive no limite por causa do Cortex), o próximo lê.
const VISAO = [
  // Testado ao vivo em 04/11/2026 (scripts/prumo-ler-print-ao-vivo.js): NVIDIA 90B leu banco e valores certos.
  { provider: 'nvidia', model: 'meta/llama-3.2-90b-vision-instruct' },
  // NVIDIA 11B, llama-4, gemma-3, phi-4 e nemotron-vl saíram do ar (404/410) em 04/11/2026.
  // Workers AI entra pela pista do binding (viaWorkersAi), sem chave.
  { provider: 'mistral', model: 'mistral-small-latest' },
  { provider: 'google', model: 'gemini-2.5-flash-lite' }, { provider: 'google', model: 'gemini-flash-lite-latest' },
  { provider: 'google', model: 'gemini-2.5-flash' }, { provider: 'google', model: 'gemini-flash-latest' },
  { provider: 'openrouter', model: 'google/gemma-3-27b-it:free' },
  { provider: 'openrouter', model: 'qwen/qwen2.5-vl-72b-instruct:free' },
];
async function lerPrint(imagens, deps) {
  const router = deps.getRouter();
  const itens = []; const descartados = []; const falhas = [];
  let algum = false;
  const vistos = new Set();
  const lista = [...VISAO, ...deps.listFor('fast')].filter((d) => d.provider !== 'anthropic' && !vistos.has(d.provider + d.model) && vistos.add(d.provider + d.model));
  // Os prints são lidos ao mesmo tempo (até 5), cada um tentando os modelos em ordem.
  const inicio = Date.now();
  const ai = deps.ai !== undefined ? deps.ai : globalThis.__NEXIA_AI__;
  // Cada print corre em duas pistas ao mesmo tempo: a lista de IAs grátis e o Workers AI do próprio
  // Cloudflare (sem chave). Vale a primeira que devolver o JSON certo.
  const ler = (img) => {
    const pistas = [viaLista(img)];
    if (ai && typeof ai.run === 'function') pistas.push(viaWorkersAi(ai, img, falhas));
    return Promise.any(pistas.map((x) => x.then((j) => j || Promise.reject(new Error('nada'))))).catch(() => null);
  };
  const lidos = await Promise.all(imagens.map(ler));
  async function viaLista(img) {
    let tentou = 0;
    for (const d of lista) {
      try {
        const cap = router.capabilities(d);
        if (!cap.available || !cap.vision) continue;
        // O 1º modelo (o melhor) tem até 100 s, porque um print cheio de ativos gera resposta longa;
        // os outros têm 30 s. Tudo cabe nos 180 s que o app espera.
        const resta = 160000 - (Date.now() - inicio);
        if (resta < 5000) break;
        const ms = Math.min(tentou++ === 0 ? 100000 : 30000, resta);
        const out = await Promise.race([router.chat(d, { system: LER_PRINT, messages: [{ role: 'user', content: 'Leia este print e devolva o JSON.' }], images: [img], maxTokens: 8192, temperature: 0, timeoutMs: ms }), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms + 3000))]);
        const j = extrairJson(out && out.text);
        if (j && Array.isArray(j.itens)) return j;
        falhas.push(`${d.model}: resposta sem JSON`);
      } catch (e) { falhas.push(`${d.model}: ${String((e && (e.code || e.message)) || 'erro').slice(0, 60)}`); }
    }
    return null;
  }
  const conferencia = [];
  for (const lido of lidos) {
    if (!lido) continue;
    algum = true;
    const doPrint = [];
    for (const bruto of separarLinhasIguais(lido.itens)) { const v = validarItemCarteira(normalizarLido(bruto, lido.data_print)); if (v.ok) doPrint.push(v.item); else descartados.push({ ...bruto, motivo: v.erro }); }
    const limpos = tirarSubtotais(doPrint);
    itens.push(...limpos);
    // "itens" diz quantos itens são deste print: o app junta vários prints da mesma tela sob um total só.
    conferencia.push({ ...conferir(valorLido(lido.total_print), limpos.reduce((a, x) => a + x.valor, 0)), itens: limpos.length });
  }
  if (!algum && falhas.length) console.warn('[prumo] ler_print falhou:', falhas.slice(0, 6).join(' | '));
  return algum ? { itens, descartados, conferencia } : null;
}
// Workers AI pelo binding "AI" do Worker (grátis). Modelos que aceitam imagem no formato de chat.
const VISAO_WORKERS = ['@cf/meta/llama-4-scout-17b-16e-instruct', '@cf/mistralai/mistral-small-3.1-24b-instruct', '@cf/google/gemma-3-12b-it'];
/** Pista Workers AI (grátis, sem chave). Serve para print da carteira (LER_PRINT/itens) e para documentos (LER_DOC/lancamentos). */
async function viaWorkersAi(ai, img, falhas, system = LER_PRINT, campo = 'itens', pedido = 'Leia este print e devolva o JSON.') {
  const url = `data:${img.mime || 'image/jpeg'};base64,${img.data}`;
  for (const modelo of VISAO_WORKERS) {
    try {
      const r = await Promise.race([ai.run(modelo, { messages: [{ role: 'system', content: system }, { role: 'user', content: [{ type: 'text', text: pedido }, { type: 'image_url', image_url: { url } }] }], max_tokens: 4096, temperature: 0 }), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 90000))]);
      let t = r && (r.response !== undefined ? r.response : (r.result && r.result.response));
      const j = t && typeof t === 'object' ? t : extrairJson(String(t || ''));
      if (j && Array.isArray(j[campo])) return j;
      falhas.push(`${modelo}: resposta sem JSON`);
    } catch (e) { falhas.push(`${modelo}: ${String((e && (e.code || e.message)) || 'erro').slice(0, 60)}`); }
  }
  return null;
}
/** #3035: a soma dos itens bate com o total do print? (diferença menor que 1%) */
function conferir(total, soma) {
  const t = Number.isFinite(total) && total > 0 ? dinheiro(total) : null;
  return { total_print: t, soma_itens: dinheiro(soma), confere: t === null ? null : Math.abs(t - soma) <= t * 0.01 };
}

// ---------- Parte 10: objetivos e histórico ----------
function validarObjetivo(o) {
  const nome = texto(o && o.nome, 80);
  if (!nome) return erro('Dê um nome para o objetivo.');
  const meta = numero(o.meta);
  if (!Number.isFinite(meta) || meta <= 0) return erro('A meta precisa ser maior que zero.');
  const prazo = texto(o.prazo, 7);
  if (!MES.test(prazo)) return erro('O prazo precisa estar no formato AAAA-MM.');
  const aporte = o.aporte_mensal === undefined || o.aporte_mensal === null || o.aporte_mensal === '' ? null : numero(o.aporte_mensal);
  if (aporte !== null && (!Number.isFinite(aporte) || aporte < 0)) return erro('O aporte mensal precisa ser zero ou mais.');
  const perfil = o.perfil || 'moderado';
  if (!PERFIS.includes(perfil)) return erro('Perfil inválido.');
  return { ok: true, item: { nome, meta: dinheiro(meta), prazo, aporte_mensal: aporte === null ? null : dinheiro(aporte), perfil, cor: texto(o.cor, 20) || null } };
}
function progressoObjetivos(objetivos, itens) {
  return (objetivos || []).map((o) => {
    const atual = dinheiro((itens || []).filter((i) => i.objetivo_id === o.id).reduce((s, i) => s + (Number(i.valor) || 0), 0));
    return { ...o, atual, percentual: o.meta > 0 ? Math.round((atual / o.meta) * 1000) / 10 : 0, falta: dinheiro(Math.max(0, o.meta - atual)) };
  });
}
function fotoDoDia(itens) {
  const por_tipo = {}; const por_objetivo = {}; let total = 0;
  for (const i of itens || []) {
    const v = Number(i.valor) || 0; total += v;
    por_tipo[i.tipo] = dinheiro((por_tipo[i.tipo] || 0) + v);
    if (i.objetivo_id) por_objetivo[i.objetivo_id] = dinheiro((por_objetivo[i.objetivo_id] || 0) + v);
  }
  return { total: dinheiro(total), por_tipo, por_objetivo };
}
/** Últimos 24 meses (último registro de cada mês) e variação contra o mês anterior. */
function resumoHistorico(registros) {
  const porMes = new Map();
  for (const r of [...(registros || [])].sort((a, b) => String(a.data).localeCompare(String(b.data)))) porMes.set(String(r.data).slice(0, 7), r);
  const meses = [...porMes.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-24);
  return meses.map(([mes, r], i) => {
    const antes = i > 0 ? meses[i - 1][1].total : null;
    const variacao = antes === null ? null : dinheiro(r.total - antes);
    return { mes, total: r.total, variacao, variacao_pct: antes ? Math.round(((r.total - antes) / antes) * 1000) / 10 : null };
  });
}

// ---------- HTTP ----------
const deps = {
  db: () => require('./firebase-init').db,
  getRouter: (...a) => require('../../nexia-ai/model-router').getRouter(...a),
  listFor: (...a) => require('../../nexia-ai/orchestrator/models').listFor(...a),
  agora: () => new Date(),
};
const responder = (event, statusCode, body) => ({ statusCode, headers: makeHeaders(event), body: JSON.stringify(body) });

async function listar(col) { const s = await col.get(); return s.docs.map((d) => ({ id: d.id, ...d.data() })); }
// ---------- Homologação KF (#3267): o mesmo ativo nunca aparece 2 vezes ----------
// Chave do ativo: banco + (ticker ou nome), sem acento, sem maiúscula, sem "S.A."/"Ltda", sem palavras soltas
// (do, da, de, -). O vencimento NÃO entra: o print quase nunca traz e o salvo às vezes tem (viraria duplicado).
// A MESMA regra está em prumo/carteira.js (chaveAtivo); o teste KF-010 confere que as duas dão igual.
function chaveAtivo(x) {
  const n = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\b(s\.?a\.?|ltda)\b/g, ' ').replace(/[^a-z0-9%]+/g, ' ').replace(/\b(do|da|de|dos|das|e)\b/g, ' ').replace(/\s+/g, ' ').trim();
  // #3532: com ticker, a chave é SÓ o ticker (o banco às vezes vinha inventado e duplicava o ativo).
  const tk = String((x && x.ticker) || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (tk) return `tk|${tk}`;
  return [n(x && x.banco), n(x && x.nome)].join('|');
}
/** Junta linhas repetidas (mesma chave): fica a mais nova. Não apaga nada do banco. */
function semDuplicados(itens) {
  const porChave = new Map();
  for (const it of itens || []) {
    const k = chaveAtivo(it); const ja = porChave.get(k);
    if (!ja || String(it.atualizado_em || '') > String(ja.atualizado_em || '')) porChave.set(k, it);
  }
  return [...porChave.values()];
}
async function listarCarteira(base) { return semDuplicados(await listar(base.collection('carteira'))); }
async function gravarHistorico(base) {
  const itens = await listarCarteira(base);
  const data = deps.agora().toISOString().slice(0, 10);
  await base.collection('historico').doc(data).set({ data, ...fotoDoDia(itens) });
}

async function agir(uid, body) {
  const db = deps.db();
  if (!db) return [503, { error: 'Banco fora do ar agora. Tente de novo em alguns minutos.' }];
  const base = db.collection('prumo_users').doc(uid);
  const agoraIso = deps.agora().toISOString();
  const id = texto(body.id, 60);
  const salvar = async (colecao, valid) => {
    if (!valid.ok) return [400, { error: valid.erro }];
    const novo = id || novoId();
    await base.collection(colecao).doc(novo).set({ ...valid.item, atualizado_em: agoraIso });
    return [200, { ok: true, id: novo, item: { id: novo, ...valid.item } }];
  };
  const apagar = async (colecao) => { if (!id) return [400, { error: 'Diga qual item apagar.' }]; await base.collection(colecao).doc(id).delete(); return [200, { ok: true }]; };

  // Fases 2 a 4 (holerite, orçamento, consultor, milhas) ficam em prumo-lib/extra.js.
  const ctx = { uid, base, listar, listarCarteira: () => listarCarteira(base), salvar, apagar, deps, agoraIso, lerImagens, extrairJson, resumoMes, progressoObjetivos, resumoHistorico };
  switch (body.acao) {
    case 'carteira_listar': return [200, { itens: (await listarCarteira(base)).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR')) }];
    case 'carteira_salvar': {
      // Sem id e já existe o mesmo ativo: atualiza o que existe (não cria outro).
      const valid = validarItemCarteira(body);
      if (valid.ok && !id) {
        const igual = (await listar(base.collection('carteira'))).filter((a) => chaveAtivo(a) === chaveAtivo(valid.item)).sort((a, b) => String(b.atualizado_em || '').localeCompare(String(a.atualizado_em || '')))[0];
        if (igual) {
          if (!valid.item.objetivo_id && igual.objetivo_id) valid.item.objetivo_id = igual.objetivo_id;
          await base.collection('carteira').doc(igual.id).set({ ...valid.item, atualizado_em: agoraIso });
          await gravarHistorico(base);
          return [200, { ok: true, id: igual.id, atualizado: true, item: { id: igual.id, ...valid.item } }];
        }
      }
      const r = await salvar('carteira', valid); if (r[0] === 200) await gravarHistorico(base); return r; }
    case 'carteira_limpar': {
      // #3037: limpar e refazer. Só a carteira do próprio usuário; objetivos e histórico ficam.
      if (body.confirmar !== 'LIMPAR') return [400, { error: 'Confirme digitando LIMPAR.' }];
      const todos = await listar(base.collection('carteira'));
      for (const it of todos) await base.collection('carteira').doc(it.id).delete();
      await gravarHistorico(base);
      return [200, { ok: true, apagados: todos.length }];
    }
    case 'carteira_apagar': {
      // Apagar um ativo apaga também as cópias repetidas dele (senão a cópia "volta" na lista e o total não cai).
      if (id) {
        const todos = await listar(base.collection('carteira')); const alvo = todos.find((a) => a.id === id);
        if (alvo) for (const c of todos) if (c.id !== id && chaveAtivo(c) === chaveAtivo(alvo)) await base.collection('carteira').doc(c.id).delete();
      }
      const r = await apagar('carteira'); if (r[0] === 200) await gravarHistorico(base); return r; }
    case 'cartao_salvar': return salvar('cartoes', validarCartao(body));
    case 'cartao_listar': return [200, { cartoes: await listar(base.collection('cartoes')) }];
    case 'cartao_apagar': return apagar('cartoes');
    case 'gasto_salvar': return salvar('gastos', validarGasto(body));
    case 'gasto_listar': {
      const mes = texto(body.mes, 7) || agoraIso.slice(0, 7);
      if (!MES.test(mes)) return [400, { error: 'O mês precisa estar no formato AAAA-MM.' }];
      return [200, { mes, ...resumoMes(await listar(base.collection('gastos')), mes) }];
    }
    case 'gasto_apagar': return apagar('gastos');
    case 'lista_salvar': return salvar('listas', validarLista(body));
    case 'lista_listar': return [200, { listas: (await listar(base.collection('listas'))).map(detalharLista) }];
    case 'lista_marcar': {
      if (!id) return [400, { error: 'Diga qual lista.' }];
      const ref = base.collection('listas').doc(id);
      const snap = await ref.get();
      const l = snap && snap.data ? snap.data() : null;
      const i = Number(body.indice);
      if (!l || !Array.isArray(l.itens) || !Number.isInteger(i) || i < 0 || i >= l.itens.length) return [400, { error: 'Item da lista não encontrado.' }];
      l.itens[i] = { ...l.itens[i], comprado: !!body.comprado };
      await ref.set({ ...l, atualizado_em: agoraIso });
      return [200, { ok: true, lista: detalharLista({ id, ...l }) }];
    }
    case 'lista_apagar': return apagar('listas');
    case 'avisos': return [200, { avisos: [...avisosPendentes(await listar(base.collection('listas')), agoraIso), ...(await extra.avisosExtra(ctx))] }];
    case 'ler_print': {
      const im = lerImagens(body.imagens);
      if (!im.ok) return [400, { error: im.erro }];
      const aj = require('./prumo-lib/ajuda');
      const lim = await aj.contarLeitura(base, agoraIso, im.imagens.length);
      if (!lim.ok) return [429, { error: aj.msgLimite(lim) }];
      const r = await lerPrint(im.imagens, deps);
      return r ? [200, r] : [503, { error: 'Não consegui ler agora. Tente de novo ou digite os valores.' }];
    }
    case 'objetivo_salvar': return salvar('objetivos', validarObjetivo(body));
    case 'objetivo_listar': return [200, { objetivos: progressoObjetivos(await listar(base.collection('objetivos')), await listarCarteira(base)) }];
    case 'objetivo_apagar': {
      if (!id) return [400, { error: 'Diga qual objetivo apagar.' }];
      for (const it of (await listar(base.collection('carteira'))).filter((x) => x.objetivo_id === id)) {
        const { id: itemId, ...resto } = it;
        await base.collection('carteira').doc(itemId).set({ ...resto, objetivo_id: null, atualizado_em: agoraIso });
      }
      await base.collection('objetivos').doc(id).delete();
      return [200, { ok: true }];
    }
    case 'historico_listar': return [200, { meses: resumoHistorico(await listar(base.collection('historico'))) }];
    default: return (await extra.agirExtra(body.acao, body, ctx)) || [400, { error: 'Ação desconhecida.' }];
  }
}

exports.handler = async (event) => {
  const method = String(event.httpMethod || '').toUpperCase();
  if (method === 'OPTIONS') return { statusCode: 204, headers: makeHeaders(event), body: '' };
  // #3304: prova pública de que a cotação ao vivo funciona no ar (só dado público de mercado, nada da pessoa).
  if (method === 'GET' && event.queryStringParameters && event.queryStringParameters.acao === 'cotacao_saude') {
    const cot = require('./prumo-lib/cotacoes');
    const agora = deps.agora();
    const [c, ind] = await Promise.all([cot.cotar('MXRF11', { fetch: (...a) => fetch(...a), agora, env: process.env }), cot.indices((...a) => fetch(...a)).catch(() => ({}))]);
    const ok = !!(c.preco > 0 && !c.desatualizada);
    return responder(event, ok ? 200 : 503, { ok, ticker: 'MXRF11', preco: c.preco, fonte: c.fonte, data_hora: c.data_hora, erro: c.erro || null, cdi_dia_pct: ind.cdi_dia_pct || null, selic_ano_pct: ind.selic_ano_pct || null });
  }
  if (method !== 'POST') return responder(event, 405, { error: 'Use POST.' });
  const auth = await verifyBearerToken(event);
  if (!auth || !auth.ok) return responder(event, 401, { error: 'Entre com sua conta.' });
  const rl = await checkRateLimit(auth.uid, 'prumo').catch(() => ({ ok: true }));
  if (rl && rl.ok === false) return responder(event, 429, { error: 'Muitos pedidos seguidos. Aguarde um instante.' });
  let body;
  try { body = JSON.parse(event.body || '{}') || {}; } catch { return responder(event, 400, { error: 'Pedido inválido.' }); }
  try {
    const [status, corpo] = await agir(auth.uid, body);
    return responder(event, status, corpo);
  } catch (e) {
    console.error('[prumo] erro', body && body.acao, e && e.code);   // sem valores da pessoa
    return responder(event, 500, { error: 'Algo deu errado. Tente de novo.' });
  }
};

Object.assign(exports, { tipoPeloTicker, conferirValor, ETFS, chaveAtivo, semDuplicados, viaWorkersAi, separarLinhasIguais, tirarSubtotais, conferir, VISAO, LER_PRINT, normalizarLido, valorLido, validarItemCarteira, validarCartao, validarGasto, resumoMes, validarLista, avisosPendentes, extrairJson, lerImagens, lerPrint, validarObjetivo, progressoObjetivos, resumoHistorico, fotoDoDia, agir, deps, TIPOS, CATEGORIAS });
