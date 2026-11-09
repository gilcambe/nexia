'use strict';
/**
 * Prumo, Fases 2 a 4 (epic #2923): holerite e programação do salário, avaliação da carteira,
 * consultor com IA grátis, pontos e milhas. Chamado pelo `agir` de prumo.js (ações que ele não conhece).
 * Regras: só IA grátis (anthropic fora), nunca valores do dono em log, sugestões sempre com aviso legal.
 */
const MES = /^\d{4}-\d{2}$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const CATEGORIAS = ['mercado', 'casa', 'transporte', 'saude', 'lazer', 'educacao', 'restaurante', 'assinaturas', 'outros'];
const AVISO_LEGAL = 'Isto não é recomendação oficial de investimento; confira com um profissional certificado.';
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const numero = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(/\./g, '').replace(',', '.')) : NaN);
const dinheiro = (n) => Math.round(n * 100) / 100;
const erro = (m) => ({ ok: false, erro: m });

// ---------- Fase 2: holerite ----------
function listaValores(l, max) {
  const out = [];
  for (const x of Array.isArray(l) ? l.slice(0, max) : []) {
    const nome = texto(x && x.nome, 80);
    const valor = numero(x && x.valor);
    if (nome && Number.isFinite(valor) && valor >= 0) out.push({ nome, valor: dinheiro(valor) });
  }
  return out;
}
function validarHolerite(o) {
  const mes = texto(o && o.mes, 7);
  if (!MES.test(mes)) return erro('Diga o mês do holerite (AAAA-MM).');
  const bruto = numero(o.bruto), liquido = numero(o.liquido);
  if (!Number.isFinite(liquido) || liquido <= 0) return erro('O salário líquido precisa ser maior que zero.');
  if (!Number.isFinite(bruto) || bruto < liquido) return erro('O bruto precisa ser maior ou igual ao líquido.');
  return { ok: true, item: { mes, empresa: texto(o.empresa, 80), bruto: dinheiro(bruto), liquido: dinheiro(liquido), descontos: listaValores(o.descontos, 40), proventos: listaValores(o.proventos, 40) } };
}

// ---------- Fase 2: programação do salário ----------
function validarOrcamento(o) {
  const fixas = [];
  for (const f of Array.isArray(o && o.fixas) ? o.fixas.slice(0, 50) : []) {
    const nome = texto(f && f.nome, 60), valor = numero(f && f.valor), dia = Number(f && f.dia);
    if (!nome) continue;
    if (!Number.isFinite(valor) || valor <= 0) return erro(`Valor inválido em "${nome}".`);
    fixas.push({ nome, valor: dinheiro(valor), dia: Number.isInteger(dia) && dia >= 1 && dia <= 31 ? dia : null });
  }
  const guardar = [];
  for (const g of Array.isArray(o && o.guardar) ? o.guardar.slice(0, 20) : []) {
    const valor = numero(g && g.valor);
    const objetivo_id = texto(g && g.objetivo_id, 60);
    if (objetivo_id && Number.isFinite(valor) && valor > 0) guardar.push({ objetivo_id, valor: dinheiro(valor) });
  }
  const limites = {};
  for (const [k, v] of Object.entries((o && o.limites) || {})) {
    const n = numero(v);
    if (CATEGORIAS.includes(k) && Number.isFinite(n) && n > 0) limites[k] = dinheiro(n);
  }
  const renda_extra = numero(o && o.renda_extra);
  return { ok: true, item: { fixas, guardar, limites, renda_extra: Number.isFinite(renda_extra) && renda_extra > 0 ? dinheiro(renda_extra) : 0 } };
}
function montarOrcamento(renda, orc, resumo) {
  const o = orc || { fixas: [], guardar: [], limites: {} };
  const r = resumo || { total: 0, por_categoria: {} };
  const fixas = dinheiro((o.fixas || []).reduce((s, f) => s + f.valor, 0));
  const guardar = dinheiro((o.guardar || []).reduce((s, g) => s + g.valor, 0));
  const totalRenda = dinheiro((Number(renda) || 0) + (o.renda_extra || 0));
  const alertas = Object.entries(o.limites || {})
    .map(([categoria, limite]) => ({ categoria, gasto: r.por_categoria[categoria] || 0, limite }))
    .filter((a) => a.gasto > a.limite * 0.8);
  return { renda: totalRenda, fixas, guardar, cartao: dinheiro(r.total || 0), sobra: dinheiro(totalRenda - fixas - guardar - (r.total || 0)), alertas };
}

