'use strict';
/**
 * Prumo — app de finanças pessoais do dono (epic #2923).
 * POST /api/prumo { acao, ...dados }. Todas as ações exigem login (Bearer do Firebase).
 * Dados em prumo_users/{uid}/{carteira|cartoes|gastos|listas|objetivos|historico}/{id}, gravados só por esta API.
 * Regras: nunca pede senha de banco (dados entram por print, PDF ou digitação) e nunca escreve valores do dono em log.
 */
const { verifyBearerToken, checkRateLimit, makeHeaders } = require('./middleware');

const TIPOS = ['renda_fixa', 'acoes', 'fiis', 'fundos', 'tesouro', 'cripto', 'previdencia', 'fgts', 'poupanca', 'conta', 'outro'];
const CATEGORIAS = ['mercado', 'casa', 'transporte', 'saude', 'lazer', 'educacao', 'restaurante', 'assinaturas', 'outros'];
const PERFIS = ['conservador', 'moderado', 'arrojado'];
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const MES = /^\d{4}-\d{2}$/;

const resposta = (event, statusCode, body) => ({ statusCode, headers: makeHeaders(event), body: JSON.stringify(body) });
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(/\./g, '').replace(',', '.')) : NaN);
const hoje = () => new Date().toISOString().slice(0, 10);
const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const idValido = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,60}$/.test(id);
const r2 = (n) => Math.round(n * 100) / 100;

function validarItemCarteira(o) {
  if (!o || typeof o !== 'object') return { ok: false, erro: 'Item inválido.' };
  const nome = texto(o.nome, 120);
  if (!nome) return { ok: false, erro: 'Dê um nome ao investimento.' };
  const valor = num(o.valor);
  if (!Number.isFinite(valor) || valor < 0) return { ok: false, erro: `Valor inválido em "${nome}".` };
  const tipo = TIPOS.includes(o.tipo) ? o.tipo : (o.tipo ? null : 'outro');
  if (!tipo) return { ok: false, erro: `Tipo inválido em "${nome}".` };
  const item = { nome, banco: texto(o.banco, 80), tipo, valor: r2(valor), data_valor: DATA.test(o.data_valor || '') ? o.data_valor : hoje() };
  if (DATA.test(o.vencimento || '')) item.vencimento = o.vencimento;
  if (o.taxa) item.taxa = texto(String(o.taxa), 60);
  if (o.objetivo_id && idValido(o.objetivo_id)) item.objetivo_id = o.objetivo_id;
  return { ok: true, item };
}

function validarCartao(o) {
  const nome = texto(o && o.nome, 60);
  if (!nome) return { ok: false, erro: 'Dê um nome ao cartão.' };
  const limite = num(o.limite);
  const fech = Number(o.dia_fechamento), venc = Number(o.dia_vencimento);
  if (!Number.isFinite(limite) || limite < 0) return { ok: false, erro: 'Limite inválido.' };
  if (!Number.isInteger(fech) || fech < 1 || fech > 31 || !Number.isInteger(venc) || venc < 1 || venc > 31) return { ok: false, erro: 'Dia de fechamento e vencimento: de 1 a 31.' };
  return { ok: true, item: { nome, limite: r2(limite), dia_fechamento: fech, dia_vencimento: venc, programa_pontos: texto(o.programa_pontos, 60) } };
}

function validarGasto(o) {
  if (!o || !idValido(o.cartao_id)) return { ok: false, erro: 'Escolha o cartão.' };
  const descricao = texto(o.descricao, 120);
  if (!descricao) return { ok: false, erro: 'Escreva o que foi comprado.' };
  const valor = num(o.valor);
  if (!Number.isFinite(valor) || valor <= 0) return { ok: false, erro: 'Valor deve ser maior que zero.' };
  if (!DATA.test(o.data || '')) return { ok: false, erro: 'Data inválida.' };
  if (!CATEGORIAS.includes(o.categoria)) return { ok: false, erro: 'Categoria inválida.' };
  const parcelas = o.parcelas == null || o.parcelas === '' ? 1 : Number(o.parcelas);
  if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > 48) return { ok: false, erro: 'Parcelas: de 1 a 48.' };
  return { ok: true, item: { cartao_id: o.cartao_id, descricao, valor: r2(valor), data: o.data, categoria: o.categoria, parcelas } };
}

