'use strict';
// Kernex Finance Admin (/api/prumo-admin). Só o master entra; o resto recebe 403.
// Mostra SÓ contagens (pessoas, planos, leituras do mês, mensagens). Nunca valores, documentos ou extratos.
// Mensagens de suporte: o master lê e responde as mensagens que a própria pessoa mandou na aba Ajuda.
const { PLANOS } = require('./prumo-lib/ajuda');

function createHandler(deps = {}) {
  const getDb = deps.getDb || (() => require('./firebase-init').db);
  const getMw = deps.getMw || (() => require('./middleware'));
  const now = deps.now || (() => Date.now());
  const listar = async (col) => { const s = await col.get(); return s.docs.map((d) => ({ id: d.id, ...d.data() })); };
  const novoId = () => now().toString(36) + Math.random().toString(36).slice(2, 8);

  return async (event) => {
    const method = String(event.httpMethod || '').toUpperCase();
    const headers = event.headers || {};
    const cors = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
    const res = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });
    if (method === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
    if (method !== 'GET' && method !== 'POST') return res(405, { error: 'Method Not Allowed' });
    const auth = (headers.authorization || headers.Authorization) ? await getMw().verifyBearerToken(event).catch(() => ({ ok: false })) : { ok: false };
    if (!auth.ok) return res(401, { error: 'Entre com sua conta.' });
    if (auth.role !== 'master') return res(403, { error: 'Só o administrador da KERNEX entra aqui.' });
    let body = {};
    if (method === 'POST' && event.body) { try { body = JSON.parse(event.body); } catch { return res(400, { error: 'Pedido inválido.' }); } }
    if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};
    const q = event.queryStringParameters || {};
    const db = getDb();
    if (!db) return res(503, { error: 'Banco fora do ar agora.' });
    const users = db.collection('prumo_users');
    const agoraIso = new Date(now()).toISOString();
    const mes = agoraIso.slice(0, 7);
    const uidValido = (u) => typeof u === 'string' && /^[A-Za-z0-9_-]{6,128}$/.test(u);

    try {
      if (method === 'GET') {
        const parte = q.parte || 'resumo';
        if (parte === 'resumo') {
          const lista = await listar(users);
          const pessoas = [];
          for (const u of lista) {
            const [uso, msgs] = await Promise.all([users.doc(u.id).collection('config').doc('uso').get(), listar(users.doc(u.id).collection('mensagens'))]);
            const leituras = uso && uso.exists && uso.data() && uso.data().mes === mes ? Number(uso.data().leituras) || 0 : 0;
            pessoas.push({ uid: u.id, plano: u.plano || 'gratis', desde: u.criado_em || null, leituras_mes: leituras, mensagens_abertas: msgs.filter((m) => m.de === 'usuario' && m.status === 'aberta').length });
          }
          const porPlano = {};
          for (const p of pessoas) porPlano[p.plano] = (porPlano[p.plano] || 0) + 1;
          return res(200, { em: agoraIso, mes, total_pessoas: pessoas.length, por_plano: porPlano, leituras_mes: pessoas.reduce((s, p) => s + p.leituras_mes, 0),
            mensagens_abertas: pessoas.reduce((s, p) => s + p.mensagens_abertas, 0), pessoas, planos: Object.keys(PLANOS) });
        }
        if (parte === 'mensagens') {
          if (!uidValido(q.uid)) return res(400, { error: 'Pessoa inválida.' });
          const msgs = await listar(users.doc(q.uid).collection('mensagens'));
          return res(200, { uid: q.uid, mensagens: msgs.sort((a, b) => String(a.em).localeCompare(String(b.em))) });
        }
        return res(400, { error: 'Parte desconhecida.' });
      }
      const acao = String(body.acao || '');
      if (!uidValido(body.uid)) return res(400, { error: 'Pessoa inválida.' });
      const base = users.doc(body.uid);
      if (acao === 'plano_definir') {
        if (!Object.prototype.hasOwnProperty.call(PLANOS, body.plano)) return res(400, { error: 'Plano inválido.' });
        const atual = await base.get();
        await base.set({ ...((atual && atual.exists && atual.data()) || {}), plano: body.plano, plano_por: auth.uid, plano_em: agoraIso });
        await base.collection('auditoria').doc(novoId()).set({ evento: 'master_mudou_plano', plano: body.plano, por: auth.uid, em: agoraIso });
        return res(200, { ok: true, uid: body.uid, plano: body.plano });
      }
      if (acao === 'mensagem_responder') {
        const t = String(body.texto || '').trim().slice(0, 1500);
        if (!t) return res(400, { error: 'Escreva a resposta.' });
        const col = base.collection('mensagens');
        for (const m of await listar(col)) if (m.de === 'usuario' && m.status === 'aberta') await col.doc(m.id).set({ ...m, status: 'respondida' });
        await col.doc(novoId()).set({ de: 'admin', texto: t, em: agoraIso, status: 'resposta' });
        return res(200, { ok: true });
      }
      return res(400, { error: 'Ação desconhecida.' });
    } catch (e) {
      console.error('[prumo-admin]', e && e.message);
      return res(500, { error: 'Erro no painel. Tente de novo.' });
    }
  };
}
exports.handler = createHandler();
exports.createHandler = createHandler;