// ---------- Fase 3: avaliação da carteira (regras, sem IA) ----------
function avaliarCarteira(itens, objetivos, fixasMes) {
  const pontos = [];
  const total = (itens || []).reduce((s, i) => s + (Number(i.valor) || 0), 0);
  if (!total) return { nota: 0, pontos: [{ tipo: 'atencao', texto: 'Cadastre seus investimentos para eu avaliar a carteira.' }], aviso: AVISO_LEGAL };
  const soma = (f) => { const m = {}; for (const i of itens) { const k = f(i); m[k] = (m[k] || 0) + (Number(i.valor) || 0); } return m; };
  const porTipo = soma((i) => i.tipo || 'outro');
  const porBanco = soma((i) => (i.banco || 'Sem banco').trim());
  let nota = 10;
  const [tipoTop, vTipo] = Object.entries(porTipo).sort((a, b) => b[1] - a[1])[0];
  if (vTipo / total > 0.6 && Object.keys(porTipo).length > 0) { nota -= 2; pontos.push({ tipo: 'atencao', texto: `${Math.round((vTipo / total) * 100)}% do patrimônio está em um só tipo (${tipoTop}). Diversificar reduz o risco.` }); }
  else pontos.push({ tipo: 'ok', texto: 'Seu dinheiro está dividido entre tipos diferentes de investimento.' });
  const [bancoTop, vBanco] = Object.entries(porBanco).sort((a, b) => b[1] - a[1])[0];
  if (vBanco / total > 0.5 && Object.keys(porBanco).length > 1) { nota -= 1; pontos.push({ tipo: 'atencao', texto: `${Math.round((vBanco / total) * 100)}% está em uma só instituição (${bancoTop}).` }); }
  const garantido = soma((i) => (['renda_fixa', 'poupanca'].includes(i.tipo) ? (i.banco || 'Sem banco').trim() : '__'));
  delete garantido.__;
  for (const [b, v] of Object.entries(garantido)) if (v > 250000) { nota -= 2; pontos.push({ tipo: 'atencao', texto: `Em ${b} há mais de R$ 250 mil em renda fixa/poupança: a garantia do FGC cobre até R$ 250 mil por instituição.` }); }
  const reserva = (objetivos || []).find((o) => /reserva/i.test(o.nome || ''));
  if (fixasMes > 0) {
    const atualReserva = reserva ? itens.filter((i) => i.objetivo_id === reserva.id).reduce((s, i) => s + (Number(i.valor) || 0), 0) : 0;
    if (atualReserva < fixasMes * 6) { nota -= 2; pontos.push({ tipo: 'atencao', texto: `A reserva de emergência ideal é de 6 meses de contas fixas (cerca de R$ ${Math.round(fixasMes * 6).toLocaleString('pt-BR')}).${reserva ? '' : ' Crie um objetivo "Reserva de emergência".'}` }); }
    else pontos.push({ tipo: 'ok', texto: 'Sua reserva de emergência cobre 6 meses de contas fixas.' });
  }
  const hoje = new Date().toISOString().slice(0, 7);
  for (const o of objetivos || []) {
    const meses = (Number(o.prazo.slice(0, 4)) - Number(hoje.slice(0, 4))) * 12 + Number(o.prazo.slice(5, 7)) - Number(hoje.slice(5, 7));
    const arriscado = itens.some((i) => i.objetivo_id === o.id && ['acoes', 'cripto'].includes(i.tipo));
    if (meses <= 24 && arriscado) { nota -= 1; pontos.push({ tipo: 'atencao', texto: `"${o.nome}" vence em até 2 anos e tem ações/cripto: risco alto para prazo curto.` }); }
  }
  return { nota: Math.max(0, nota), pontos, aviso: AVISO_LEGAL };
}

