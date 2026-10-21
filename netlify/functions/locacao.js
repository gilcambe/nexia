'use strict';

// NEXIA Locação — API de reservas por dia para locais de eventos (Splash e outros).
// Grátis: Cloudflare Workers + Firestore.
//
// Público (o site do cliente chama):
//   GET  /api/locacao?site=<slug>                                → nome, unidades, aviso, chave Pix, regras de sinal
//   GET  /api/locacao?site=<slug>&unidade=<id>&mes=AAAA-MM       → mapa de dias do mês ("livre" | "ocupado")
//   POST /api/locacao  { acao:'pedir', site, unidade, data, nome, whatsapp, email?, tipo_evento, convidados, obs, consentimento }
//
// Painel da dona (página /agenda do site dela). Tudo POST com { acao, site, token, ... }:
//   primeiro-acesso { codigo, senha_nova } · entrar { senha } · sair · trocar-senha { senha_atual, senha_nova }
//   listar { de, ate, unidade?, status? } · criar { unidade, data, status, nome, whatsapp, ... }
//   status { id, status } · editar { id, campos } · bloquear { unidade, data, motivo } · desbloquear { id }
//   config { config } · site-salvar { conteudo } · foto-enviar { dados, tipo }
//
// Firestore: locacao_contas/<slug> { senha_hash, senha_salt, versao, config }
//            locacao_contas/<slug>/reservas/<id>
//            locacao_contas/<slug>/dias/<unidade>_<AAAA-MM-DD>  trava por dia em cada unidade
//            locacao_contas/<slug>/sessoes/<hash do token>
//            locacao_contas/<slug>/site/conteudo
//            locacao_contas/<slug>/fotos/<id>

const COLLECTION = 'locacao_contas';
const STATUS_VALIDOS = ['pedido', 'aguardando_sinal', 'confirmado', 'concluido', 'recusado', 'cancelado', 'expirado', 'bloqueado'];
const ATIVOS = ['pedido', 'aguardando_sinal', 'confirmado', 'concluido', 'bloqueado'];
const TZ_OFFSET_MIN = -180; // Brasília (sem horário de verão)
const SESSAO_DIAS = 30;
const SUPORTE_HORAS = 8;
const PBKDF2_ITER = 100000;
const LIMITES = { pedir: { max: 6, windowMs: 60_000 }, entrar: { max: 8, windowMs: 10 * 60_000 } };

const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
const digits = v => String(v || '').replace(/\D/g, '');
const SLUG_RE = /^[a-z0-9-]{3,40}$/;
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const MES_RE = /^\d{4}-\d{2}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const dataValida = d => DATA_RE.test(d) && !Number.isNaN(Date.parse(d + 'T00:00:00Z')) && new Date(d + 'T00:00:00Z').toISOString().slice(0, 10) === d;
const somaDias = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);

/** "Agora" no horário de Brasília: { data: 'AAAA-MM-DD', iso: '...' }. */
function agoraBr(now = Date.now()) {
  const t = new Date(now + TZ_OFFSET_MIN * 60000);
  return { data: t.toISOString().slice(0, 10), iso: new Date(now).toISOString() };
}

// ── WebCrypto: Hash e Criptografia ──────────────────────────────────────────

const subtle = () => globalThis.crypto.subtle;
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const aleatorio = n => hex(globalThis.crypto.getRandomValues(new Uint8Array(n)));

async function hashSenha(senha, salt) {
  const key = await subtle().importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: PBKDF2_ITER }, key, 256);
  return hex(bits);
}
async function sha256(s) { return hex(await subtle().digest('SHA-256', new TextEncoder().encode(s))); }
function iguais(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}
function senhaFraca(s) {
  if (typeof s !== 'string' || s.length < 6) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (s.length > 100) return 'Senha longa demais.';
  if (/^(\d)\1+$/.test(s) || ['123456', '1234567', '12345678', '654321', 'senha123', 'abcdef'].includes(s.toLowerCase())) return 'Essa senha é fácil de adivinhar. Escolha outra.';
  return '';
}

// ── Configuração ───────────────────────────────────────────────────────────

