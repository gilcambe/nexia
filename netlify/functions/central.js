'use strict';
// Central NEXIA (/central): uma página para o dono cuidar de toda a NEXIA. Só o master entra.

async function lidarBancoCofre(req, env) {
  try {
    // Consultar uso dos bancos do Vault e CofreSql
    const uso = {
      firestoreB: global.getUsoBanco ? global.getUsoBanco('firestore-b') : { leituras: 0, escritas: 0, status: 'ativo' },
      firestoreC: global.getUsoBanco ? global.getUsoBanco('firestore-c') : { leituras: 0, escritas: 0, status: 'ativo' },
      d1: global.getUsoD1 ? global.getUsoD1('d1-default') : { leituras: 0, escritas: 0, status: 'ativo' },
      cofresql: { leituras: 0, escritas: 0, status: 'ativo' }
    };
    
    // Tentar buscar do CofreSql se disponível
    if (env && env.COFRE_SQL) {
      try {
        const stub = env.COFRE_SQL.get(env.COFRE_SQL.idFromName('cofre'));
        const res = await stub.fetch('https://cofre/vazao-get');
        if (res.ok) {
          const data = await res.json();
          if (data && data.uso) {
            Object.assign(uso, data.uso);
          }
        }
      } catch (e) {
        console.error('Erro ao buscar uso do CofreSql:', e);
      }
    }
    
    return { success: true, uso, timestamp: new Date().toISOString() };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Central NEXIA (/central): uma página para o dono cuidar de toda a NEXIA. Só o master entra.
//   GET  /api/central?parte=busca&q=…|saude|historico|erros|cotas|dinheiro|cortex|robos|divulga|banco|cloudflare|lista|empresa|clientes|leads
//   POST /api/central {acao:'rodar', arquivo, ensaio?} | {acao:'pedir', texto} | {acao:'testar-ias'} | {acao:'vaga-salvar'|'vaga-apagar'|'vaga-testar'}
// Cada parte é um pedido separado: a página mostra o que já chegou sem esperar o resto.

const { PRODUTOS, NO_AR, LINKS, ROBOS, BASE } = require('../../central/produtos');
const { FORNECEDORES } = require('../../central/fornecedores');
const empresa = require('./central/empresa');
const vagas = require('./central/ia-vagas');

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

// Pedidos do site hoje (o plano grátis do Cloudflare Workers dá 100 mil por dia). Só lê; precisa de um token com "Analytics: Read".
async function usoCloudflare(env, fetchFn) {
  const token = env.CLOUDFLARE_ANALYTICS_TOKEN || '';
  const conta = env.NEXIA_D1_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID || '';
  if (!token || !conta) return { configurado: false, limite: 100000 };
  const hoje = new Date().toISOString().slice(0, 10);
  const query = 'query($a:String!,$d:Date!){viewer{accounts(filter:{accountTag:$a}){workersInvocationsAdaptive(limit:1000,filter:{date_geq:$d,date_leq:$d}){sum{requests}}}}}';
  const r = await fetchFn('https://api.cloudflare.com/client/v4/graphql', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables: { a: conta, d: hoje } }) });
  const j = await r.json().catch(() => ({}));
  const linhas = (((j.data || {}).viewer || {}).accounts || [])[0];
  if (!r.ok || !linhas) return { configurado: true, erro: 'O Cloudflare não respondeu agora.', limite: 100000 };
  const pedidos = (linhas.workersInvocationsAdaptive || []).reduce((t, x) => t + (Number((x.sum || {}).requests) || 0), 0);
  return { configurado: true, pedidos, limite: 100000 };
}