// ---------- Fase 3: consultor ----------
function contextoConsultor(d) {
  const linhas = [];
  const brl = (v) => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const carteira = d.carteira || [];
  linhas.push(`Patrimônio total: ${brl(carteira.reduce((s, i) => s + (Number(i.valor) || 0), 0))}`);
  for (const i of carteira.slice(0, 40)) linhas.push(`- ${i.nome} (${i.banco || 'sem banco'}, ${i.tipo}): ${brl(i.valor)}${i.taxa ? ', ' + i.taxa : ''}${i.vencimento ? ', vence ' + i.vencimento : ''}`);
  for (const o of (d.objetivos || []).slice(0, 15)) linhas.push(`Objetivo ${o.nome}: ${brl(o.atual)} de ${brl(o.meta)} até ${o.prazo} (perfil ${o.perfil})`);
  for (const m of (d.historico || []).slice(-12)) linhas.push(`Patrimônio em ${m.mes}: ${brl(m.total)}${m.variacao != null ? ` (variação ${brl(m.variacao)})` : ''}`);
  for (const h of (d.holerites || []).slice(0, 3)) linhas.push(`Holerite ${h.mes}: bruto ${brl(h.bruto)}, líquido ${brl(h.liquido)}`);
  if (d.orcamento) linhas.push(`Mês atual: renda ${brl(d.orcamento.renda)}, fixas ${brl(d.orcamento.fixas)}, guardar ${brl(d.orcamento.guardar)}, cartão ${brl(d.orcamento.cartao)}, sobra ${brl(d.orcamento.sobra)}`);
  if (d.avaliacao) for (const p of d.avaliacao.pontos) linhas.push(`Avaliação (${p.tipo}): ${p.texto}`);
  return linhas.join('\n').slice(0, 6000);
}
const SISTEMA_CONSULTOR = `Você é o consultor financeiro do app Kernex Finance, para uma pessoa leiga no Brasil. Fale português simples, curto e gentil.
Responda usando SÓ os números do CONTEXTO (patrimônio, objetivos, histórico, holerite, orçamento). Nunca invente números; se faltar dado, diga o que a pessoa precisa cadastrar.
Explique o porquê das sugestões (prazo, risco, liquidez, garantia do FGC). Não mande comprar produto de um banco específico.`;

async function perguntarIA(deps, req, comVisao) {
  const router = deps.getRouter();
  for (const d of deps.listFor('fast').filter((x) => x.provider !== 'anthropic')) {
    try {
      const cap = router.capabilities(d);
      if (!cap.available || (comVisao && !cap.vision)) continue;
      const out = await Promise.race([router.chat(d, req), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000))]);
      if (out && out.text) return out.text;
    } catch { /* tenta o próximo modelo grátis */ }
  }
  return null;
}

const LER_HOLERITE = `Você lê holerites (contracheques) brasileiros. Responda SÓ com JSON:
{"mes":"AAAA-MM","empresa":"","bruto":0,"liquido":0,"descontos":[{"nome":"","valor":0}],"proventos":[{"nome":"","valor":0}]}
Valores em número (R$ 1.234,56 vira 1234.56). Não copie CPF, nome da pessoa nem números de documento.`;