const mesesEntre = (a, b) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));

/** Gastos que caem no mês (AAAA-MM). Parcelado conta valor/parcelas em cada mês da parcela. */
function resumoMes(gastos, mes) {
  const lista = [];
  const por_categoria = {}, por_cartao = {};
  let total = 0;
  for (const g of gastos || []) {
    const k = mesesEntre(String(g.data).slice(0, 7), mes);
    const n = g.parcelas || 1;
    if (k < 0 || k >= n) continue;
    const v = r2(g.valor / n);
    lista.push({ ...g, valor_mes: v, parcela: n > 1 ? `${k + 1}/${n}` : '' });
    total += v;
    por_categoria[g.categoria] = r2((por_categoria[g.categoria] || 0) + v);
    por_cartao[g.cartao_id] = r2((por_cartao[g.cartao_id] || 0) + v);
  }
  lista.sort((a, b) => String(b.data).localeCompare(String(a.data)));
  return { gastos: lista, total: r2(total), por_categoria, por_cartao };
}

function validarLista(o) {
  const nome = texto(o && o.nome, 80);
  if (!nome) return { ok: false, erro: 'Dê um nome à lista.' };
  const itens = [];
  for (const i of Array.isArray(o.itens) ? o.itens.slice(0, 200) : []) {
    const n = texto(i && i.nome, 80);
    if (!n) continue;
    const qtd = num(i.qtd);
    const p = num(i.preco_estimado);
    itens.push({ nome: n, qtd: Number.isFinite(qtd) && qtd > 0 ? qtd : 1, unidade: texto(i.unidade, 10), ...(Number.isFinite(p) && p >= 0 ? { preco_estimado: r2(p) } : {}), comprado: i.comprado === true });
  }
  const item = { nome, itens };
  if (o.lembrete && !Number.isNaN(Date.parse(o.lembrete))) item.lembrete = new Date(o.lembrete).toISOString();
  return { ok: true, item };
}

function avisosPendentes(listas, agoraISO) {
  const agora = Date.parse(agoraISO || new Date().toISOString());
  return (listas || [])
    .filter((l) => l.lembrete && Date.parse(l.lembrete) <= agora && (l.itens || []).some((i) => !i.comprado))
    .map((l) => ({ id: l.id, nome: l.nome, faltam: l.itens.filter((i) => !i.comprado).length, lembrete: l.lembrete }));
}

function validarObjetivo(o) {
  const nome = texto(o && o.nome, 80);
  if (!nome) return { ok: false, erro: 'Dê um nome ao objetivo.' };
  const meta = num(o.meta);
  if (!Number.isFinite(meta) || meta <= 0) return { ok: false, erro: 'A meta deve ser maior que zero.' };
  if (!MES.test(o.prazo || '')) return { ok: false, erro: 'Escolha o prazo (mês e ano).' };
  const aporte = num(o.aporte_mensal);
  return { ok: true, item: { nome, meta: r2(meta), prazo: o.prazo, aporte_mensal: Number.isFinite(aporte) && aporte >= 0 ? r2(aporte) : 0, perfil: PERFIS.includes(o.perfil) ? o.perfil : 'moderado', cor: texto(o.cor, 20) } };
}

