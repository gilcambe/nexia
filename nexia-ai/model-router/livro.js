'use strict';
// Livro de cotas (#3377 parte 1/#3581, 13/11/2026): uma linha por provedor com o uso de hoje e de ontem,
// os modelos bloqueados agora (sem cota / disjuntor) e até quando, e se o provedor treina com os dados.
// Só LÊ o que o roteador já grava no D1 (cota.js: ia_cota/placar e ia_cota/uso). Nenhuma chave sai daqui.
// Sem D1 ou sem registro: "sem dados" (nunca inventa número).
const { DOC_USO } = require('./cota');

const DOC_PLACAR = 'ia_cota/placar';
// Regra 6 do #3377: código/dados de cliente só vão a provedor que NÃO treina com eles.
// 'depende' = varia por modelo; 'nao-informado' = sem fonte conferida (trate como "não mandar dado de cliente").
const TREINA = {
  groq: 'nao', cloudflare: 'nao', 'workers-ai': 'nao', anthropic: 'nao', maquinas: 'nao', ollama: 'nao',
  gemini: 'sim', google: 'sim', openrouter: 'depende',
};
const podeDadoDeCliente = (provedor) => TREINA[String(provedor || '').toLowerCase()] === 'nao';

const MOTIVO = { daily: 'cota do dia acabou', rate: 'limite por minuto', fatal: 'chave/conta com erro', busy: 'ocupado', circuito: 'falhou seguidas vezes (disjuntor)' };
const dia = (t) => new Date(t).toISOString().slice(0, 10);

function montarLivro({ placar = {}, uso = {}, atualizadoEm = null }, agora = Date.now()) {
  const hoje = dia(agora); const ontem = dia(agora - 864e5);
  const linhas = {};
  const linha = (p) => (linhas[p] = linhas[p] || { provedor: p, hoje: null, ontem: null, bloqueados: [], treina: TREINA[p] || 'nao-informado', dadoDeCliente: podeDadoDeCliente(p) });
  for (const [k, v] of Object.entries(uso || {})) {
    const i = k.lastIndexOf(':'); const p = k.slice(0, i); const d = k.slice(i + 1);
    if (d === hoje) linha(p).hoje = { pedidos: v.requests || 0, tokens: v.tokens || 0, semCota: v.errors || 0 };
    else if (d === ontem) linha(p).ontem = { pedidos: v.requests || 0, tokens: v.tokens || 0, semCota: v.errors || 0 };
  }
  for (const [k, v] of Object.entries(placar || {})) {
    if (k.startsWith('_') || !v || typeof v.ate !== 'number' || v.ate <= agora) continue;
    const i = k.indexOf('|'); const p = i > 0 ? k.slice(0, i) : k;
    linha(p).bloqueados.push({ modelo: i > 0 ? k.slice(i + 1) : k, ate: new Date(v.ate).toISOString(), motivo: MOTIVO[v.motivo] || v.motivo || 'bloqueado' });
  }
  const lista = Object.values(linhas).map((l) => ({ ...l, situacao: l.bloqueados.length && !(l.hoje && l.hoje.pedidos) ? 'sem-cota' : l.bloqueados.length ? 'parcial' : l.hoje && l.hoje.pedidos ? 'ativa' : 'ociosa' }))
    .sort((a, b) => ((b.hoje && b.hoje.pedidos) || 0) - ((a.hoje && a.hoje.pedidos) || 0) || a.provedor.localeCompare(b.provedor));
  return { linhas: lista, dia: hoje, atualizadoEm, fonte: lista.length ? 'Roteador de IA (D1)' : 'sem dados' };
}

async function lerLivro(env = process.env, { driver = null, agora = Date.now() } = {}) {
  let d = driver;
  if (!d) {
    if (!env.NEXIA_D1_TOKEN || !env.NEXIA_D1_ACCOUNT_ID) return { linhas: [], dia: dia(agora), atualizadoEm: null, fonte: 'sem dados', aviso: 'Banco D1 não configurado.' };
    const { createD1Driver } = require('../../lib/firebase-lite/d1-backend');
    d = createD1Driver({ token: env.NEXIA_D1_TOKEN, accountId: env.NEXIA_D1_ACCOUNT_ID });
  }
  const m = await d.get([DOC_PLACAR, DOC_USO]);
  const p = m.get(DOC_PLACAR); const u = m.get(DOC_USO);
  const datas = [p && p.update_time, u && u.update_time].filter(Boolean).sort();
  return montarLivro({ placar: p && p.fields && p.fields.placar, uso: u && u.fields && u.fields.uso, atualizadoEm: datas.pop() || null }, agora);
}

module.exports = { montarLivro, lerLivro, podeDadoDeCliente, TREINA };