// ---------- Fase 4: pontos e milhas ----------
function validarPontos(o) {
  const programa = texto(o && o.programa, 60);
  if (!programa) return erro('Diga o programa (ex.: Livelo, Smiles).');
  const saldo = Number(numero(o.saldo));
  if (!Number.isInteger(saldo) || saldo < 0) return erro('O saldo de pontos precisa ser um número inteiro.');
  const validade = texto(o.validade, 10);
  if (validade && !DATA.test(validade)) return erro('Validade inválida.');
  const vm = o.valor_milheiro === undefined || o.valor_milheiro === null || o.valor_milheiro === '' ? 20 : numero(o.valor_milheiro);
  if (!Number.isFinite(vm) || vm < 0) return erro('Valor do milheiro inválido.');
  return { ok: true, item: { programa, saldo, validade: validade || null, cartao_id: texto(o.cartao_id, 60) || null, valor_milheiro: dinheiro(vm) } };
}
function pontosVencendo(itens, hojeISO) {
  const hoje = Date.parse(String(hojeISO).slice(0, 10));
  return (itens || []).filter((p) => p.validade && p.saldo > 0).map((p) => ({ p, dias: Math.round((Date.parse(p.validade) - hoje) / 86400000) }))
    .filter((x) => x.dias >= 0 && x.dias <= 30)
    .map(({ p, dias }) => ({ tipo: 'pontos', id: p.id, programa: p.programa, saldo: p.saldo, validade: p.validade, dias }));
}