function progressoObjetivos(objetivos, itens, mesAtual) {
  const mes = mesAtual || hoje().slice(0, 7);
  return (objetivos || []).map((o) => {
    const atual = r2((itens || []).filter((i) => i.objetivo_id === o.id).reduce((s, i) => s + (i.valor || 0), 0));
    const falta = r2(Math.max(0, o.meta - atual));
    const meses = Math.max(1, mesesEntre(mes, o.prazo));
    return { ...o, atual, falta, percentual: Math.min(100, Math.round((atual / o.meta) * 1000) / 10), por_mes: r2(falta / meses) };
  });
}

function fotoPatrimonio(itens) {
  const por_tipo = {}, por_objetivo = {};
  let total = 0;
  for (const i of itens) {
    total += i.valor || 0;
    por_tipo[i.tipo] = r2((por_tipo[i.tipo] || 0) + i.valor);
    const ob = i.objetivo_id || 'sem';
    por_objetivo[ob] = r2((por_objetivo[ob] || 0) + i.valor);
  }
  return { total: r2(total), por_tipo, por_objetivo };
}

/** Um ponto por mês (último registro do mês), últimos 24 meses, com variação contra o mês anterior. */
function resumoHistorico(registros) {
  const porMes = {};
  for (const r of (registros || []).slice().sort((a, b) => String(a.id).localeCompare(String(b.id)))) porMes[String(r.id).slice(0, 7)] = r;
  const pontos = Object.keys(porMes).sort().slice(-24).map((m) => ({ mes: m, total: porMes[m].total || 0 }));
  let variacao = null;
  if (pontos.length >= 2) {
    const a = pontos[pontos.length - 2].total, b = pontos[pontos.length - 1].total;
    variacao = { valor: r2(b - a), percentual: a ? Math.round(((b - a) / a) * 1000) / 10 : null };
  }
  return { pontos, variacao };
}

function extrairJson(t) {
  if (typeof t !== 'string') return null;
  const cerca = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  const s = cerca ? cerca[1] : t;
  const ini = s.indexOf('{');
  const fim = s.lastIndexOf('}');
  if (ini < 0 || fim <= ini) return null;
  try { return JSON.parse(s.slice(ini, fim + 1)); } catch { return null; }
}

const PROMPT_PRINT = `Você lê prints de aplicativos de banco, corretora, previdência e FGTS do Brasil.
Responda SÓ com JSON, sem texto antes ou depois, neste formato:
{"itens":[{"nome":"","banco":"","tipo":"","valor":0,"data_valor":"AAAA-MM-DD","vencimento":"AAAA-MM-DD","taxa":""}]}
tipo deve ser um destes: ${TIPOS.join(', ')}.
valor é o saldo atual em reais, como número (R$ 1.234,56 vira 1234.56). Um item por investimento/aplicação visível.
Se o print mostrar só o total de uma categoria (ex.: "Renda fixa R$ 50.000"), crie um item com esse total. Deixe vazio o que não aparece. Não invente valores.`;

async function lerImagens(images) {
  const { getRouter } = require('../../nexia-ai/model-router');
  const { listFor } = require('../../nexia-ai/orchestrator/models');
  const router = getRouter();
  for (const d of listFor('fast').filter((x) => x.provider !== 'anthropic')) {
    try {
      const cap = router.capabilities(d);
      if (!cap.available || !cap.vision) continue;
      const out = await Promise.race([
        router.chat(d, { system: PROMPT_PRINT, messages: [{ role: 'user', content: `Leia ${images.length > 1 ? 'estes prints' : 'este print'} e devolva o JSON.` }], maxTokens: 2500, images }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000)),
      ]);
      const j = out && extrairJson(out.text);
      if (j && Array.isArray(j.itens)) return j.itens;
    } catch { /* tenta o próximo modelo grátis */ }
  }
  return null;
}

