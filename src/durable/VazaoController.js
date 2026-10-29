'use strict';
// Durable Object para Controle de Vazão, Contadores por Provedor e Fila de Espera com SQLite
// Suportado no plano Cloudflare Workers com armazenamento SQLite embutido no Durable Object.

const cotas = require('../../lib/cotas.js');

const PRIORIDADES_PLANO = {
  enterprise: 100,
  pro: 50,
  pago: 50,
  gratis: 10,
  free: 10,
  padrao: 10,
};

function calcularPrioridade(plano) {
  if (typeof plano === 'number' && Number.isFinite(plano)) return plano;
  const p = String(plano || '').toLowerCase().trim();
  return PRIORIDADES_PLANO[p] !== undefined ? PRIORIDADES_PLANO[p] : 10;
}

function hojeUtc(agora = Date.now()) {
  return new Date(agora).toISOString().slice(0, 10);
}

class VazaoController {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sql = state?.storage?.sql || state?.ctx?.storage?.sql || null;
    this.memoria = {
      respostas: new Map(),
      contadores: new Map(),
      fila: [],
    };
    this._initDb();
  }

  _initDb() {
    if (!this.sql) return;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS respostas_andamento (
        usuario_id TEXT PRIMARY KEY,
        started_at INTEGER NOT NULL,
        request_id TEXT
      );

      CREATE TABLE IF NOT EXISTS contadores_provedor (
        provedor TEXT NOT NULL,
        data TEXT NOT NULL,
        contagem INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (provedor, data)
      );

      CREATE TABLE IF NOT EXISTS contadores_banco (
        banco TEXT NOT NULL,
        data TEXT NOT NULL,
        leituras INTEGER NOT NULL DEFAULT 0,
        escritas INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (banco, data)
      );

      CREATE TABLE IF NOT EXISTS fila_espera (
        id TEXT PRIMARY KEY,
        usuario_id TEXT NOT NULL,
        plano TEXT NOT NULL,
        prioridade INTEGER NOT NULL,
        chegada INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'aguardando',
        payload TEXT
      );
    `);
  }

  // --- 1. Respostas em Andamento (1 por usuário) ---

  iniciarResposta(usuarioId, requestId = null, agora = Date.now()) {
    if (!usuarioId) throw new Error('usuarioId obrigatorio');
    const uId = String(usuarioId);
    const reqId = requestId ? String(requestId) : null;

    if (this.sql) {
      const cursor = this.sql.exec('SELECT usuario_id, started_at, request_id FROM respostas_andamento WHERE usuario_id = ?', uId);
      const rows = Array.from(cursor);
      if (rows.length > 0) {
        const row = rows[0];
        return {
          ok: false,
          motivo: 'resposta_em_andamento',
          usuario_id: uId,
          started_at: Number(row.started_at),
          request_id: row.request_id || null,
        };
      }
      this.sql.exec('INSERT INTO respostas_andamento (usuario_id, started_at, request_id) VALUES (?, ?, ?)', uId, agora, reqId);
      return { ok: true, usuario_id: uId, started_at: agora, request_id: reqId };
    }

    if (this.memoria.respostas.has(uId)) {
      const resp = this.memoria.respostas.get(uId);
      return {
        ok: false,
        motivo: 'resposta_em_andamento',
        usuario_id: uId,
        started_at: resp.started_at,
        request_id: resp.request_id,
      };
    }

    const item = { usuario_id: uId, started_at: agora, request_id: reqId };
    this.memoria.respostas.set(uId, item);
    return { ok: true, ...item };
  }

  finalizarResposta(usuarioId) {
    if (!usuarioId) throw new Error('usuarioId obrigatorio');
    const uId = String(usuarioId);

    if (this.sql) {
      this.sql.exec('DELETE FROM respostas_andamento WHERE usuario_id = ?', uId);
      return { ok: true, usuario_id: uId };
    }

    this.memoria.respostas.delete(uId);
    return { ok: true, usuario_id: uId };
  }

  obterRespostaAndamento(usuarioId) {
    if (!usuarioId) return null;
    const uId = String(usuarioId);

    if (this.sql) {
      const cursor = this.sql.exec('SELECT usuario_id, started_at, request_id FROM respostas_andamento WHERE usuario_id = ?', uId);
      const rows = Array.from(cursor);
      if (rows.length === 0) return null;
      return {
        usuario_id: rows[0].usuario_id,
        started_at: Number(rows[0].started_at),
        request_id: rows[0].request_id || null,
      };
    }

    return this.memoria.respostas.get(uId) || null;
  }

  // --- 2. Contadores por Provedor e Integração com Cotas ---

  incrementarProvedor(provedor, quantidade = 1, data = null) {
    if (!provedor) throw new Error('provedor obrigatorio');
    const prov = String(provedor).toLowerCase();
    const d = data ? String(data) : hojeUtc();
    const qtd = Math.max(1, Number(quantidade) || 1);

    if (this.sql) {
      this.sql.exec(
        `INSERT INTO contadores_provedor (provedor, data, contagem)
         VALUES (?, ?, ?)
         ON CONFLICT(provedor, data) DO UPDATE SET contagem = contagem + ?`,
        prov, d, qtd, qtd
      );
      const cursor = this.sql.exec('SELECT contagem FROM contadores_provedor WHERE provedor = ? AND data = ?', prov, d);
      const rows = Array.from(cursor);
      const total = rows.length > 0 ? Number(rows[0].contagem) : qtd;
      return { ok: true, provedor: prov, data: d, contagem: total };
    }

    const chave = `${prov}:${d}`;
    const atual = (this.memoria.contadores.get(chave) || 0) + qtd;
    this.memoria.contadores.set(chave, atual);
    return { ok: true, provedor: prov, data: d, contagem: atual };
  }

  obterContadores(data = null) {
    const d = data ? String(data) : hojeUtc();

    if (this.sql) {
      const cursor = this.sql.exec('SELECT provedor, contagem FROM contadores_provedor WHERE data = ?', d);
      const rows = Array.from(cursor);
      const res = {};
      for (const r of rows) {
        res[r.provedor] = Number(r.contagem);
      }
      return res;
    }

    const res = {};
    for (const [chave, val] of this.memoria.contadores.entries()) {
      const [prov, dataChave] = chave.split(':');
      if (dataChave === d) res[prov] = val;
    }
    return res;
  }

  verificarCota(provedor, limite = null, data = null) {
    const prov = String(provedor).toLowerCase();
    const contadores = this.obterContadores(data);
    const usado = contadores[prov] || 0;
    const lim = limite || (cotas.LIMITES && cotas.LIMITES[prov] ? cotas.LIMITES[prov].limite : 10000);
    const perto = usado >= lim * cotas.LIMIAR;
    const excedido = usado >= lim;
    return { provedor: prov, usado, limite: lim, perto, excedido, frear: perto };
  }

  // --- 3. Fila de Espera Ordenada por Plano e Chegada ---

  enfileirar({ id, usuario_id, plano = 'gratis', prioridade = null, payload = null }, agora = Date.now()) {
    if (!usuario_id) throw new Error('usuario_id obrigatorio');
    const uId = String(usuario_id);
    const itemPk = id ? String(id) : `fila_${agora}_${Math.random().toString(36).slice(2, 8)}`;
    const prio = prioridade !== null && prioridade !== undefined ? Number(prioridade) : calcularPrioridade(plano);
    const pld = payload ? (typeof payload === 'string' ? payload : JSON.stringify(payload)) : null;

    if (this.sql) {
      this.sql.exec(
        `INSERT INTO fila_espera (id, usuario_id, plano, prioridade, chegada, status, payload)
         VALUES (?, ?, ?, ?, ?, 'aguardando', ?)`,
        itemPk, uId, String(plano), prio, agora, pld
      );
      const posCursor = this.sql.exec(
        `SELECT COUNT(*) as pos FROM fila_espera WHERE status = 'aguardando' AND (prioridade > ? OR (prioridade = ? AND chegada <= ?))`,
        prio, prio, agora
      );
      const posRows = Array.from(posCursor);
      const posicao = posRows.length > 0 ? Number(posRows[0].pos) : 1;
      return { ok: true, id: itemPk, usuario_id: uId, plano: String(plano), prioridade: prio, chegada: agora, posicao };
    }

    const item = {
      id: itemPk,
      usuario_id: uId,
      plano: String(plano),
      prioridade: prio,
      chegada: agora,
      status: 'aguardando',
      payload: pld,
    };
    this.memoria.fila.push(item);
    this.memoria.fila.sort((a, b) => b.prioridade - a.prioridade || a.chegada - b.chegada);
    const posicao = this.memoria.fila.filter(x => x.status === 'aguardando').findIndex(x => x.id === itemPk) + 1;
    return { ok: true, id: itemPk, usuario_id: uId, plano: String(plano), prioridade: prio, chegada: agora, posicao };
  }

  proximoDaFila() {
    if (this.sql) {
      const cursor = this.sql.exec(
        `SELECT id, usuario_id, plano, prioridade, chegada, payload FROM fila_espera
         WHERE status = 'aguardando'
         ORDER BY prioridade DESC, chegada ASC LIMIT 1`
      );
      const rows = Array.from(cursor);
      if (rows.length === 0) return null;
      const top = rows[0];
      this.sql.exec(`UPDATE fila_espera SET status = 'processando' WHERE id = ?`, top.id);
      let parsedPayload = top.payload;
      try { if (top.payload) parsedPayload = JSON.parse(top.payload); } catch {}
      return {
        id: top.id,
        usuario_id: top.usuario_id,
        plano: top.plano,
        prioridade: Number(top.prioridade),
        chegada: Number(top.chegada),
        payload: parsedPayload,
      };
    }

    const idx = this.memoria.fila.findIndex(x => x.status === 'aguardando');
    if (idx === -1) return null;
    const top = this.memoria.fila[idx];
    top.status = 'processando';
    let parsedPayload = top.payload;
    try { if (top.payload) parsedPayload = JSON.parse(top.payload); } catch {}
    return {
      id: top.id,
      usuario_id: top.usuario_id,
      plano: top.plano,
      prioridade: top.prioridade,
      chegada: top.chegada,
      payload: parsedPayload,
    };
  }

  finalizarFila(id) {
    if (!id) throw new Error('id obrigatorio');
    const itemPk = String(id);

    if (this.sql) {
      this.sql.exec(`DELETE FROM fila_espera WHERE id = ?`, itemPk);
      return { ok: true, id: itemPk };
    }

    this.memoria.fila = this.memoria.fila.filter(x => x.id !== itemPk);
    return { ok: true, id: itemPk };
  }

  obterFila(status = 'aguardando') {
    if (this.sql) {
      const cursor = this.sql.exec(
        `SELECT id, usuario_id, plano, prioridade, chegada, status, payload FROM fila_espera
         WHERE status = ? ORDER BY prioridade DESC, chegada ASC`,
        status
      );
      const rows = Array.from(cursor);
      return rows.map(r => ({
        id: r.id,
        usuario_id: r.usuario_id,
        plano: r.plano,
        prioridade: Number(r.prioridade),
        chegada: Number(r.chegada),
        status: r.status,
      }));
    }

    return this.memoria.fila
      .filter(x => x.status === status)
      .map(r => ({
        id: r.id,
        usuario_id: r.usuario_id,
        plano: r.plano,
        prioridade: r.prioridade,
        chegada: r.chegada,
        status: r.status,
      }));
  }

  tamanhoFila(status = 'aguardando') {
    if (this.sql) {
      const cursor = this.sql.exec(`SELECT COUNT(*) as total FROM fila_espera WHERE status = ?`, status);
      const rows = Array.from(cursor);
      return rows.length > 0 ? Number(rows[0].total) : 0;
    }
    return this.memoria.fila.filter(x => x.status === status).length;
  }

  // --- 4. Handler HTTP (Fetch DO) ---

  async fetch(request) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      let body = {};
      if (method === 'POST' || method === 'PUT') {
        body = await request.json().catch(() => ({}));
      }

      if (path === '/iniciar' && method === 'POST') {
        const res = this.iniciarResposta(body.usuario_id, body.request_id);
        return new Response(JSON.stringify(res), { status: res.ok ? 200 : 409, headers: { 'Content-Type': 'application/json' } });
      }

      if (path === '/finalizar' && method === 'POST') {
        const res = this.finalizarResposta(body.usuario_id);
        return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (path === '/andamento' && method === 'GET') {
        const uId = url.searchParams.get('usuario_id');
        const res = this.obterRespostaAndamento(uId);
        return new Response(JSON.stringify({ andamento: res }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (path === '/provedor/incrementar' && method === 'POST') {
        const res = this.incrementarProvedor(body.provedor, body.quantidade, body.data);
        return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (path === '/provedor/contadores' && method === 'GET') {
        const d = url.searchParams.get('data');
        const res = this.obterContadores(d);
        return new Response(JSON.stringify({ contadores: res }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (path === '/fila/enfileirar' && method === 'POST') {
        const res = this.enfileirar(body);
        return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (path === '/fila/proximo' && method === 'POST') {
        const item = this.proximoDaFila();
        return new Response(JSON.stringify({ item }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (path === '/fila/finalizar' && method === 'POST') {
        const res = this.finalizarFila(body.id);
        return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (path === '/fila' && method === 'GET') {
        const st = url.searchParams.get('status') || 'aguardando';
        const lista = this.obterFila(st);
        return new Response(JSON.stringify({ fila: lista, total: lista.length }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (path === '/status' && method === 'GET') {
        return new Response(JSON.stringify({
          status: 'ok',
          durable: 'VazaoController',
          contadores: this.obterContadores(),
          tamanho_fila: this.tamanhoFila(),
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ error: 'Nao encontrado' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }
}

module.exports = { VazaoController, PRIORIDADES_PLANO, calcularPrioridade };
