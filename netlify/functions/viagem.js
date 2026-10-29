'use strict';

// NEXIA Viagem — API de gestão de agência de viagens (Viajante Pro e outros).
// Coleção Firestore: viagem_contas/<slug>
// Subcoleções: /sessoes, /clientes, /viagens, /leads

const COLLECTION = 'viagem_contas';
const SESSAO_DIAS = 30;
const PBKDF2_ITER = 100000;

const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
const digits = v => String(v || '').replace(/\D/g, '');
const SLUG_RE = /^[a-z0-9-]{3,40}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const subtle = () => globalThis.crypto.subtle;
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const aleatorio = n => hex(globalThis.crypto.getRandomValues(new Uint8Array(n)));

async function hashSenha(senha, salt) {
  const key = await subtle().importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: PBKDF2_ITER }, key, 256);
  return hex(bits);
}

async function sha256(s) {
  return hex(await subtle().digest('SHA-256', new TextEncoder().encode(s)));
}

function iguais(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

function createHandler(deps = {}) {
  const getDb = deps.getDb || (() => require('./firebase-init').db);
  const getMw = deps.getMw || (() => require('./middleware'));
  const getCadastro = deps.getCadastro || (slug => {
    try { return require('../../clientes/viagens.js').VIAGENS[slug]; } catch { return undefined; }
  });
  const now = deps.now || (() => Date.now());

  return async (event) => {
    const method = String(event.httpMethod || '').toUpperCase();
    const headers = event.headers || {};
    const cors = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    const res = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });

    if (method === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
    if (method !== 'GET' && method !== 'POST') return res(405, { error: 'Method Not Allowed' });

    let body = {};
    if (method === 'POST' && event.body) {
      try { body = JSON.parse(event.body); } catch { return res(400, { error: 'Requisição inválida.' }); }
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};
    const q = event.queryStringParameters || {};

    const slug = str(method === 'GET' ? q.site : body.site, 40).toLowerCase();
    if (!SLUG_RE.test(slug)) return res(400, { error: 'Conta de viagem inválida.' });

    const cadastro = getCadastro(slug);
    const db = getDb();
    if (!db) return res(503, { error: 'Serviço indisponível.' });

    const conta = db.collection(COLLECTION).doc(slug);
    const lerConta = async () => { const s = await conta.get(); return s.exists ? s.data() : {}; };

    const acao = str(body.acao || body.action, 40);

    // ── Público: Lead Criar ──
    if (acao === 'lead_criar') {
      const nome = str(body.nome, 100);
      const email = str(body.email, 120);
      const whatsapp = digits(body.whatsapp).slice(0, 13);
      const mensagem = str(body.mensagem, 1000);
      const destino = str(body.destino, 100);

      if (!nome || (!email && !whatsapp)) {
        return res(400, { error: 'Informe nome e ao menos um contato (e-mail ou WhatsApp).' });
      }

      const id = aleatorio(12);
      const agoraIso = new Date(now()).toISOString();
      const lead = { id, nome, email, whatsapp, mensagem, destino, criado_em: agoraIso };

      await conta.collection('leads').doc(id).set(lead);
      return res(201, { ok: true, id, lead });
    }

    // ── Público: App Obter (Configuração e dados gerais para passageiros/visitantes) ──
    if (acao === 'app_obter' || method === 'GET') {
      const dados = await lerConta();
      const cfg = {
        nome: dados.nome || (cadastro && cadastro.nome) || 'Viajante Pro',
        tagline: dados.tagline || (cadastro && cadastro.tagline) || 'Agência de Viagens',
        whatsapp: dados.whatsapp || (cadastro && cadastro.whatsapp) || '',
        email: dados.email || (cadastro && cadastro.email) || '',
        logo: dados.logo || (cadastro && cadastro.logo) || '',
        config: dados.config || (cadastro && cadastro.config) || {},
      };
      return res(200, { ok: true, app: cfg });
    }

    // ── Autenticação de Equipe (Login) ──
    const novaSessao = async () => {
      const token = aleatorio(32);
      await conta.collection('sessoes').doc(await sha256(token)).set({
        expira: now() + SESSAO_DIAS * 86400000,
        criado_em: new Date(now()).toISOString(),
      });
      return token;
    };

    if (acao === 'login') {
      const dados = await lerConta();
      const senha = typeof body.senha === 'string' ? body.senha.slice(0, 100) : '';

      const getAuth = async () => {
        const authHeader = Object.entries(headers).find(([k]) => k.toLowerCase() === 'authorization')?.[1];
        return authHeader ? await getMw().verifyBearerToken(event) : { ok: false };
      };

      const auth = await getAuth();
      if (auth.ok && auth.role === 'master') {
        return res(200, { ok: true, token: await novaSessao() });
      }

      if (dados.senha_hash && dados.senha_salt) {
        if (!iguais(await hashSenha(senha, dados.senha_salt), dados.senha_hash)) {
          return res(401, { error: 'Senha incorreta.' });
        }
      } else if (cadastro && cadastro.codigo_hash && cadastro.codigo_salt) {
        if (!iguais(await hashSenha(senha, cadastro.codigo_salt), cadastro.codigo_hash)) {
          return res(401, { error: 'Senha/código incorreto.' });
        }
      } else {
        return res(401, { error: 'Conta não configurada.' });
      }

      return res(200, { ok: true, token: await novaSessao() });
    }

    // ── Verificar Sessão / Middleware de Equipe ──
    const token = str(body.token, 100);
    let logado = false;
    let sessaoId = null;

    if (/^[a-f0-9]{64}$/.test(token)) {
      sessaoId = await sha256(token);
      const s = await conta.collection('sessoes').doc(sessaoId).get();
      logado = s.exists && Number(s.data().expira) > now();
    }

    if (!logado) {
      const authHeader = Object.entries(headers).find(([k]) => k.toLowerCase() === 'authorization')?.[1];
      if (authHeader) {
        const auth = await getMw().verifyBearerToken(event);
        logado = !!(auth.ok && auth.role === 'master');
      }
    }

    if (!logado) return res(401, { error: 'Sessão expirada. Faça login novamente.', sair: true });

    // ── Ações Privadas de Equipe ──
    if (acao === 'sair') {
      if (sessaoId) await conta.collection('sessoes').doc(sessaoId).delete();
      return res(200, { ok: true });
    }

    // Clientes CRUD
    if (acao === 'cliente_salvar') {
      const cli = body.cliente && typeof body.cliente === 'object' ? body.cliente : {};
      const id = str(cli.id, 64) || aleatorio(12);
      if (!ID_RE.test(id)) return res(400, { error: 'ID de cliente inválido.' });

      const nome = str(cli.nome, 100);
      if (!nome) return res(400, { error: 'Nome do cliente é obrigatório.' });

      const agoraIso = new Date(now()).toISOString();
      const dadosCliente = {
        id,
        nome,
        email: str(cli.email, 120),
        whatsapp: digits(cli.whatsapp).slice(0, 13),
        doc: str(cli.doc, 30),
        nasc: str(cli.nasc, 10),
        status: str(cli.status, 20) || 'ativo',
        obs: str(cli.obs, 500),
        atualizado_em: agoraIso,
      };

      const ref = conta.collection('clientes').doc(id);
      const snap = await ref.get();
      if (!snap.exists) dadosCliente.criado_em = agoraIso;

      await ref.set(dadosCliente, { merge: true });
      return res(200, { ok: true, id, cliente: dadosCliente });
    }

    if (acao === 'cliente_listar') {
      const snap = await conta.collection('clientes').get();
      const clientes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      clientes.sort((a, b) => (b.criado_em || '').localeCompare(a.criado_em || ''));
      return res(200, { ok: true, clientes });
    }

    if (acao === 'cliente_apagar') {
      const id = str(body.id, 64);
      if (!ID_RE.test(id)) return res(400, { error: 'ID de cliente inválido.' });
      await conta.collection('clientes').doc(id).delete();
      return res(200, { ok: true });
    }

    // Viagens CRUD
    if (acao === 'viagem_salvar') {
      const v = body.viagem && typeof body.viagem === 'object' ? body.viagem : {};
      const id = str(v.id, 64) || aleatorio(12);
      if (!ID_RE.test(id)) return res(400, { error: 'ID de viagem inválido.' });

      const titulo = str(v.titulo || v.nome, 120);
      if (!titulo) return res(400, { error: 'Título/nome da viagem é obrigatório.' });

      const agoraIso = new Date(now()).toISOString();
      const dadosViagem = {
        id,
        titulo,
        nome: titulo,
        destino: str(v.destino, 120),
        data_saida: str(v.data_saida || v.saida, 10),
        data_retorno: str(v.data_retorno || v.retorno, 10),
        vagas: Math.max(0, Number(v.vagas || v.cap) || 0),
        valor: Math.max(0, Number(v.valor) || 0),
        status: str(v.status, 20) || 'ativo',
        descricao: str(v.descricao, 2000),
        roteiro: Array.isArray(v.roteiro) ? v.roteiro : [],
        passageiros: Array.isArray(v.passageiros) ? v.passageiros : [],
        token: str(v.token, 64) || aleatorio(16),
        atualizado_em: agoraIso,
      };

      const ref = conta.collection('viagens').doc(id);
      const snap = await ref.get();
      if (!snap.exists) dadosViagem.criado_em = agoraIso;

      await ref.set(dadosViagem, { merge: true });
      return res(200, { ok: true, id, viagem: dadosViagem });
    }

    if (acao === 'viagem_listar') {
      const snap = await conta.collection('viagens').get();
      const viagens = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      viagens.sort((a, b) => (b.criado_em || '').localeCompare(a.criado_em || ''));
      return res(200, { ok: true, viagens });
    }

    if (acao === 'viagem_obter') {
      const id = str(body.id, 64);
      if (!ID_RE.test(id)) return res(400, { error: 'ID de viagem inválido.' });
      const snap = await conta.collection('viagens').doc(id).get();
      if (!snap.exists) return res(404, { error: 'Viagem não encontrada.' });
      return res(200, { ok: true, viagem: { id: snap.id, ...snap.data() } });
    }

    if (acao === 'viagem_apagar') {
      const id = str(body.id, 64);
      if (!ID_RE.test(id)) return res(400, { error: 'ID de viagem inválido.' });
      await conta.collection('viagens').doc(id).delete();
      return res(200, { ok: true });
    }

    if (acao === 'viagem_novo_token') {
      const id = str(body.id, 64);
      if (!ID_RE.test(id)) return res(400, { error: 'ID de viagem inválido.' });
      const ref = conta.collection('viagens').doc(id);
      const snap = await ref.get();
      if (!snap.exists) return res(404, { error: 'Viagem não encontrada.' });

      const novoToken = aleatorio(16);
      await ref.update({ token: novoToken, atualizado_em: new Date(now()).toISOString() });
      return res(200, { ok: true, id, token: novoToken });
    }

    if (acao === 'leads_listar') {
      const snap = await conta.collection('leads').get();
      const leads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      leads.sort((a, b) => (b.criado_em || '').localeCompare(a.criado_em || ''));
      return res(200, { ok: true, leads });
    }

    return res(400, { error: 'Ação desconhecida.' });
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
exports.COLLECTION = COLLECTION;
exports.hashSenha = hashSenha;