function lerImagensEntrada(body) {
  const brutas = Array.isArray(body.imagens) ? body.imagens : typeof body.imagem === 'string' ? [body.imagem] : [];
  if (!brutas.length || brutas.length > 5) return { erro: 'Mande de 1 a 5 prints.' };
  const images = [];
  for (const b of brutas) {
    const m = typeof b === 'string' ? /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(b) : null;
    if (!m) return { erro: 'Imagem inválida. Mande um print em JPG ou PNG.' };
    if (m[2].length > 4 * 1024 * 1024 * 4 / 3) return { erro: 'Imagem grande demais.' };
    images.push({ mime: m[1], data: m[2] });
  }
  return { images };
}

async function listar(ref) {
  const snap = await ref.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function gravarHistorico(base) {
  const itens = await listar(base.collection('carteira'));
  await base.collection('historico').doc(hoje()).set({ ...fotoPatrimonio(itens), atualizado_em: new Date().toISOString() });
}

async function executar(acao, body, base) {
  const agora = new Date().toISOString();
  const salvar = async (col, v, extra) => {
    if (!v.ok) return [400, { error: v.erro }];
    const id = idValido(body.id) ? body.id : novoId();
    await base.collection(col).doc(id).set({ ...v.item, ...(extra || {}), atualizado_em: agora });
    return [200, { ok: true, id }];
  };
  const apagar = async (col) => {
    if (!idValido(body.id)) return [400, { error: 'Item não encontrado.' }];
    await base.collection(col).doc(body.id).delete();
    return [200, { ok: true }];
  };
  switch (acao) {
    case 'carteira_listar': {
      const itens = (await listar(base.collection('carteira'))).sort((a, b) => a.nome.localeCompare(b.nome));
      return [200, { itens, ...fotoPatrimonio(itens) }];
    }
    case 'carteira_salvar': {
      const r = await salvar('carteira', validarItemCarteira(body));
      if (r[0] === 200) await gravarHistorico(base);
      return r;
    }
    case 'carteira_salvar_varios': {
      const lista = Array.isArray(body.itens) ? body.itens.slice(0, 60) : [];
      const atuais = await listar(base.collection('carteira'));
      let salvos = 0;
      for (const bruto of lista) {
        const v = validarItemCarteira(bruto);
        if (!v.ok) continue;
        // Mesmo nome + banco = atualiza o valor (não duplica quando o dono manda o print de novo).
        const igual = atuais.find((a) => a.nome.toLowerCase() === v.item.nome.toLowerCase() && (a.banco || '').toLowerCase() === v.item.banco.toLowerCase());
        const id = igual ? igual.id : novoId();
        const { id: _ignorar, ...antigo } = igual || {};
        await base.collection('carteira').doc(id).set({ ...antigo, ...v.item, atualizado_em: agora });
        salvos++;
      }
      if (salvos) await gravarHistorico(base);
      return [200, { ok: true, salvos }];
    }
    case 'carteira_apagar': {
      const r = await apagar('carteira');
      if (r[0] === 200) await gravarHistorico(base);
      return r;
    }
    case 'cartao_listar': return [200, { cartoes: (await listar(base.collection('cartoes'))).sort((a, b) => a.nome.localeCompare(b.nome)) }];
    case 'cartao_salvar': return salvar('cartoes', validarCartao(body));
    case 'cartao_apagar': return apagar('cartoes');
    case 'gasto_salvar': return salvar('gastos', validarGasto(body));
    case 'gasto_apagar': return apagar('gastos');
    case 'gasto_listar': {
      const mes = MES.test(body.mes || '') ? body.mes : hoje().slice(0, 7);
      return [200, { mes, ...resumoMes(await listar(base.collection('gastos')), mes) }];
    }
    case 'lista_listar': {
      const listas = (await listar(base.collection('listas'))).map((l) => ({
        ...l,
        faltam: (l.itens || []).filter((i) => !i.comprado).length,
        total_estimado: r2((l.itens || []).reduce((s, i) => s + (i.preco_estimado || 0) * (i.qtd || 1), 0)),
      }));
      return [200, { listas }];
    }
    case 'lista_salvar': return salvar('listas', validarLista(body));
    case 'lista_apagar': return apagar('listas');
    case 'lista_marcar': {
      if (!idValido(body.id)) return [400, { error: 'Lista não encontrada.' }];
      const ref = base.collection('listas').doc(body.id);
      const snap = await ref.get();
      if (!snap.exists) return [404, { error: 'Lista não encontrada.' }];
      const l = snap.data();
      const i = Number(body.indice);
      if (!Array.isArray(l.itens) || !Number.isInteger(i) || !l.itens[i]) return [400, { error: 'Item não encontrado.' }];
      l.itens[i].comprado = body.comprado === true;
      await ref.set({ ...l, atualizado_em: agora });
      return [200, { ok: true }];
    }
    case 'avisos': return [200, { avisos: avisosPendentes(await listar(base.collection('listas')), agora) }];
    case 'objetivo_listar': {
      const [objetivos, itens] = await Promise.all([listar(base.collection('objetivos')), listar(base.collection('carteira'))]);
      return [200, { objetivos: progressoObjetivos(objetivos, itens).sort((a, b) => a.prazo.localeCompare(b.prazo)) }];
    }
    case 'objetivo_salvar': return salvar('objetivos', validarObjetivo(body));
    case 'objetivo_apagar': return apagar('objetivos');
    case 'historico_listar': return [200, resumoHistorico(await listar(base.collection('historico')))];
    case 'ler_print': {
      const e = lerImagensEntrada(body);
      if (e.erro) return [400, { error: e.erro }];
      const brutos = await lerImagens(e.images);
      if (!brutos) return [503, { error: 'Não consegui ler agora. Tente de novo ou digite os valores.' }];
      const itens = [], descartados = [];
      for (const b of brutos) { const v = validarItemCarteira({ ...b, tipo: TIPOS.includes(b && b.tipo) ? b.tipo : 'outro' }); if (v.ok) itens.push(v.item); else descartados.push({ ...b, erro: v.erro }); }
      return [200, { itens, descartados }];
    }
    default: return [400, { error: 'Ação desconhecida.' }];
  }
}

exports.handler = async (event) => {
  const method = String(event.httpMethod || '').toUpperCase();
  if (method === 'OPTIONS') return { statusCode: 204, headers: makeHeaders(event), body: '' };
  if (method !== 'POST') return resposta(event, 405, { error: 'Method Not Allowed' });
  const auth = await verifyBearerToken(event);
  if (!auth.ok) return resposta(event, 401, { error: 'Entre com sua conta.' });
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return resposta(event, 400, { error: 'Pedido inválido.' }); }
  const acao = String(body.acao || '');
  const rl = await checkRateLimit(auth.uid, acao === 'ler_print' ? 'prumo-print' : 'prumo');
  if (!rl.ok) return resposta(event, 429, { error: 'Muitos pedidos seguidos. Aguarde um instante.' });
  const { db } = require('./firebase-init');
  if (!db) return resposta(event, 503, { error: 'Serviço indisponível. Tente em instantes.' });
  try {
    const [status, out] = await executar(acao, body, db.collection('prumo_users').doc(auth.uid));
    return resposta(event, status, out);
  } catch (e) {
    console.error('[prumo]', acao, e && e.message ? e.message.slice(0, 200) : 'erro'); // sem dados do dono
    return resposta(event, 500, { error: 'Algo deu errado. Tente de novo.' });
  }
};

exports.executar = executar; // para teste com banco em memória
exports.validarItemCarteira = validarItemCarteira;
exports.validarCartao = validarCartao;
exports.validarGasto = validarGasto;
exports.validarLista = validarLista;
exports.validarObjetivo = validarObjetivo;
exports.resumoMes = resumoMes;
exports.avisosPendentes = avisosPendentes;
exports.progressoObjetivos = progressoObjetivos;
exports.resumoHistorico = resumoHistorico;
exports.extrairJson = extrairJson;
exports.lerImagensEntrada = lerImagensEntrada;