function createHandler(deps = {}) {
  const getMw = deps.getMw || (() => require('./middleware'));
  const getDb = deps.getDb || (() => require('./firebase-init').db);
  const getGithub = deps.getGithub || (() => require('./central/github').criarGithub());
  const getResumo = deps.getResumo || (() => require('./body-coach/acesso').resumoDono);
  const getRouter = deps.getRouter || (() => require('../../nexia-ai/model-router').getRouter());
  const getIAs = deps.getIAs || (() => require('../../nexia-ai/orchestrator/models').FREE.fast);
  const getAgendas = deps.getAgendas || (() => require('../../clientes/agendas').AGENDAS);
  const getHistorico = deps.getHistorico || (() => require('./central/saude-historico'));
  const env = deps.env || process.env;
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
        if (body.acao === 'testar-ias') return res(200, { ias: await empresa.testarIAs(getRouter(), getIAs()), em: new Date().toISOString() });
        const gh = getGithub();
        // #1958: Conectar IAs. A chave nunca volta na resposta nem vai para log.
        if (body.acao === 'vaga-salvar' || body.acao === 'vaga-apagar') {
          const r = body.acao === 'vaga-salvar' ? await vagas.salvar(gh.api, body, { rodarRobo: () => gh.rodar('ia-vagas.yml', {}), nomeToken: gh.nomeToken, ...(deps.vagasDeps || {}) }) : await vagas.apagar(gh.api, body);
          return res(r.status, r.corpo);
        }
        if (body.acao === 'vaga-testar') {
          await gh.rodar('ia-vagas.yml', {});
          return res(200, { ok: true, mensagem: 'Mandei o robô testar as 3 vagas com as chaves guardadas. Em 1 ou 2 minutos o resultado aparece aqui.' });
        }
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
        if (body.acao === 'confirmar_pix' || body.acao === 'recusar_pix') {
          const pedidoId = String(body.id || body.pedidoId || '').trim();
          if (!pedidoId) return res(400, { error: 'ID do pedido é obrigatório.' });
          const db = getDb();
          const docRef = db.collection('bc_acesso_pedidos').doc(pedidoId);
          const docSnap = await docRef.get();
          if (!docSnap.exists) return res(404, { error: 'Pedido Pix não encontrado.' });
          const p = docSnap.data() || {};
          if (body.acao === 'confirmar_pix') {
            const { liberarAcesso } = require('./body-coach/acesso');
            const dias = Number(p.dias) || (p.plano === 'anual' ? 365 : 30);
            const valor = Number(p.valor) || 0;
            const uid = p.uid || pedidoId;
            await liberarAcesso(db, uid, dias, Date.now(), { valor });
            await docRef.set({ status: 'confirmado', confirmadoEm: Date.now(), confirmadoPor: auth.email || 'admin' }, { merge: true });
            return res(200, { ok: true, mensagem: 'Pix confirmado com sucesso e plano ativado.' });
          } else {
            await docRef.set({ status: 'recusado', recusadoEm: Date.now(), recusadoPor: auth.email || 'admin' }, { merge: true });
            return res(200, { ok: true, mensagem: 'Pix recusado com sucesso.' });
          }
        }
        return res(400, { error: 'Ação desconhecida.' });
      }

      const parte = String((event.queryStringParameters || {}).parte || 'lista');
      if (parte === 'lista') return res(200, { produtos: PRODUTOS, links: LINKS });
      if (parte === 'saude') {
        // O Worker não consegue abrir o próprio endereço dentro de um pedido (o Cloudflare barra o laço) e dava
        // "fora do ar" falso para Cortex, CES, Viajante Pro e Splash. Esses usam a medição de hora em hora do cron.
        const proprio = (u) => { try { return new URL(u).host === new URL(BASE).host; } catch { return false; } };
        let hora = null;
        if (NO_AR.some((p) => proprio(p.site))) {
          try { const h = getHistorico(); hora = await h.ultimaAmostra(deps.getHistoricoDb ? deps.getHistoricoDb() : h.abrirBanco(env)); } catch { hora = null; }
        }
        const medidos = await Promise.all(NO_AR.map(async (p) => {
          const m = proprio(p.site) && hora && hora.rotas[p.id];
          if (m) return { id: p.id, ok: !!m.ok, codigo: m.codigo || 0, tempo: m.tempo || 0, lento: (m.tempo || 0) > 3000, quando: hora.em || null };
          return { id: p.id, ...(await medir(p.site, fetchFn)) };
        }));
        return res(200, { produtos: medidos, em: new Date().toISOString() });
      }
      if (parte === 'historico') {
        const h = getHistorico();
        const db = deps.getHistoricoDb ? deps.getHistoricoDb() : h.abrirBanco(env);
        if (!db) return res(200, { dias: h.DIAS, amostras: 0, desde: null, rotas: [], porDia: [] });
        return res(200, await h.resumo(db));
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
        const db = getDb();
        const uso = typeof db._getContadorGeral === 'function' ? db._getContadorGeral() : { reads: 0, writes: 0 };
        let bancosUso = typeof db._getBancosUso === 'function' ? db._getBancosUso() : null;
        if (!bancosUso || !bancosUso.length) {
          try {
            const fsLite = require('../../lib/firebase-lite/firestore');
            if (fsLite && typeof fsLite.getBancosUsoGeral === 'function') {
              bancosUso = fsLite.getBancosUsoGeral();
            }
          } catch {}
        }
        if (!bancosUso || !bancosUso.length) {
          bancosUso = [
            { banco: 'Firestore (B)', status: 'ativo', reads: uso.reads, writes: uso.writes, limiteReads: 50000, limiteWrites: 20000 },
            { banco: 'Firestore (C)', status: 'reserva', reads: 0, writes: 0, limiteReads: 50000, limiteWrites: 20000 },
            { banco: 'D1 (D1)', status: 'reserva', reads: 0, writes: 0, limiteReads: 5000000, limiteWrites: 100000 },
            { banco: 'CofreSql', status: 'reserva', reads: 0, writes: 0, limiteReads: 10000000, limiteWrites: 500000 }
          ];
        }
        const t0 = Date.now();
        try { await getDb().collection('bc_uso').limit(1).get(); return res(200, { ok: true, bancos: bancosUso, tempo: Date.now() - t0 }); }
        catch (e) { return res(200, { ok: false, bancos: bancosUso, cheio: /RESOURCE_EXHAUSTED|quota/i.test(String(e.message)), tempo: Date.now() - t0 }); }
      }
      if (parte === 'cloudflare') return res(200, await usoCloudflare(env, fetchFn));
      if (parte === 'busca') return res(200, await require('../../lib/busca-web').buscar((event.queryStringParameters || {}).q, { fetchImpl: fetchFn }));
      if (parte === 'cotas') {
        const cotasBase = await require('../../lib/cotas').medir(env, { fetchImpl: fetchFn, getToken: deps.getCotasToken }).catch(() => ({}));
        let bancosUso = [];
        try {
          const { getBancosUsoGeral } = require('../../lib/firebase-lite/firestore.js');
          bancosUso = getBancosUsoGeral();
        } catch {}
        return res(200, { ...cotasBase, bancosUso });
      }
              if (parte === 'sentinel') return res(200, await bancoSentinel(env));
      if (parte === 'banco-cofre') return res(200, await lidarBancoCofre(event, env));
      if (parte === 'sentinel') return res(200, await bancoSentinel(env));
      if (parte === 'clientes') return res(200, await empresa.clientes(getDb(), getAgendas()));
      if (parte === 'leads') return res(200, await empresa.leads(getDb()));
      if (parte === 'erros') {
        // #815: últimos erros 5xx do Worker, com o rid (o mesmo do cabeçalho X-Request-Id e do log).
        const db = deps.getHistoricoDb ? deps.getHistoricoDb() : getHistorico().abrirBanco(env);
        return res(200, { erros: await require('../../lib/rid').listarErros(db, 50) });
      }
      const gh = getGithub();
      if (parte === 'empresa') {
        const usados = ROBOS.filter((r) => FORNECEDORES.some((f) => f.robo === r.arquivo));
        const robos = await gh.robos(usados).catch(() => []);
        return res(200, { fornecedores: empresa.fornecedores(FORNECEDORES, env, robos) });
      }
      if (parte === 'cortex') return res(200, await gh.cortex());
      if (parte === 'pacote-ia') return res(200, await gh.pacoteIA());
      if (parte === 'maquinas') {
        // #1846: PCs do dono (agente local manda o pulso a cada minuto). Só leitura.
        const m = deps.getMaquinas ? deps.getMaquinas() : require('../../nexia-ai/maquinas').createMaquinas({ env });
        return res(200, { ligado: m.ligado(), maquinas: m.ligado() ? await m.listar() : [] });
      }
      if (parte === 'vagas') return res(200, await vagas.estado(gh.api, env));
      if (parte === 'reservas') return res(200, await gh.reservas());   // #802: contas de reserva (só nomes de segredos)
      if (parte === 'robos') return res(200, { robos: await gh.robos(ROBOS) });
      if (parte === 'divulga') return res(200, await gh.divulga());
      if (parte === 'estado-divulga') return res(200, await gh.estadoDivulga());
      return res(400, { error: 'Parte desconhecida.' });
    } catch (e) {
      return res(502, { error: 'Não consegui buscar agora: ' + String(e.message || e).slice(0, 160) });
    }
  };
}

exports.createHandler = createHandler;
exports.medir = medir;
exports.handler = createHandler();
