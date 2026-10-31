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


// Limpa dados livres da viagem (voos, hotel, roteiro...): só texto/número/sim-não, até 4 níveis,
// listas curtas e nunca lista dentro de lista (o Firestore não aceita).
function limpar(v, nivel = 0) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return str(v, 2000);
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'boolean') return v;
  if (nivel >= 5) return null;
  if (Array.isArray(v)) {
    return v.slice(0, 80).map(x => (Array.isArray(x) ? null : limpar(x, nivel + 1))).filter(x => x !== null);
  }
  if (typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v).slice(0, 60)) {
      if (!/^[A-Za-z0-9_]{1,40}$/.test(k)) continue;
      const y = limpar(x, nivel + 1);
      if (y !== null) o[k] = y;
    }
    return o;
  }
  return null;
}

const lista = v => (Array.isArray(v) ? limpar(v, 1) : []);
const mapa = v => (v && typeof v === 'object' && !Array.isArray(v) ? limpar(v, 1) : {});
const TOKEN_RE = /^[a-f0-9]{32}$/;
const DATA_URL_RE = /^data:(image\/(png|jpeg|webp)|application\/pdf);base64,[A-Za-z0-9+/]+={0,2}$/;

// O que o viajante vê no app (nunca manda o token de volta nem dados internos da agência).
function viagemPublica(v) {
  return {
    id: v.id, titulo: v.titulo, destino: v.destino, data_saida: v.data_saida, data_retorno: v.data_retorno,
    cliente_nome: v.cliente_nome || '', descricao: v.descricao || '',
    voos: v.voos || [], hoteis: v.hoteis || [], carros: v.carros || [], transfers: v.transfers || [],
    roteiro: v.roteiro || [], documentos: (v.documentos || []).map(d => ({ titulo: d.titulo, url: d.url || '', arquivo: d.arquivo || '' })),
    bagagem: v.bagagem || {}, avisos: v.avisos || [], emergencia: v.emergencia || {},
    passageiros: (v.passageiros || []).map(p => ({ nome: p && p.nome })),
    atualizado_em: v.atualizado_em,
  };
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


    // ── Viajante (link mágico): acha a viagem pelo token do link ──
    const viagemPeloToken = async (t) => {
      if (!TOKEN_RE.test(t)) return null;
      const link = await conta.collection('links').doc(await sha256(t)).get();
      if (link.exists) {
        const s = await conta.collection('viagens').doc(link.data().viagem_id).get();
        if (s.exists && s.data().token === t) return { id: s.id, ...s.data() };
        return null;
      }
      // viagens antigas, salvas antes do índice de links
      const snap = await conta.collection('viagens').get();
      const d = snap.docs.find(x => x.data().token === t);
      return d ? { id: d.id, ...d.data() } : null;
    };
    const tLink = str(method === 'GET' ? q.t : body.t, 64);
    const dadosAgencia = async () => {
      const dados = await lerConta();
      const site = await conta.collection('site').doc('conteudo').get();
      const sd = site.exists ? site.data() : {};
      const cfg = dados.config || (cadastro && cadastro.config) || {};
      return {
        nome: sd.nome || dados.nome || cfg.nome || (cadastro && cadastro.nome) || 'Viajante Pro',
        whatsapp: digits(sd.whatsapp || dados.whatsapp || cfg.whatsapp || ''),
        telefone_24h: digits(sd.telefone || dados.telefone_24h || cfg.whatsapp || ''),
        email: sd.email || dados.email || '',
      };
    };

    if (tLink && (acao === 'app_viagem' || (method === 'GET' && q.arquivo === undefined))) {
      const v = await viagemPeloToken(tLink);
      if (!v) return res(404, { error: 'Link de viagem inválido ou trocado pela agência. Peça o link novo.' });
      return res(200, { ok: true, viagem: viagemPublica(v), agencia: await dadosAgencia() });
    }

    if (method === 'GET' && tLink && q.arquivo !== undefined) {
      const v = await viagemPeloToken(tLink);
      const aid = str(q.arquivo, 64);
      if (!v || !ID_RE.test(aid) || !(v.documentos || []).some(d => d.arquivo === aid)) return res(404, { error: 'Documento não encontrado.' });
      const a = await conta.collection('arquivos').doc(aid).get();
      if (!a.exists) return res(404, { error: 'Documento não encontrado.' });
      return res(200, { ok: true, arquivo: { id: aid, nome: a.data().nome, dados: a.data().dados } });
    }

    // Conversa: o id do documento junta viagem + id_local do aparelho, então reenviar não duplica.
    const gravarMsg = async (viagemId, de, texto, idLocal, nomeEquipe) => {
      if (!texto) return res(400, { error: 'Escreva a mensagem.' });
      if (!ID_RE.test(idLocal)) return res(400, { error: 'Mensagem inválida.' });
      const ref = conta.collection('mensagens').doc(`${viagemId}__${idLocal}`);
      const ja = await ref.get();
      if (ja.exists) return res(200, { ok: true, repetida: true, mensagem: ja.data() });
      const m = { id: `${viagemId}__${idLocal}`, viagem_id: viagemId, de, nome_equipe: nomeEquipe || '', texto, id_local: idLocal, criado_em: new Date(now()).toISOString(), lida: false };
      await ref.set(m);
      return res(201, { ok: true, mensagem: m });
    };
    const msgsDaViagem = async (viagemId) => {
      const snap = await conta.collection('mensagens').get();
      return snap.docs.map(d => d.data()).filter(m => m.viagem_id === viagemId)
        .sort((a, b) => (a.criado_em || '').localeCompare(b.criado_em || ''));
    };

    if (tLink && (acao === 'msg_enviar' || acao === 'msg_listar')) {
      const v = await viagemPeloToken(tLink);
      if (!v) return res(404, { error: 'Link de viagem inválido.' });
      if (acao === 'msg_enviar') return gravarMsg(v.id, 'cliente', str(body.texto, 2000), str(body.id_local, 64));
      const desde = str(body.desde, 30);
      const msgs = (await msgsDaViagem(v.id)).filter(m => !desde || m.criado_em > desde);
      for (const m of msgs) if (m.de === 'equipe' && !m.lida) await conta.collection('mensagens').doc(m.id).update({ lida: true });
      return res(200, { ok: true, mensagens: msgs });
    }

    if (acao === 'site_obter') {
      const site = await conta.collection('site').doc('conteudo').get();
      return res(200, { ok: true, site: site.exists ? site.data() : {} });
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
      } else if (cadastro && ((cadastro.codigo_hash && cadastro.codigo_salt) || (cadastro.senhas_iniciais || []).length)) {
        const opcoes = [...(cadastro.senhas_iniciais || [])];
        if (cadastro.codigo_hash && cadastro.codigo_salt) opcoes.push({ salt: cadastro.codigo_salt, hash: cadastro.codigo_hash });
        let ok = false;
        for (const o of opcoes) if (iguais(await hashSenha(senha, o.salt), o.hash)) ok = true;
        if (!ok) return res(401, { error: 'Senha/código incorreto.' });
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
      const ref = conta.collection('viagens').doc(id);
      const snap = await ref.get();
      const antes = snap.exists ? snap.data() : {};
      const dadosViagem = {
        id,
        titulo,
        nome: titulo,
        destino: str(v.destino, 120),
        cliente_id: str(v.cliente_id, 64),
        cliente_nome: str(v.cliente_nome, 100),
        cliente_whatsapp: digits(v.cliente_whatsapp).slice(0, 13),
        data_saida: str(v.data_saida || v.saida, 10),
        data_retorno: str(v.data_retorno || v.retorno, 10),
        vagas: Math.max(0, Number(v.vagas || v.cap) || 0),
        valor: Math.max(0, Number(v.valor) || 0),
        status: str(v.status, 20) || 'ativo',
        descricao: str(v.descricao, 2000),
        voos: lista(v.voos),
        hoteis: lista(v.hoteis),
        carros: lista(v.carros),
        transfers: lista(v.transfers),
        roteiro: lista(v.roteiro),
        documentos: lista(v.documentos),
        avisos: lista(v.avisos),
        bagagem: mapa(v.bagagem),
        emergencia: mapa(v.emergencia),
        pendencias: mapa(v.pendencias),
        passageiros: lista(v.passageiros),
        // o link do app nunca muda sozinho ao editar; só no botão "Gerar novo link"
        token: TOKEN_RE.test(antes.token || '') ? antes.token : aleatorio(16),
        atualizado_em: agoraIso,
      };
      if (!snap.exists) dadosViagem.criado_em = agoraIso;

      await ref.set(dadosViagem, { merge: true });
      await conta.collection('links').doc(await sha256(dadosViagem.token)).set({ viagem_id: id });
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
      const sv = await conta.collection('viagens').doc(id).get();
      if (sv.exists && TOKEN_RE.test(sv.data().token || '')) await conta.collection('links').doc(await sha256(sv.data().token)).delete();
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
      const velho = snap.data().token;
      if (TOKEN_RE.test(velho || '')) await conta.collection('links').doc(await sha256(velho)).delete();
      await ref.update({ token: novoToken, atualizado_em: new Date(now()).toISOString() });
      await conta.collection('links').doc(await sha256(novoToken)).set({ viagem_id: id });
      return res(200, { ok: true, id, token: novoToken });
    }


    // Conversas (equipe)
    if (acao === 'msg_enviar') {
      const vid = str(body.viagem_id, 64);
      if (!ID_RE.test(vid)) return res(400, { error: 'Viagem inválida.' });
      return gravarMsg(vid, 'equipe', str(body.texto, 2000), str(body.id_local, 64) || aleatorio(8), str(body.nome_equipe, 60) || 'Viajante Pro');
    }
    if (acao === 'msg_listar') {
      const vid = str(body.viagem_id, 64);
      if (!ID_RE.test(vid)) return res(400, { error: 'Viagem inválida.' });
      const msgs = await msgsDaViagem(vid);
      for (const m of msgs) if (m.de === 'cliente' && !m.lida) await conta.collection('mensagens').doc(m.id).update({ lida: true });
      return res(200, { ok: true, mensagens: msgs });
    }
    if (acao === 'conversas_listar') {
      const snap = await conta.collection('mensagens').get();
      const por = {};
      for (const d of snap.docs) {
        const m = d.data();
        const c = por[m.viagem_id] || (por[m.viagem_id] = { viagem_id: m.viagem_id, nao_lidas: 0, ultima: null });
        if (m.de === 'cliente' && !m.lida) c.nao_lidas++;
        if (!c.ultima || (m.criado_em || '') > (c.ultima.criado_em || '')) c.ultima = m;
      }
      const conversas = Object.values(por).sort((a, b) => (b.nao_lidas - a.nao_lidas) || (b.ultima.criado_em || '').localeCompare(a.ultima.criado_em || ''));
      return res(200, { ok: true, conversas });
    }

    // Documentos da viagem (voucher, seguro, bilhete): foto ou PDF até 700 KB
    if (acao === 'arquivo_enviar') {
      const dados = typeof body.dados === 'string' ? body.dados : '';
      if (!DATA_URL_RE.test(dados)) return res(400, { error: 'Envie PDF, JPG, PNG ou WebP.' });
      if (dados.length > 950000) return res(400, { error: 'Arquivo grande demais (máximo 700 KB).' });
      const id = aleatorio(10);
      await conta.collection('arquivos').doc(id).set({ id, nome: str(body.nome, 120) || 'documento', dados, criado_em: new Date(now()).toISOString() });
      return res(201, { ok: true, id });
    }

    // Site público (textos, fotos e contatos)
    if (acao === 'site_salvar') {
      const e = body.conteudo && typeof body.conteudo === 'object' ? body.conteudo : {};
      const textos = {};
      for (const [k, x] of Object.entries(e.textos || {}).slice(0, 60)) if (/^[a-z0-9_]{1,40}$/.test(k)) textos[k] = str(x, 1500);
      const fotos = {};
      let total = 0;
      for (const [k, x] of Object.entries(e.fotos || {}).slice(0, 12)) {
        if (!/^[a-z0-9_]{1,40}$/.test(k) || typeof x !== 'string') continue;
        if (x.startsWith('https://')) { fotos[k] = str(x, 500); continue; }
        if (!DATA_URL_RE.test(x) || x.startsWith('data:application')) return res(400, { error: 'Foto inválida (use JPG, PNG ou WebP).' });
        total += x.length;
        fotos[k] = x;
      }
      if (total > 800000) return res(400, { error: 'Fotos grandes demais: o total precisa ficar abaixo de 600 KB.' });
      const site = { nome: str(e.nome, 80), telefone: digits(e.telefone).slice(0, 13), whatsapp: digits(e.whatsapp).slice(0, 13), email: str(e.email, 120), instagram: str(e.instagram, 60), textos, fotos, atualizado_em: new Date(now()).toISOString() };
      await conta.collection('site').doc('conteudo').set(site);
      return res(200, { ok: true, site });
    }

    if (acao === 'senha_trocar') {
      const nova = typeof body.nova === 'string' ? body.nova : '';
      if (nova.length < 6) return res(400, { error: 'A senha nova precisa ter 6 letras/números ou mais.' });
      const salt = aleatorio(16);
      await conta.set({ senha_salt: salt, senha_hash: await hashSenha(nova, salt) }, { merge: true });
      return res(200, { ok: true });
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
