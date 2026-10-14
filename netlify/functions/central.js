'use strict';
// Central NEXIA (/central): uma página para o dono cuidar de toda a NEXIA. Só o master entra.
//   GET  /api/central?parte=saude|dinheiro|cortex|robos|divulga|banco|lista
//   POST /api/central {acao:'rodar', arquivo, ensaio?} | {acao:'pedir', texto}
// Cada parte é um pedido separado: a página mostra o que já chegou sem esperar o resto.

const { PRODUTOS, LINKS, ROBOS } = require('../../central/produtos');

async function medir(url, fetchFn, ms = 6000) {
  const t0 = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetchFn(url, { method: 'GET', redirect: 'follow', signal: ctl.signal, headers: { 'User-Agent': 'nexia-central' } });
    const tempo = Date.now() - t0;
    return { ok: r.status < 500, codigo: r.status, tempo, lento: tempo > 3000 };
  } catch (e) { return { ok: false, codigo: 0, tempo: Date.now() - t0, lento: false }; }
  finally { clearTimeout(timer); }
}

function createHandler(deps = {}) {
  const getMw = deps.getMw || (() => require('./middleware'));
  const getDb = deps.getDb || (() => require('./firebase-init').db);
  const getGithub = deps.getGithub || (() => require('./central/github').criarGithub());
  const getResumo = deps.getResumo || (() => require('./body-coach/acesso').resumoDono);
  const fetchFn = deps.fetch || ((...a) => fetch(...a));

  return async (event) => {
    const method = String(event.httpMethod || '').toUpperCase();
    const cors = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
    const res = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });
    if (method === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
    if (method !== 'GET' && method !== 'POST') return res(405, { error: 'Method Not Allowed' });

    const auth = await getMw().verifyBearerToken(event).catch(() => ({ ok: false }));
    if (!auth.ok || auth.role !== 'master') return res(403, { error: 'Só o administrador da NEXIA abre a Central.' });

    try {
      if (method === 'POST') {
        let body = {};
        try { body = JSON.parse(event.body || '{}') || {}; } catch { return res(400, { error: 'Pedido inválido.' }); }
        const gh = getGithub();
        if (body.acao === 'rodar') {
          const robo = ROBOS.find((r) => r.arquivo === body.arquivo && r.inputs);
          if (!robo) return res(400, { error: 'Esse robô não pode ser ligado por aqui.' });
          const inputs = body.ensaio && robo.arquivo === 'divulga.yml' ? { acao: 'ensaio' } : robo.inputs;
          await gh.rodar(robo.arquivo, inputs);
          return res(200, { ok: true, mensagem: robo.nome + ': mandei rodar. Em 1 ou 2 minutos aparece aqui.' });
        }
        if (body.acao === 'pedir') {
          const texto = String(body.texto || '').trim().slice(0, 3000);
          if (texto.length < 10) return res(400, { error: 'Escreva com um pouco mais de detalhe o que você quer.' });
          const titulo = texto.split('\n')[0].slice(0, 80);
          const r = await gh.pedirAoCortex(titulo, texto, auth.email || 'admin');
          return res(200, { ok: true, ...r, mensagem: 'Pedido entregue ao Cortex (tarefa #' + r.numero + ').' });
        }
        return res(400, { error: 'Ação desconhecida.' });
      }

      const parte = String((event.queryStringParameters || {}).parte || 'lista');
      if (parte === 'lista') return res(200, { produtos: PRODUTOS, links: LINKS });
      if (parte === 'saude') {
        const medidos = await Promise.all(PRODUTOS.map(async (p) => ({ id: p.id, ...(await medir(p.site, fetchFn)) })));
        return res(200, { produtos: medidos, em: new Date().toISOString() });
      }
      if (parte === 'dinheiro') {
        const db = getDb();
        const resumo = await getResumo()(db, db.collection('bc_acesso'));
        const pedidos = await db.collection('bc_acesso_pedidos').orderBy('em', 'desc').limit(20).get();
        const semana = Date.now() - 7 * 864e5;
        const avisos7 = pedidos.docs.map((d) => d.data()).filter((p) => Number(p.em) > semana).length;
        return res(200, { ...resumo, avisos7 });
      }
      if (parte === 'banco') {
        const t0 = Date.now();
        try { await getDb().collection('bc_uso').limit(1).get(); return res(200, { ok: true, tempo: Date.now() - t0 }); }
        catch (e) { return res(200, { ok: false, cheio: /RESOURCE_EXHAUSTED|quota/i.test(String(e.message)), tempo: Date.now() - t0 }); }
      }
      const gh = getGithub();
      if (parte === 'cortex') return res(200, await gh.cortex());
      if (parte === 'robos') return res(200, { robos: await gh.robos(ROBOS) });
      if (parte === 'divulga') return res(200, await gh.divulga());
      return res(400, { error: 'Parte desconhecida.' });
    } catch (e) {
      return res(502, { error: 'Não consegui buscar agora: ' + String(e.message || e).slice(0, 160) });
    }
  };
}

exports.createHandler = createHandler;
exports.medir = medir;
exports.handler = createHandler();
