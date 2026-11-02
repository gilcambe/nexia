#!/usr/bin/env node
'use strict';
// #2847 (parte 1 de #2719): confere toda semana se o modelo de teste de cada IA grátis da Central ainda existe
// (GET /models). Modelo que sumiu = aviso no log do Actions (::warning::) e saída no resumo. Só lê; não gasta pedido de chat.
// Sem a chave do provedor, pula (não é erro). Nunca imprime chave.
const { PROVEDORES } = require('../netlify/functions/central/ia-vagas');
const { PROVIDERS } = require('../nexia-ai/model-router/providers/openai-compatible');
const { aplicarVagas } = require('../nexia-ai/model-router/vagas');

const SEM_LISTA = new Set(['custom', 'openrouter', 'huggingface', 'cohere']); // sem /models compatível ou modelo "auto"

function urlModelos(id) {
  const p = PROVIDERS[id];
  return p && typeof p.url === 'string' ? p.url.replace(/\/chat\/completions$/, '/models') : null;
}
const limpar = s => String(s || '').replace(/^models\//, '');

async function conferir({ env = process.env, fetchImpl = fetch, ms = 15000 } = {}) {
  const e = aplicarVagas(env);
  const out = [];
  for (const [id, p] of Object.entries(PROVEDORES)) {
    if (SEM_LISTA.has(id)) { out.push({ id, nome: p.nome, situacao: 'nao-confere' }); continue; }
    const url = urlModelos(p.router);
    const chave = e[p.env];
    if (!url || !chave) { out.push({ id, nome: p.nome, situacao: 'sem-chave' }); continue; }
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetchImpl(url, { headers: { Authorization: `Bearer ${chave}` }, signal: ctl.signal });
      if (!r.ok) { out.push({ id, nome: p.nome, situacao: 'erro', motivo: `respondeu ${r.status}` }); continue; }
      const j = await r.json().catch(() => ({}));
      const ids = (Array.isArray(j.data) ? j.data : Array.isArray(j.models) ? j.models : []).map(m => limpar(m.id || m.name));
      out.push(ids.includes(limpar(p.modelo)) ? { id, nome: p.nome, situacao: 'ok', modelo: p.modelo } : { id, nome: p.nome, situacao: 'sumiu', modelo: p.modelo, motivo: `o modelo ${p.modelo} não está mais na lista` });
    } catch (err) {
      out.push({ id, nome: p.nome, situacao: 'erro', motivo: ctl.signal.aborted ? 'demorou demais' : 'sem conexão' });
    } finally { clearTimeout(t); }
  }
  return out;
}

if (require.main === module) {
  conferir().then(lista => {
    for (const x of lista) {
      const linha = `${x.nome}: ${x.situacao}${x.motivo ? ` (${x.motivo})` : ''}`;
      console.log(x.situacao === 'sumiu' ? `::warning title=IA grátis mudou::${linha}. Troque o modelo em netlify/functions/central/ia-vagas.js e na matriz.` : linha);
    }
  }).catch(e => { console.log(`::warning::conferência das IAs não rodou: ${e && e.message}`); });
}

module.exports = { conferir, urlModelos };