function limparUnidades(lista) {
  const out = [];
  const ids = new Set();
  for (const u of Array.isArray(lista) ? lista.slice(0, 20) : []) {
    const nome = str(u && u.nome, 80);
    if (!nome) continue;
    let id = str(u.id, 40).toLowerCase().replace(/[^a-z0-9-]/g, '') || nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'unidade';
    while (ids.has(id)) id += '-2';
    ids.add(id);
    out.push({ id, nome });
  }
  return out.length ? out : [
    { id: 'santa-adelia', nome: 'Splash Santa Adélia' },
    { id: 'santa-barbara', nome: 'Splash Santa Bárbara' },
  ];
}

function montarConfig(cadastro = {}, salvo = {}) {
  const c = { ...(cadastro.config || {}), ...(salvo || {}) };
  return {
    nome: str(c.nome, 80) || str(cadastro.nome, 80) || 'Locação de Eventos',
    whatsapp: digits(c.whatsapp).slice(0, 13),
    unidades: limparUnidades(c.unidades),
    sinal: {
      tipo: c.sinal && c.sinal.tipo === 'valor' ? 'valor' : 'percentual',
      valor: Math.max(0, Number(c.sinal && c.sinal.valor) || 50),
    },
    pix: {
      chave: str(c.pix && c.pix.chave, 100),
      titular: str(c.pix && c.pix.titular, 100),
    },
    prazo_horas: Math.min(Math.max(Math.round(Number(c.prazo_horas) || 48), 1), 168),
    antecedencia_dias: Math.min(Math.max(Math.round(Number(c.antecedencia_dias) || 0), 0), 365),
    dias_a_frente: Math.min(Math.max(Math.round(Number(c.dias_a_frente) || 540), 1), 730),
    aviso: str(c.aviso, 300),
    mensagem_pedido: str(c.mensagem_pedido, 300) || 'Pedido de reserva recebido com sucesso! Aguarde o contato para confirmação.',
  };
}

const configPublica = cfg => ({
  nome: cfg.nome,
  whatsapp: cfg.whatsapp,
  unidades: cfg.unidades,
  sinal: cfg.sinal,
  pix: cfg.pix,
  prazo_horas: cfg.prazo_horas,
  antecedencia_dias: cfg.antecedencia_dias,
  dias_a_frente: cfg.dias_a_frente,
  aviso: cfg.aviso,
  mensagem_pedido: cfg.mensagem_pedido,
});

// ── Validação e Limite por IP ──────────────────────────────────────────────

const _hits = new Map();
function ipPermitido(tipo, ip, now = Date.now()) {
  if (!ip) return true;
  const lim = LIMITES[tipo];
  if (!lim) return true;
  const k = tipo + ':' + ip;
  const e = _hits.get(k);
  if (!e || now - e.start > lim.windowMs) {
    if (_hits.size > 5000) _hits.clear();
    _hits.set(k, { start: now, n: 1 });
    return true;
  }
  e.n += 1;
  return e.n <= lim.max;
}

function limparPessoa(body) {
  const nome = str(body.nome, 80);
  const whatsapp = digits(body.whatsapp).slice(0, 13);
  const email = str(body.email, 120);
  const tipo_evento = str(body.tipo_evento, 60);
  const convidados = Math.min(Math.max(Math.round(Number(body.convidados) || 0), 0), 10000);
  const obs = str(body.obs, 500);

  if (nome.length < 2) return { error: 'Informe seu nome completo.' };
  if (!whatsapp || whatsapp.length < 10 || whatsapp.length > 13) return { error: 'Informe o WhatsApp com DDD (ex: 11999998888).' };

  return {
    pessoa: { nome, whatsapp, email, tipo_evento, convidados, obs },
  };
}

// ── Editor e Fotos ─────────────────────────────────────────────────────────

const { lerFoto, limparConteudo, guardarFotoEmMemoria, FOTO_ID_RE, _fotos } = require('./agenda');

