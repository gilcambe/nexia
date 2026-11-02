'use strict';

// Prumo (epic #2923): finanças pessoais do dono. API /api/prumo. Partes #2924 (carteira), #2925 (cartões e gastos),
// #2926 (lista de compras), #2927 (ler print com IA grátis) e #2936 (objetivos e histórico).
// Dados em prumo_users/{uid}/{colecao}/{id}, gravados SÓ aqui (servidor); cada pessoa só vê os seus.
// Nunca pede senha de banco. Nunca escreve valores da pessoa em log.

const { verifyBearerToken, checkRateLimit, makeHeaders } = require('./middleware');
const extra = require('./prumo-extra');

const TIPOS = ['renda_fixa', 'acoes', 'fundos', 'tesouro', 'cripto', 'previdencia', 'fgts', 'poupanca', 'outro'];
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
  return { ok: true, item: { nome, limite: dinheiro(limite), dia_fechamento: Number(o.dia_fechamento), dia_vencimento: Number(o.dia_vencimento), programa_pontos: texto(o.programa_pontos, 60) || null } };
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
const LER_PRINT = `Você lê prints de extratos e carteiras de investimento brasileiros (banco, corretora, previdência, FGTS). Devolva SOMENTE um JSON, sem texto fora dele: {"itens":[{"nome":"","banco":"","tipo":"","valor":0,"data_valor":"AAAA-MM-DD","vencimento":"AAAA-MM-DD ou null","taxa":""}]}. tipo é um destes: ${TIPOS.join(', ')}. Valores em número com ponto decimal (1.234,56 vira 1234.56). Não invente nada que não esteja legível.`;
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
async function lerPrint(imagens, deps) {
  const router = deps.getRouter();
  const itens = []; const descartados = [];
  let algum = false;
  for (const img of imagens) {
    let lido = null;
    for (const d of deps.listFor('fast').filter((x) => x.provider !== 'anthropic')) {
      try {
        const cap = router.capabilities(d);
        if (!cap.available || !cap.vision) continue;
        const out = await Promise.race([router.chat(d, { system: LER_PRINT, messages: [{ role: 'user', content: 'Leia este print e devolva o JSON.' }], images: [img], maxTokens: 1500 }), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000))]);
        const j = extrairJson(out && out.text);
        if (j && Array.isArray(j.itens)) { lido = j.itens; break; }
      } catch { /* tenta o próximo modelo */ }
    }
    if (!lido) continue;
    algum = true;
    for (const bruto of lido) { const v = validarItemCarteira(bruto); if (v.ok) itens.push(v.item); else descartados.push({ ...bruto, motivo: v.erro }); }
  }
  return algum ? { itens, descartados } : null;
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
async function gravarHistorico(base) {
  const itens = await listar(base.collection('carteira'));
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

  // Fases 2 a 4 (holerite, orçamento, consultor, milhas) ficam em prumo-extra.js.
  const ctx = { base, listar, salvar, apagar, deps, agoraIso, lerImagens, extrairJson, resumoMes, progressoObjetivos, resumoHistorico };
  switch (body.acao) {
    case 'carteira_listar': return [200, { itens: (await listar(base.collection('carteira'))).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR')) }];
    case 'carteira_salvar': { const r = await salvar('carteira', validarItemCarteira(body)); if (r[0] === 200) await gravarHistorico(base); return r; }
    case 'carteira_apagar': { const r = await apagar('carteira'); if (r[0] === 200) await gravarHistorico(base); return r; }
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
      const r = await lerPrint(im.imagens, deps);
      return r ? [200, r] : [503, { error: 'Não consegui ler agora. Tente de novo ou digite os valores.' }];
    }
    case 'objetivo_salvar': return salvar('objetivos', validarObjetivo(body));
    case 'objetivo_listar': return [200, { objetivos: progressoObjetivos(await listar(base.collection('objetivos')), await listar(base.collection('carteira'))) }];
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

Object.assign(exports, { validarItemCarteira, validarCartao, validarGasto, resumoMes, validarLista, avisosPendentes, extrairJson, lerImagens, lerPrint, validarObjetivo, progressoObjetivos, resumoHistorico, fotoDoDia, agir, deps, TIPOS, CATEGORIAS });