// ---------- Ações ----------
async function agirExtra(acao, body, c) {
  const doc = await require('./documentos').agirDoc(acao, body, c);
  if (doc) return doc;
  const fin = await require('./financas').agirFin(acao, body, c);
  if (fin) return fin;
  const cart = await require('./cartoes').agirCartoes(acao, body, c);
  if (cart) return cart;
  const sau = await require('./saude').agirSaude(acao, body, c);
  if (sau) return sau;
  const asst = await require('./assistente').agirAssistente(acao, body, c);
  if (asst) return asst;
  const div = await require('./dividas').agirDividas(acao, body, c);
  if (div) return div;
  const inv = await require('./investimentos').agirInvestimentos(acao, body, c);
  if (inv) return inv;
  const mil = await require('./milhas').agirMilhas(acao, body, c);
  if (mil) return mil;
  const eco = await require('./economizador').agirEconomizador(acao, body, c);
  if (eco) return eco;
  const met = await require('./metas').agirMetas(acao, body, c);
  if (met) return met;
  const fam = await require('./familia').agirFamilia(acao, body, c);
  if (fam) return fam;
  const imp = await require('./impostos').agirImpostos(acao, body, c);
  if (imp) return imp;
  const ale = await require('./alertas').agirAlertas(acao, body, c);
  if (ale) return ale;
  const aju = await require('./ajuda').agirAjuda(acao, body, c);
  if (aju) return aju;
  const opf = await require('./openfinance').agirOpenFinance(acao, body, c);
  if (opf) return opf;
  const { base, listar, salvar, apagar, deps, agoraIso } = c;
  const lerOrcamento = async () => { const s = await base.collection('orcamento').doc('atual').get(); return s && s.exists ? s.data() : null; };
  const holerites = async () => (await listar(base.collection('holerites'))).sort((a, b) => String(b.mes).localeCompare(String(a.mes)));
  const resumoOrcamento = async (mes) => {
    const hs = await holerites();
    const h = hs.find((x) => x.mes === mes) || hs[0];
    const orc = await lerOrcamento();
    const resumo = c.resumoMes(await listar(base.collection('gastos')), mes);
    return { mes, holerite_mes: h ? h.mes : null, ...montarOrcamento(h ? h.liquido : 0, orc, resumo), orcamento: orc || { fixas: [], guardar: [], limites: {}, renda_extra: 0 } };
  };
  switch (acao) {
    case 'holerite_ler': {
      const im = c.lerImagens(body.imagens);
      if (!im.ok) return [400, { error: im.erro }];
      if (im.imagens.length > 3) return [400, { error: 'Mande até 3 fotos do holerite.' }];
      const t = await perguntarIA(deps, { system: LER_HOLERITE, messages: [{ role: 'user', content: 'Leia este holerite e devolva o JSON.' }], images: im.imagens, maxTokens: 1500 }, true);
      const j = t && c.extrairJson(t);
      if (!j) return [503, { error: 'Não consegui ler agora. Tente de novo ou digite os valores.' }];
      const v = validarHolerite(j);
      return [200, { holerite: v.ok ? v.item : { ...j, descontos: listaValores(j.descontos, 40), proventos: listaValores(j.proventos, 40) }, problema: v.ok ? null : v.erro }];
    }
    case 'holerite_salvar': {
      const v = validarHolerite(body);
      if (!v.ok) return [400, { error: v.erro }];
      await base.collection('holerites').doc(v.item.mes).set({ ...v.item, atualizado_em: agoraIso });
      return [200, { ok: true, id: v.item.mes }];
    }
    case 'holerite_listar': return [200, { holerites: (await holerites()).slice(0, 12) }];
    case 'holerite_apagar': return apagar('holerites');
    case 'orcamento_salvar': {
      const v = validarOrcamento(body);
      if (!v.ok) return [400, { error: v.erro }];
      await base.collection('orcamento').doc('atual').set({ ...v.item, atualizado_em: agoraIso });
      return [200, { ok: true }];
    }
    case 'orcamento_resumo': {
      const mes = texto(body.mes, 7) || agoraIso.slice(0, 7);
      if (!MES.test(mes)) return [400, { error: 'O mês precisa estar no formato AAAA-MM.' }];
      return [200, await resumoOrcamento(mes)];
    }
    case 'avaliar_carteira': {
      const [itens, objetivos, orc] = await Promise.all([c.listarCarteira(), listar(base.collection('objetivos')), lerOrcamento()]);
      const fixas = orc ? orc.fixas.reduce((s, f) => s + f.valor, 0) : 0;
      return [200, avaliarCarteira(itens, objetivos, fixas)];
    }
    case 'consultor': {
      const msg = texto(body.mensagem, 1000);
      if (!msg) return [400, { error: 'Escreva sua pergunta.' }];
      const [itens, objetivosBrutos, hist, hs, orc] = await Promise.all([c.listarCarteira(), listar(base.collection('objetivos')), listar(base.collection('historico')), holerites(), resumoOrcamento(agoraIso.slice(0, 7))]);
      const objetivos = c.progressoObjetivos(objetivosBrutos, itens);
      const ctx = contextoConsultor({ carteira: itens, objetivos, historico: c.resumoHistorico(hist), holerites: hs, orcamento: orc, avaliacao: avaliarCarteira(itens, objetivosBrutos, orc.fixas) });
      const historico = (Array.isArray(body.historico) ? body.historico.slice(-10) : [])
        .filter((h) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
        .map((h) => ({ role: h.role, content: h.content.slice(0, 800) }));
      const t = await perguntarIA(deps, { system: `${SISTEMA_CONSULTOR}\n\nCONTEXTO:\n${ctx}`, messages: [...historico, { role: 'user', content: msg }], maxTokens: 900 }, false);
      if (!t) return [503, { error: 'O consultor não respondeu agora. Tente de novo em instantes.' }];
      return [200, { resposta: `${t.trim()}\n\n⚠️ Não é recomendação oficial de investimento.` }];
    }
    case 'pontos_salvar': return salvar('pontos', validarPontos(body));
    case 'pontos_apagar': return apagar('pontos');
    case 'pontos_listar': {
      const itens = (await listar(base.collection('pontos'))).sort((a, b) => String(a.programa).localeCompare(String(b.programa), 'pt-BR'));
      return [200, { itens, total_estimado: dinheiro(itens.reduce((s, p) => s + (p.saldo / 1000) * (p.valor_milheiro || 0), 0)), vencendo: pontosVencendo(itens, agoraIso) }];
    }
    default: return null;
  }
}

/** Avisos extras (pontos vencendo em até 30 dias) somados aos da lista de compras. */
async function avisosExtra(c) {
  try { return pontosVencendo(await c.listar(c.base.collection('pontos')), c.agoraIso); } catch { return []; }
}

module.exports = { agirExtra, avisosExtra, validarHolerite, validarOrcamento, montarOrcamento, avaliarCarteira, contextoConsultor, validarPontos, pontosVencendo, AVISO_LEGAL };
