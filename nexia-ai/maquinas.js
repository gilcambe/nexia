'use strict';
// #1846: máquinas do dono (PCs com Ollama) ligadas ao Cortex SEM túnel. O PC é que chama o Worker:
// manda o pulso, pega uma tarefa leve e devolve o resultado. Token próprio (NEXIA_MAQUINA_TOKEN, 24+
// letras); sem ele as rotas não existem. Dados no D1 grátis (mesmo banco do placar, coleções
// maquinas e tarefas_locais). Só tarefas internas leves: as IAs pequenas não atendem cliente.
const crypto = require('crypto');

const NOME_RE = /^[A-Za-z0-9_-]{1,40}$/;
const ONLINE_MS = 2 * 60 * 1000;
const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);

function tokenOk(event, env) {
  const segredo = env.NEXIA_MAQUINA_TOKEN || '';
  if (segredo.length < 24) return null;   // rota desligada
  const h = event.headers || {};
  const m = /^Bearer\s+(.+)$/i.exec(String(h.authorization || h.Authorization || ''));
  const a = Buffer.from(m ? m[1].trim() : ''), b = Buffer.from(segredo);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function driverPadrao(env) {
  if (!env.NEXIA_D1_TOKEN || !env.NEXIA_D1_ACCOUNT_ID) return null;
  const { createD1Driver } = require('../lib/firebase-lite/d1-backend');
  return createD1Driver({ token: env.NEXIA_D1_TOKEN, accountId: env.NEXIA_D1_ACCOUNT_ID });
}

function createMaquinas({ env = process.env, driver, agora = () => new Date() } = {}) {
  const d = () => driver || (driver = driverPadrao(env));
  const iso = () => agora().toISOString();
  const up = (path, fields, create_time) => ({ type: 'upsert', path, fields, create_time: create_time || iso(), update_time: iso() });

  async function pulso(nome, b) {
    const fields = {
      nome, cpu: String(b.cpu || '').slice(0, 120), ramTotal: num(b.ramTotal), ramLivre: num(b.ramLivre),
      modelos: Array.isArray(b.modelos) ? b.modelos.slice(0, 20).map(m => String(m).slice(0, 60)) : [],
      ollamaOk: b.ollamaOk === true, visto_em: iso(),
    };
    const path = `maquinas/${nome}`;
    const atual = (await d().get([path])).get(path);
    await d().apply([up(path, { ...(atual ? atual.fields : {}), ...fields }, atual && atual.create_time)]);
    return fields;
  }

  // 13/11: 'agy' (Gemini do dono pelo Antigravity CLI) só vai para o ajudante agy-trabalhador.ps1 (?modelos=agy);
  // os PCs com Ollama pegam todo o resto e usam o modelo que tiverem (agente.ps1 cai no do config).
  async function pegarTarefa(nome, modelos = []) {
    const souAgy = modelos.includes('agy');
    const lista = (await d().list('', 'tarefas_locais', false))
      .filter(t => t.fields.status === 'pendente' && (souAgy ? t.fields.modelo === 'agy' : t.fields.modelo !== 'agy'));
    if (!lista.length) return null;
    lista.sort((x, y) => (x.create_time < y.create_time ? -1 : 1));
    const t = lista[0];
    const fields = { ...t.fields, status: 'rodando', maquina: nome, pego_em: iso() };
    await d().apply([up(t.path, fields, t.create_time)]);
    return { id: t.path.split('/').pop(), ...fields };
  }

  async function resultado(nome, b) {
    const id = String(b.id || '');
    if (!NOME_RE.test(id)) return { erro: 'id inválido' };
    const path = `tarefas_locais/${id}`;
    const t = (await d().get([path])).get(path);
    if (!t || t.fields.maquina !== nome) return { erro: 'tarefa não é desta máquina' };
    const fields = { ...t.fields, status: b.erro ? 'erro' : 'feito', texto: String(b.texto || '').slice(0, 20000),
      erro: b.erro ? String(b.erro).slice(0, 500) : null, ms: num(b.ms), tokens: num(b.tokens), feito_em: iso() };
    await d().apply([up(path, fields, t.create_time)]);
    const mp = `maquinas/${nome}`;
    const m = (await d().get([mp])).get(mp);
    if (m && !b.erro) await d().apply([up(mp, { ...m.fields, feitas: (m.fields.feitas || 0) + 1, tokens: (m.fields.tokens || 0) + (num(b.tokens) || 0) }, m.create_time)]);
    return { ok: true };
  }

  /** Enfileira tarefa leve (usada pelo provedor `local`, #1864). */
  // max_tokens (11/11/2026): tarefas de código do executor de contrato pedem resposta maior; o agente repassa ao Ollama.
  async function criarTarefa({ tipo = 'texto', modelo = '', mensagens = [], max_tokens = 0 }) {
    const id = `t${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
    await d().apply([up(`tarefas_locais/${id}`, { tipo, modelo, mensagens, ...(max_tokens ? { max_tokens: Math.min(8192, Number(max_tokens) || 0) } : {}), status: 'pendente' })]);
    return id;
  }

  /** Lê uma tarefa (o provedor `maquinas` espera o resultado por aqui). */
  async function lerTarefa(id) {
    if (!NOME_RE.test(String(id || ''))) return null;
    const path = `tarefas_locais/${id}`;
    const t = (await d().get([path])).get(path);
    return t ? t.fields : null;
  }

  /** Quadro de tarefas dos PCs (T:\equipe\tarefas.json), mandado pelo PC; a Central só lê. */
  async function salvarQuadro(nome, b) {
    const tarefas = (Array.isArray(b.tarefas) ? b.tarefas : []).slice(0, 300).map(t => ({
      id: num(t.id), titulo: String(t.titulo || '').slice(0, 200), status: String(t.status || '').slice(0, 20),
      dono: String(t.dono || '').slice(0, 20), quando: String(t.quando || '').slice(0, 30),
    })).filter(t => t.id !== null);
    await d().apply([up('equipe/quadro', { tarefas, enviado_por: nome, em: iso() })]);
    return { ok: true, tarefas: tarefas.length };
  }

  async function lerQuadro() {
    const q = (await d().get(['equipe/quadro'])).get('equipe/quadro');
    return q ? { tarefas: q.fields.tarefas || [], em: q.fields.em || null, enviado_por: q.fields.enviado_por || '' } : { tarefas: [], em: null };
  }

  async function listar() {
    const t = agora().getTime();
    return (await d().list('', 'maquinas', false)).map(m => ({ ...m.fields, online: t - Date.parse(m.fields.visto_em || 0) < ONLINE_MS }));
  }

  /** Rotas do PC: /api/nexia/maquinas/{pulso|tarefa|resultado|quadro}. Devolve null se não for rota daqui. */
  async function rotaDoPc(event, json) {
    const parts = (event.path || '').replace(/^\/api\/nexia\/?/, '').split('/').filter(Boolean);
    if (parts[0] !== 'maquinas' || parts.length !== 2 || !['pulso', 'tarefa', 'resultado', 'quadro'].includes(parts[1])) return null;
    const ok = tokenOk(event, env);
    if (ok === null || !d()) return json(event, 404, { error: 'Rota não encontrada.' });
    if (!ok) return json(event, 401, { error: 'Não autenticado.' });
    let b = {};
    try { b = event.body ? JSON.parse(event.body) : {}; } catch { return json(event, 400, { error: 'JSON inválido.' }); }
    const q = event.queryStringParameters || {};
    const nome = String(b.nome || q.nome || '');
    if (!NOME_RE.test(nome)) return json(event, 400, { error: 'nome inválido (letras, números, - e _).' });
    const m = event.httpMethod;
    if (parts[1] === 'pulso' && m === 'POST') return json(event, 200, await pulso(nome, b));
    if (parts[1] === 'quadro' && m === 'POST') return json(event, 200, await salvarQuadro(nome, b));
    if (parts[1] === 'tarefa' && m === 'GET') {
      const modelos = String(q.modelos || '').split(',').map(s => s.trim()).filter(s => /^[\w.:/-]{1,60}$/.test(s)).slice(0, 20);
      const t = await pegarTarefa(nome, modelos);
      return t ? json(event, 200, t) : { statusCode: 204, headers: {}, body: '' };
    }
    if (parts[1] === 'resultado' && m === 'POST') {
      const r = await resultado(nome, b);
      return json(event, r.erro ? 409 : 200, r.erro ? { error: r.erro } : r);
    }
    return json(event, 405, { error: 'Método não permitido.' });
  }

  return { pulso, pegarTarefa, resultado, criarTarefa, lerTarefa, listar, salvarQuadro, lerQuadro, rotaDoPc, ligado: () => !!d() };
}

module.exports = { createMaquinas, tokenOk, ONLINE_MS };