function painelDe(slug, cadastro = {}) {
  const p = typeof cadastro.painel === 'string' && /^https:\/\/[a-z0-9.-]+\//.test(cadastro.painel) ? cadastro.painel : `https://${slug}.pages.dev/agenda/`;
  return p;
}

function createHandler(deps = {}) {
  const getDb = deps.getDb || (() => require('./firebase-init').db);
  const getMw = deps.getMw || (() => require('./middleware'));
  const getCadastro = deps.getCadastro || (slug => {
    try { return require('../../clientes/locacoes.js').LOCACOES[slug]; } catch { return undefined; }
  });
  const getLista = deps.getLista || (() => {
    try { return require('../../clientes/locacoes.js').LOCACOES; } catch { return {}; }
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
      try { body = JSON.parse(event.body); } catch { return res(400, { error: 'Pedido inválido.' }); }
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};
    const q = event.queryStringParameters || {};

    const getAuth = async () => {
      const authHeader = Object.entries(headers).find(([k]) => k.toLowerCase() === 'authorization')?.[1];
      return authHeader ? await getMw().verifyBearerToken(event) : { ok: false };
    };

    // Suporte NEXIA: lista de todas as contas de locação (só master)
    if (method === 'GET' && q.suporte === 'lista') {
      const auth = await getAuth();
      if (!auth.ok || auth.role !== 'master') return res(403, { error: 'Só o administrador da NEXIA vê esta lista.' });
      const lista = Object.entries(getLista())
        .map(([s, c]) => ({ site: s, nome: c.nome || s, painel: painelDe(s, c) }));
      return res(200, { locacoes: lista });
    }

    const slug = str(method === 'GET' ? q.site : body.site, 40).toLowerCase();
    if (!SLUG_RE.test(slug)) return res(400, { error: 'Conta de locação inválida.' });
    const cadastro = getCadastro(slug);
    if (!cadastro) return res(404, { error: 'Esta conta de locação não existe.' });
    const db = getDb();
    if (!db) return res(503, { error: 'Serviço indisponível. Tente de novo em instantes.' });
    const ip = headers['cf-connecting-ip'] || String(headers['x-forwarded-for'] || '').split(',')[0].trim();

    const conta = db.collection(COLLECTION).doc(slug);
    const reservas = conta.collection('reservas');
    const diasLock = conta.collection('dias');

    const lerConta = async () => { const s = await conta.get(); return s.exists ? s.data() : {}; };

    /** Verifica prazos vencidos e expira reservas em 'pedido' ou 'aguardando_sinal'. */
    async function verificarExpirados() {
      const agoraIso = new Date(now()).toISOString();
      const pendentesSnap = await reservas.where('status', 'in', ['pedido', 'aguardando_sinal']).get();
      for (const doc of pendentesSnap.docs) {
        const item = doc.data();
        if (item.prazo_ate && item.prazo_ate <= agoraIso) {
          const id = doc.id;
          const audit = Array.isArray(item.auditoria) ? item.auditoria : [];
          audit.push({ quando: agoraIso, quem: 'sistema', de: item.status, para: 'expirado' });
          await reservas.doc(id).update({
            status: 'expirado',
            auditoria: audit,
            atualizado_em: agoraIso,
          });
          const keyLock = `${item.unidade}_${item.data}`;
          await diasLock.doc(keyLock).delete();
        }
      }
    }

    // ── Público: Fotos e Conteúdo do Site ──
    if (method === 'GET' && q.foto !== undefined) {
      const id = str(q.foto, 40);
      if (!FOTO_ID_RE.test(id)) return res(400, { error: 'Foto inválida.' });
      const k = slug + '/' + id;
      let f = _fotos.get(k);
      if (!f) {
        const snap = await conta.collection('fotos').doc(id).get();
        if (!snap.exists) return res(404, { error: 'Foto não encontrada.' });
        f = { tipo: snap.data().tipo, base64: snap.data().dados };
        guardarFotoEmMemoria(k, f);
      }
      return { statusCode: 200, isBase64Encoded: true, body: f.base64, headers: { ...cors, 'Content-Type': f.tipo, 'Cache-Control': 'public, max-age=31536000, immutable' } };
    }
    if (method === 'GET' && q.conteudo !== undefined) {
      const snap = await conta.collection('site').doc('conteudo').get();
      return res(200, { conteudo: snap.exists ? limparConteudo(snap.data()) : null });
    }

    // ── Público: Mapa do Mês por Unidade ou Configuração Geral ──
    if (method === 'GET') {
      await verificarExpirados();
      const cfg = montarConfig(cadastro, (await lerConta()).config);
      const unidadeId = str(q.unidade, 40);
      const mes = str(q.mes, 7);

      if (unidadeId && mes) {
        if (!MES_RE.test(mes)) return res(400, { error: 'Mês inválido. Use AAAA-MM.' });
        const unidade = cfg.unidades.find(u => u.id === unidadeId);
        if (!unidade) return res(400, { error: 'Unidade não encontrada.' });

        const [anoStr, mesStr] = mes.split('-');
        const ano = Number(anoStr);
        const mesNum = Number(mesStr);
        const totalDias = new Date(ano, mesNum, 0).getDate();

        const inicioMes = `${mes}-01`;
        const fimMes = `${mes}-${String(totalDias).padStart(2, '0')}`;

        const hoje = agoraBr(now()).data;
        const minData = somaDias(hoje, cfg.antecedencia_dias);
        const maxData = somaDias(hoje, cfg.dias_a_frente);

        // Busca todas as travas registradas na coleção 'dias' para essa unidade no mês
        const travasSnap = await diasLock
          .where('unidade', '==', unidadeId)
          .where('data', '>=', inicioMes)
          .where('data', '<=', fimMes)
          .get();

        const diasOcupadosSet = new Set(travasSnap.docs.map(d => d.data().data));

        const mapaDias = {};
        for (let i = 1; i <= totalDias; i++) {
          const diaStr = `${mes}-${String(i).padStart(2, '0')}`;
          if (diaStr < minData || diaStr > maxData || diasOcupadosSet.has(diaStr)) {
            mapaDias[diaStr] = 'ocupado';
          } else {
            mapaDias[diaStr] = 'livre';
          }
        }

        return res(200, { unidade: unidadeId, mes, dias: mapaDias });
      }

      return res(200, configPublica(cfg));
    }

    const acao = str(body.acao, 30);

    // ── Público: Fazer Pedido de Reserva ──
    if (acao === 'pedir') {
      if (str(body.campo_extra, 20) || str(body.site_url, 20)) return res(200, { ok: true }); // honeypot
      if (!ipPermitido('pedir', ip, now())) return res(429, { error: 'Muitos pedidos seguidos. Tente de novo em 1 minuto.' });
      if (body.consentimento !== true) return res(400, { error: 'É preciso aceitar o contato para prosseguir (LGPD).' });

      const { pessoa, error: errPessoa } = limparPessoa(body);
      if (errPessoa) return res(400, { error: errPessoa });

      await verificarExpirados();
      const cfg = montarConfig(cadastro, (await lerConta()).config);

      const unidadeId = str(body.unidade, 40);
      const unidade = cfg.unidades.find(u => u.id === unidadeId);
      if (!unidade) return res(400, { error: 'Escolha uma unidade válida.' });

      const data = str(body.data, 10);
      if (!dataValida(data)) return res(400, { error: 'Data de reserva inválida.' });

      const hoje = agoraBr(now()).data;
      const minData = somaDias(hoje, cfg.antecedencia_dias);
      const maxData = somaDias(hoje, cfg.dias_a_frente);

      if (data < minData) return res(400, { error: `Reservas exigem antecedência mínima de ${cfg.antecedencia_dias} dia(s).` });
      if (data > maxData) return res(400, { error: 'Data além do limite permitido para agendamentos futuros.' });

      const keyLock = `${unidadeId}_${data}`;
      const refLock = diasLock.doc(keyLock);

      const refReserva = reservas.doc();
      const protocolo = 'SPL-' + aleatorio(3).toUpperCase();
      const agoraIso = new Date(now()).toISOString();
      const prazoIso = new Date(now() + cfg.prazo_horas * 3600000).toISOString();

      const novaReserva = {
        id: refReserva.id,
        protocolo,
        unidade: unidadeId,
        unidade_nome: unidade.nome,
        data,
        status: 'pedido',
        ...pessoa,
        consentimento: true,
        prazo_ate: prazoIso,
        criado_em: agoraIso,
        atualizado_em: agoraIso,
        auditoria: [{ quando: agoraIso, quem: 'cliente', de: null, para: 'pedido' }],
      };

      const lote = db.batch();
      lote.set(refReserva, novaReserva);
      lote.create(refLock, { reserva_id: refReserva.id, unidade: unidadeId, data, criado_em: agoraIso });

      try {
        await lote.commit();
      } catch (e) {
        if (e && (e.code === 6 || /ALREADY_EXISTS/.test(String(e.message)))) {
          return res(409, { error: 'Este dia já está reservado para esta unidade. Escolha outra data.' });
        }
        throw e;
      }

      return res(201, {
        ok: true,
        protocolo,
        prazo_ate: prazoIso,
        mensagem: cfg.mensagem_pedido,
      });
    }

    // ── Painel: Autenticação (Entrar / Primeiro Acesso) ──
    const novaSessao = async () => {
      const token = aleatorio(32);
      await conta.collection('sessoes').doc(await sha256(token)).set({
        expira: now() + SESSAO_DIAS * 86400000,
        criado_em: new Date(now()).toISOString(),
      });
      return token;
    };

    if (acao === 'primeiro-acesso' || acao === 'entrar') {
      if (!ipPermitido('entrar', ip, now())) return res(429, { error: 'Muitas tentativas. Espere 10 minutos e tente de novo.' });
      const dados = await lerConta();
      const versao = Number(cadastro.versao) || 1;

      if (acao === 'primeiro-acesso') {
        if (!cadastro.codigo_hash || !cadastro.codigo_salt) {
          return res(400, { error: 'Esta conta ainda não foi ativada pelo administrador.', sem_ativacao: true });
        }
        const codigo = str(body.codigo, 40).toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!iguais(await hashSenha(codigo, cadastro.codigo_salt), cadastro.codigo_hash)) {
          return res(401, { error: 'Código de acesso incorreto.' });
        }
        const fraca = senhaFraca(body.senha_nova);
        if (fraca) return res(400, { error: fraca });
        const salt = aleatorio(16);
        await conta.set({
          senha_hash: await hashSenha(body.senha_nova, salt),
          senha_salt: salt,
          versao,
          senha_em: new Date(now()).toISOString(),
        }, { merge: true });
        return res(200, { ok: true, token: await novaSessao() });
      }

      if (!dados.senha_hash) {
        if (!cadastro.codigo_hash) {
          return res(400, { error: 'Esta conta ainda não foi ativada pelo administrador.', sem_ativacao: true });
        }
        return res(400, { error: 'Primeiro acesso: informe o código de ativação para criar sua senha.', primeiro_acesso: true });
      }

      if (typeof body.senha !== 'string' || !iguais(await hashSenha(body.senha.slice(0, 100), dados.senha_salt), dados.senha_hash)) {
        return res(401, { error: 'Senha incorreta.' });
      }
      return res(200, { ok: true, token: await novaSessao() });
    }

    // ── Suporte NEXIA: Acesso Master sem senha ──
    if (acao === 'suporte') {
      const auth = await getAuth();
      if (!auth.ok || auth.role !== 'master') return res(403, { error: 'Só o administrador da NEXIA entra como suporte.' });
      const token = aleatorio(32);
      const quando = new Date(now()).toISOString();
      const por = str(auth.email || auth.uid || 'master', 120);
      await conta.collection('sessoes').doc(await sha256(token)).set({ expira: now() + SUPORTE_HORAS * 3600000, criado_em: quando, suporte: true, por });
      await conta.collection('suporte').add({ por, em: quando });
      return res(200, { ok: true, token, painel: painelDe(slug, cadastro), horas: SUPORTE_HORAS });
    }

    // ── Autenticação do Painel para Ações Privadas ──
    let sessaoId = null;
    let logado = false;
    const token = str(body.token, 100);
    if (/^[a-f0-9]{64}$/.test(token)) {
      sessaoId = await sha256(token);
      const s = await conta.collection('sessoes').doc(sessaoId).get();
      logado = s.exists && Number(s.data().expira) > now();
    }
    if (!logado) {
      const auth = await getAuth();
      logado = !!(auth.ok && auth.role === 'master');
      sessaoId = null;
    }
    if (!logado) return res(401, { error: 'Sessão expirada. Faça login novamente.', sair: true });

    await verificarExpirados();
    const dados = await lerConta();
    const cfg = montarConfig(cadastro, dados.config);

    if (acao === 'sair') {
      if (sessaoId) await conta.collection('sessoes').doc(sessaoId).delete();
      return res(200, { ok: true });
    }

    if (acao === 'trocar-senha') {
      if (!dados.senha_hash || typeof body.senha_atual !== 'string' || !iguais(await hashSenha(body.senha_atual.slice(0, 100), dados.senha_salt), dados.senha_hash)) {
        return res(401, { error: 'Senha atual incorreta.' });
      }
      const fraca = senhaFraca(body.senha_nova);
      if (fraca) return res(400, { error: fraca });
      const salt = aleatorio(16);
      await conta.set({ senha_hash: await hashSenha(body.senha_nova, salt), senha_salt: salt, senha_em: new Date(now()).toISOString() }, { merge: true });
      return res(200, { ok: true });
    }

    if (acao === 'listar') {
      const hoje = agoraBr(now()).data;
      const de = dataValida(str(body.de, 10)) ? body.de : hoje;
      let ate = dataValida(str(body.ate, 10)) ? body.ate : somaDias(de, 60);
      if (ate < de) ate = de;
      if (ate > somaDias(de, 365)) ate = somaDias(de, 365);

      let query = reservas.where('data', '>=', de).where('data', '<=', ate);
      const unidadeFiltro = str(body.unidade, 40);
      if (unidadeFiltro) query = query.where('unidade', '==', unidadeFiltro);

      const snap = await query.get();
      let lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const statusFiltro = str(body.status, 30);
      if (statusFiltro && STATUS_VALIDOS.includes(statusFiltro)) {
        lista = lista.filter(i => i.status === statusFiltro);
      }
      lista.sort((a, b) => a.data.localeCompare(b.data));

      const pendSnap = await reservas.where('status', 'in', ['pedido', 'aguardando_sinal']).get();
      const pendentes = pendSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.data.localeCompare(b.data));

      return res(200, { de, ate, hoje, itens: lista, pendentes, config: cfg });
    }

    if (acao === 'criar') {
      const { pessoa, error: errPessoa } = limparPessoa(body);
      if (errPessoa) return res(400, { error: errPessoa });

      const unidadeId = str(body.unidade, 40);
      const unidade = cfg.unidades.find(u => u.id === unidadeId);
      if (!unidade) return res(400, { error: 'Escolha uma unidade válida.' });

      const data = str(body.data, 10);
      if (!dataValida(data)) return res(400, { error: 'Data de reserva inválida.' });

      const status = str(body.status, 30) || 'confirmado';
      if (!STATUS_VALIDOS.includes(status)) return res(400, { error: 'Status de reserva inválido.' });

      const keyLock = `${unidadeId}_${data}`;
      const refLock = diasLock.doc(keyLock);

      const lockDoc = await refLock.get();
      if (lockDoc.exists) {
        return res(409, { error: 'Este dia já está reservado ou bloqueado nesta unidade.' });
      }

      const refReserva = reservas.doc();
      const protocolo = 'SPL-' + aleatorio(3).toUpperCase();
      const agoraIso = new Date(now()).toISOString();

      const novaReserva = {
        id: refReserva.id,
        protocolo,
        unidade: unidadeId,
        unidade_nome: unidade.nome,
        data,
        status,
        ...pessoa,
        prazo_ate: status === 'pedido' || status === 'aguardando_sinal' ? new Date(now() + cfg.prazo_horas * 3600000).toISOString() : null,
        criado_em: agoraIso,
        atualizado_em: agoraIso,
        auditoria: [{ quando: agoraIso, quem: 'painel', de: null, para: status }],
      };

      const lote = db.batch();
      lote.set(refReserva, novaReserva);
      if (ATIVOS.includes(status)) {
        lote.create(refLock, { reserva_id: refReserva.id, unidade: unidadeId, data, criado_em: agoraIso });
      }

      try {
        await lote.commit();
      } catch (e) {
        if (e && (e.code === 6 || /ALREADY_EXISTS/.test(String(e.message)))) {
          return res(409, { error: 'Este dia já está reservado ou bloqueado nesta unidade.' });
        }
        throw e;
      }

      return res(201, { ok: true, id: refReserva.id, protocolo });
    }

    if (acao === 'status') {
      const id = str(body.id, 64);
      if (!ID_RE.test(id)) return res(400, { error: 'ID de reserva inválido.' });
      const novoStatus = str(body.status, 30);
      if (!STATUS_VALIDOS.includes(novoStatus)) return res(400, { error: 'Status inválido.' });

      const refReserva = reservas.doc(id);
      const snap = await refReserva.get();
      if (!snap.exists) return res(404, { error: 'Reserva não encontrada.' });

      const atual = snap.data();
      const statusAnt = atual.status;

      if (statusAnt === novoStatus) return res(200, { ok: true });

      const keyLock = `${atual.unidade}_${atual.data}`;
      const refLock = diasLock.doc(keyLock);

      const liberandoLock = ATIVOS.includes(statusAnt) && !ATIVOS.includes(novoStatus);
      const ativandoLock = !ATIVOS.includes(statusAnt) && ATIVOS.includes(novoStatus);

      if (ativandoLock) {
        const lockSnap = await refLock.get();
        if (lockSnap.exists && lockSnap.data().reserva_id !== id) {
          return res(409, { error: 'Este dia foi ocupado por outra reserva nesta unidade.' });
        }
      }

      const agoraIso = new Date(now()).toISOString();
      const audit = Array.isArray(atual.auditoria) ? [...atual.auditoria] : [];
      audit.push({ quando: agoraIso, quem: 'painel', de: statusAnt, para: novoStatus });

      let prazo_ate = atual.prazo_ate || null;
      if (novoStatus === 'aguardando_sinal') {
        prazo_ate = new Date(now() + cfg.prazo_horas * 3600000).toISOString();
      } else if (novoStatus === 'confirmado' || novoStatus === 'concluido' || novoStatus === 'recusado' || novoStatus === 'cancelado') {
        prazo_ate = null;
      }

      const updateData = {
        status: novoStatus,
        prazo_ate,
        auditoria: audit,
        atualizado_em: agoraIso,
      };

      await refReserva.update(updateData);

      if (liberandoLock) {
        await refLock.delete();
      } else if (ativandoLock) {
        await refLock.set({ reserva_id: id, unidade: atual.unidade, data: atual.data, criado_em: agoraIso });
      }

      return res(200, { ok: true });
    }

    if (acao === 'editar') {
      const id = str(body.id, 64);
      if (!ID_RE.test(id)) return res(400, { error: 'Reserva inválida.' });
      const campos = body.campos && typeof body.campos === 'object' ? body.campos : {};

      const refReserva = reservas.doc(id);
      const snap = await refReserva.get();
      if (!snap.exists) return res(404, { error: 'Reserva não encontrada.' });

      const permitidos = ['nome', 'whatsapp', 'email', 'tipo_evento', 'convidados', 'obs', 'valor_total', 'valor_sinal'];
      const updateData = { atualizado_em: new Date(now()).toISOString() };

      for (const k of permitidos) {
        if (campos[k] !== undefined) {
          if (k === 'convidados' || k === 'valor_total' || k === 'valor_sinal') {
            updateData[k] = Math.max(0, Number(campos[k]) || 0);
          } else {
            updateData[k] = str(campos[k], k === 'obs' ? 500 : 120);
          }
        }
      }

      await refReserva.update(updateData);
      return res(200, { ok: true });
    }

    if (acao === 'bloquear') {
      const unidadeId = str(body.unidade, 40);
      const unidade = cfg.unidades.find(u => u.id === unidadeId);
      if (!unidade) return res(400, { error: 'Escolha uma unidade válida.' });

      const de = str(body.de || body.data, 10);
      const ate = str(body.ate || body.data, 10);
      if (!dataValida(de) || !dataValida(ate) || ate < de) return res(400, { error: 'Período de bloqueio inválido.' });

      const motivo = str(body.motivo, 120) || 'Bloqueio administrativo';
      const agoraIso = new Date(now()).toISOString();

      const datasBloqueadas = [];
      let d = de;
      while (d <= ate) {
        datasBloqueadas.push(d);
        d = somaDias(d, 1);
      }

      const criados = [];
      for (const diaStr of datasBloqueadas) {
        const keyLock = `${unidadeId}_${diaStr}`;
        const refLock = diasLock.doc(keyLock);

        const refReserva = reservas.doc();
        const itemBloqueio = {
          id: refReserva.id,
          protocolo: 'BLK-' + aleatorio(3).toUpperCase(),
          unidade: unidadeId,
          unidade_nome: unidade.nome,
          data: diaStr,
          status: 'bloqueado',
          nome: motivo,
          whatsapp: '',
          obs: motivo,
          criado_em: agoraIso,
          atualizado_em: agoraIso,
          auditoria: [{ quando: agoraIso, quem: 'painel', de: null, para: 'bloqueado' }],
        };

        const lote = db.batch();
        lote.set(refReserva, itemBloqueio);
        lote.create(refLock, { reserva_id: refReserva.id, unidade: unidadeId, data: diaStr, criado_em: agoraIso });

        try {
          await lote.commit();
          criados.push(refReserva.id);
        } catch {
          // Se falhou trava, pula dia já travado
        }
      }

      return res(201, { ok: true, bloqueios: criados.length });
    }

    if (acao === 'desbloquear') {
      const id = str(body.id, 64);
      if (!ID_RE.test(id)) return res(400, { error: 'ID inválido.' });

      const refReserva = reservas.doc(id);
      const snap = await refReserva.get();
      if (!snap.exists) return res(404, { error: 'Bloqueio ou reserva não encontrada.' });

      const item = snap.data();
      const keyLock = `${item.unidade}_${item.data}`;

      await refReserva.delete();
      await diasLock.doc(keyLock).delete();

      return res(200, { ok: true });
    }

    if (acao === 'config') {
      const novo = body.config && typeof body.config === 'object' ? body.config : {};
      const salvar = {};
      const permitidos = ['nome', 'whatsapp', 'unidades', 'sinal', 'pix', 'prazo_horas', 'antecedencia_dias', 'dias_a_frente', 'aviso', 'mensagem_pedido'];
      for (const k of permitidos) if (novo[k] !== undefined) salvar[k] = novo[k];

      const final = montarConfig(cadastro, { ...(dados.config || {}), ...salvar });
      await conta.set({ config: final }, { merge: true });
      return res(200, { ok: true, config: final });
    }

    if (acao === 'site-salvar') {
      const conteudo = limparConteudo(body.conteudo);
      await conta.collection('site').doc('conteudo').set({ ...conteudo, atualizado_em: new Date(now()).toISOString() });
      return res(200, { ok: true, conteudo });
    }

    if (acao === 'foto-enviar') {
      const { base64, bytes, error: errFoto } = lerFoto(body.dados, str(body.tipo, 20));
      if (errFoto) return res(400, { error: errFoto });
      const id = aleatorio(12);
      await conta.collection('fotos').doc(id).set({ tipo: str(body.tipo, 20), dados: base64, bytes, criado_em: new Date(now()).toISOString() });
      return res(201, { ok: true, id });
    }

    return res(400, { error: 'Ação desconhecida.' });
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
exports.montarConfig = montarConfig;
exports.hashSenha = hashSenha;
exports.agoraBr = agoraBr;
exports.COLLECTION = COLLECTION;
