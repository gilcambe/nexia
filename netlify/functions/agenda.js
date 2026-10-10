'use strict';

// NEXIA Agenda — agenda online para sites de clientes (estúdio, clínica, salão). Grátis: Worker + Firestore.
//
// Público (o site do cliente chama, de qualquer domínio):
//   GET  /api/agenda?site=<slug>                         → nome, serviços e próximos dias com horário
//   GET  /api/agenda?site=<slug>&data=AAAA-MM-DD&servico=<id> → horários livres do dia
//   POST /api/agenda  { acao:'agendar', site, servico, data, inicio, nome, whatsapp, obs, consentimento }
//
// Painel da dona (página /agenda do site dela). Tudo POST com { acao, site, token, ... }:
//   primeiro-acesso { codigo, senha_nova } · entrar { senha } · sair · trocar-senha { senha_atual, senha_nova }
//   listar { de, ate } · criar { data, inicio, servico, nome, whatsapp, obs } · status { id, status }
//   bloquear { data, inicio?, fim?, motivo } · desbloquear { id } · config { config }
//   O master da NEXIA (login Firebase, Authorization: Bearer) também entra em qualquer agenda, para suporte.
//
// O corpo vai como text/plain com JSON (sem "preflight"), igual ao /api/leads.
// Cadastro de uma agenda nova: clientes/agendas.js (código do primeiro acesso guardado só como hash).
//
// Firestore: agenda_contas/<slug> { senha_hash, senha_salt, versao, config }
//            agenda_contas/<slug>/itens/<id>    agendamentos e bloqueios
//            agenda_contas/<slug>/ocupado/<data>_<HHMM>  trava de cada fatia de horário (impede dois no mesmo horário)
//            agenda_contas/<slug>/sessoes/<hash do token>

const COLLECTION = 'agenda_contas';
const STATUS = ['pendente', 'confirmado', 'cancelado', 'concluido', 'faltou'];
const ATIVOS = ['pendente', 'confirmado', 'concluido'];
const TZ_OFFSET_MIN = -180; // Brasília (sem horário de verão desde 2019)
const SESSAO_DIAS = 30;
const PBKDF2_ITER = 100000; // limite do Cloudflare Workers
const LIMITES = { agendar: { max: 6, windowMs: 60_000 }, entrar: { max: 8, windowMs: 10 * 60_000 } };

const SEMANA_PADRAO = { 0: [], 1: [['09:00', '18:00']], 2: [['09:00', '18:00']], 3: [['09:00', '18:00']], 4: [['09:00', '18:00']], 5: [['09:00', '18:00']], 6: [['09:00', '13:00']] };

const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
const digits = v => String(v || '').replace(/\D/g, '');
const SLUG_RE = /^[a-z0-9-]{3,40}$/;
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const min = h => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const dataValida = d => DATA_RE.test(d) && !Number.isNaN(Date.parse(d + 'T00:00:00Z')) && new Date(d + 'T00:00:00Z').toISOString().slice(0, 10) === d;
const diaSemana = d => new Date(d + 'T12:00:00Z').getUTCDay();
const somaDias = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);

/** "Agora" no horário de Brasília: { data: 'AAAA-MM-DD', minuto: 0..1439 }. */
function agoraBr(now = Date.now()) {
  const t = new Date(now + TZ_OFFSET_MIN * 60000);
  return { data: t.toISOString().slice(0, 10), minuto: t.getUTCHours() * 60 + t.getUTCMinutes() };
}

// ── Configuração ───────────────────────────────────────────────────────────

function limparServicos(lista) {
  const out = [];
  const ids = new Set();
  for (const s of Array.isArray(lista) ? lista.slice(0, 30) : []) {
    const nome = str(s && s.nome, 80);
    if (!nome) continue;
    let id = str(s.id, 40).toLowerCase().replace(/[^a-z0-9-]/g, '') || nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'servico';
    while (ids.has(id)) id += '-2';
    ids.add(id);
    const duracao = Math.min(Math.max(Math.round(Number(s.duracao) || 60), 10), 480);
    out.push({ id, nome, duracao, preco: str(s.preco, 40) });
  }
  return out;
}

function limparSemana(semana) {
  const out = {};
  for (let d = 0; d <= 6; d++) {
    const faixas = semana && Array.isArray(semana[d]) ? semana[d] : [];
    out[d] = faixas.slice(0, 4)
      .filter(f => Array.isArray(f) && HORA_RE.test(f[0]) && HORA_RE.test(f[1]) && min(f[0]) < min(f[1]))
      .map(f => [f[0], f[1]])
      .sort((a, b) => min(a[0]) - min(b[0]));
  }
  return out;
}

/** Junta o cadastro (clientes/agendas.js) com o que a dona mudou no painel. */
function montarConfig(cadastro = {}, salvo = {}) {
  const c = { ...(cadastro.config || {}), ...(salvo || {}) };
  const servicos = limparServicos(c.servicos);
  return {
    nome: str(c.nome, 80) || str(cadastro.nome, 80) || 'Agenda',
    whatsapp: digits(c.whatsapp).slice(0, 13),
    endereco: str(c.endereco, 160),
    servicos: servicos.length ? servicos : [{ id: 'atendimento', nome: 'Atendimento', duracao: 60, preco: '' }],
    semana: limparSemana(c.semana || SEMANA_PADRAO),
    intervalo: [10, 15, 20, 30, 45, 60].includes(Number(c.intervalo)) ? Number(c.intervalo) : 30,
    antecedencia_horas: Math.min(Math.max(Math.round(Number(c.antecedencia_horas ?? 2)), 0), 72),
    dias_a_frente: Math.min(Math.max(Math.round(Number(c.dias_a_frente) || 60), 1), 180),
    aviso: str(c.aviso, 300),
  };
}

const configPublica = cfg => ({ nome: cfg.nome, whatsapp: cfg.whatsapp, endereco: cfg.endereco, aviso: cfg.aviso, servicos: cfg.servicos, intervalo: cfg.intervalo, dias_a_frente: cfg.dias_a_frente });

// ── Horários livres ────────────────────────────────────────────────────────

const sobrepoe = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;
const ocupaHorario = it => it.tipo === 'bloqueio' || (it.tipo === 'agendamento' && ATIVOS.includes(it.status));

/** Horários de início livres para um serviço numa data, dado o que já existe no dia. */
function horariosLivres(cfg, data, duracao, itensDoDia, now = Date.now()) {
  const hoje = agoraBr(now);
  if (data < hoje.data || data > somaDias(hoje.data, cfg.dias_a_frente)) return [];
  const minimo = data === hoje.data ? hoje.minuto + cfg.antecedencia_horas * 60 : (data === somaDias(hoje.data, 1) ? hoje.minuto + cfg.antecedencia_horas * 60 - 1440 : -1);
  const ocupados = itensDoDia.filter(ocupaHorario).map(it => [min(it.inicio), min(it.fim)]);
  const livres = [];
  for (const [ini, fim] of cfg.semana[diaSemana(data)] || []) {
    for (let t = min(ini); t + duracao <= min(fim); t += cfg.intervalo) {
      if (t < minimo) continue;
      if (ocupados.some(([a, b]) => sobrepoe(t, t + duracao, a, b))) continue;
      livres.push(hhmm(t));
    }
  }
  return livres;
}

/** Fatias de horário (de "intervalo" em "intervalo") que um atendimento ocupa: viram travas no banco. */
function fatias(inicio, fim, passo) {
  const out = [];
  const ini = Math.floor(min(inicio) / passo) * passo;
  for (let t = ini; t < min(fim); t += passo) out.push(hhmm(t).replace(':', ''));
  return out;
}

// ── Senha e sessão (WebCrypto: funciona no Worker e no Node) ────────────────

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

// ── Limite de tentativas por IP (memória, sem gastar cota) ─────────────────

const _hits = new Map();
function ipPermitido(tipo, ip, now = Date.now()) {
  if (!ip) return true;
  const lim = LIMITES[tipo];
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

// ── Validação de agendamento ───────────────────────────────────────────────

function limparPessoa(body, { exigirContato }) {
  const nome = str(body.nome, 80);
  const whatsapp = digits(body.whatsapp).slice(0, 13);
  if (nome.length < 2) return { error: 'Informe o nome.' };
  if (exigirContato && !whatsapp) return { error: 'Informe o WhatsApp com DDD.' };
  if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 13)) return { error: 'WhatsApp inválido: use DDD + número.' };
  return { pessoa: { nome, whatsapp, obs: str(body.obs, 500) } };
}

function createHandler(deps = {}) {
  const getDb = deps.getDb || (() => require('./firebase-init').db);
  const getMw = deps.getMw || (() => require('./middleware'));
  const getCadastro = deps.getCadastro || (slug => require('../../clientes/agendas.js').AGENDAS[slug]);
  const now = deps.now || (() => Date.now());

  return async (event) => {
    const method = String(event.httpMethod || '').toUpperCase();
    const headers = event.headers || {};
    const cors = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };
    const res = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });
    if (method === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
    if (method !== 'GET' && method !== 'POST') return res(405, { error: 'Method Not Allowed' });

    let body = {};
    if (method === 'POST' && event.body) { try { body = JSON.parse(event.body); } catch { return res(400, { error: 'Pedido inválido.' }); } }
    if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};
    const q = event.queryStringParameters || {};
    const slug = str(method === 'GET' ? q.site : body.site, 40).toLowerCase();
    if (!SLUG_RE.test(slug)) return res(400, { error: 'Agenda inválida.' });
    const cadastro = getCadastro(slug);
    if (!cadastro) return res(404, { error: 'Esta agenda não existe.' });
    const db = getDb();
    if (!db) return res(503, { error: 'Serviço indisponível. Tente de novo em instantes.' });
    const ip = headers['cf-connecting-ip'] || String(headers['x-forwarded-for'] || '').split(',')[0].trim();

    const conta = db.collection(COLLECTION).doc(slug);
    const itens = conta.collection('itens');
    const lerConta = async () => { const s = await conta.get(); return s.exists ? s.data() : {}; };
    const itensDoDia = async data => (await itens.where('data', '==', data).get()).docs.map(d => ({ id: d.id, ...d.data() }));

    /** Grava um agendamento/bloqueio junto com as travas; falha se alguém pegou o horário antes. */
    async function gravarComTravas(item, cfg) {
      const ref = itens.doc();
      const lote = db.batch();
      lote.set(ref, item);
      const travas = item.tipo === 'agendamento' ? fatias(item.inicio, item.fim, cfg.intervalo) : [];
      for (const f of travas) lote.create(conta.collection('ocupado').doc(`${item.data}_${f}`), { item: ref.id });
      try { await lote.commit(); } catch (e) {
        if (e && (e.code === 6 || /ALREADY_EXISTS/.test(String(e.message)))) return null;
        throw e;
      }
      return ref.id;
    }
    async function soltarTravas(id, item, cfg) {
      const lote = db.batch();
      for (const f of fatias(item.inicio, item.fim, cfg.intervalo)) lote.delete(conta.collection('ocupado').doc(`${item.data}_${f}`));
      await lote.commit();
    }

    // ── Público: ver horários ──
    if (method === 'GET') {
      const cfg = montarConfig(cadastro, (await lerConta()).config);
      const data = str(q.data, 10);
      if (!data) {
        const hoje = agoraBr(now()).data;
        const dias = [];
        for (let i = 0; i <= cfg.dias_a_frente && dias.length < 60; i++) {
          const d = somaDias(hoje, i);
          if ((cfg.semana[diaSemana(d)] || []).length) dias.push(d);
        }
        return res(200, { ...configPublica(cfg), dias });
      }
      if (!dataValida(data)) return res(400, { error: 'Data inválida.' });
      const servico = cfg.servicos.find(s => s.id === str(q.servico, 40)) || cfg.servicos[0];
      const livres = horariosLivres(cfg, data, servico.duracao, await itensDoDia(data), now());
      return res(200, { data, servico: servico.id, horarios: livres });
    }

    const acao = str(body.acao, 30);

    // ── Público: agendar ──
    if (acao === 'agendar') {
      if (str(body.site_url, 10)) return res(200, { ok: true }); // armadilha para robôs
      if (!ipPermitido('agendar', ip, now())) return res(429, { error: 'Muitos pedidos seguidos. Tente de novo em 1 minuto.' });
      if (body.consentimento !== true) return res(400, { error: 'É preciso aceitar o contato (LGPD).' });
      const { pessoa, error } = limparPessoa(body, { exigirContato: true });
      if (error) return res(400, { error });
      const cfg = montarConfig(cadastro, (await lerConta()).config);
      const data = str(body.data, 10);
      const inicio = str(body.inicio, 5);
      if (!dataValida(data) || !HORA_RE.test(inicio)) return res(400, { error: 'Escolha o dia e o horário.' });
      const servico = cfg.servicos.find(s => s.id === str(body.servico, 40));
      if (!servico) return res(400, { error: 'Escolha o serviço.' });
      if (!horariosLivres(cfg, data, servico.duracao, await itensDoDia(data), now()).includes(inicio)) {
        return res(409, { error: 'Esse horário acabou de ser ocupado. Escolha outro.' });
      }
      const item = { tipo: 'agendamento', status: 'pendente', origem: 'site', data, inicio, fim: hhmm(min(inicio) + servico.duracao), servico: servico.id, servico_nome: servico.nome, ...pessoa, criado_em: new Date(now()).toISOString() };
      const id = await gravarComTravas(item, cfg);
      if (!id) return res(409, { error: 'Esse horário acabou de ser ocupado. Escolha outro.' });
      return res(201, { ok: true, id, data, inicio, servico: servico.nome, whatsapp: cfg.whatsapp, nome: cfg.nome });
    }

    // ── Painel: entrar ──
    const novaSessao = async () => {
      const token = aleatorio(32);
      await conta.collection('sessoes').doc(await sha256(token)).set({ expira: now() + SESSAO_DIAS * 86400000, criado_em: new Date(now()).toISOString() });
      return token;
    };

    if (acao === 'primeiro-acesso' || acao === 'entrar') {
      if (!ipPermitido('entrar', ip, now())) return res(429, { error: 'Muitas tentativas. Espere 10 minutos e tente de novo.' });
      const dados = await lerConta();
      const versao = Number(cadastro.versao) || 1;
      // codigo_sempre: só na agenda de teste (código público), para o teste no ar repetir o primeiro acesso.
      const codigoValido = cadastro.codigo_sempre === true || !dados.senha_hash || (Number(dados.versao) || 1) < versao;
      if (acao === 'primeiro-acesso') {
        if (!codigoValido) return res(400, { error: 'Esta agenda já tem senha. Use "Entrar".' });
        const codigo = str(body.codigo, 40).toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!cadastro.codigo_hash || !iguais(await hashSenha(codigo, cadastro.codigo_salt), cadastro.codigo_hash)) return res(401, { error: 'Código de acesso errado.' });
        const fraca = senhaFraca(body.senha_nova);
        if (fraca) return res(400, { error: fraca });
        const salt = aleatorio(16);
        await conta.set({ senha_hash: await hashSenha(body.senha_nova, salt), senha_salt: salt, versao, senha_em: new Date(now()).toISOString() }, { merge: true });
        return res(200, { ok: true, token: await novaSessao() });
      }
      if (!dados.senha_hash) return res(400, { error: 'Primeiro acesso: use o código que você recebeu para criar sua senha.', primeiro_acesso: true });
      if (typeof body.senha !== 'string' || !iguais(await hashSenha(body.senha.slice(0, 100), dados.senha_salt), dados.senha_hash)) return res(401, { error: 'Senha errada.' });
      return res(200, { ok: true, token: await novaSessao() });
    }

    // ── Painel: daqui para baixo precisa estar logado ──
    let sessaoId = null;
    let logado = false;
    const token = str(body.token, 100);
    if (/^[a-f0-9]{64}$/.test(token)) {
      sessaoId = await sha256(token);
      const s = await conta.collection('sessoes').doc(sessaoId).get();
      logado = s.exists && Number(s.data().expira) > now();
    }
    if (!logado && headers.authorization) {
      const auth = await getMw().verifyBearerToken(event);
      logado = !!(auth.ok && auth.role === 'master');
      sessaoId = null;
    }
    if (!logado) return res(401, { error: 'Entre de novo no painel.', sair: true });

    const dados = await lerConta();
    const cfg = montarConfig(cadastro, dados.config);

    if (acao === 'sair') {
      if (sessaoId) await conta.collection('sessoes').doc(sessaoId).delete();
      return res(200, { ok: true });
    }

    if (acao === 'trocar-senha') {
      if (!dados.senha_hash || typeof body.senha_atual !== 'string' || !iguais(await hashSenha(body.senha_atual.slice(0, 100), dados.senha_salt), dados.senha_hash)) return res(401, { error: 'Senha atual errada.' });
      const fraca = senhaFraca(body.senha_nova);
      if (fraca) return res(400, { error: fraca });
      const salt = aleatorio(16);
      await conta.set({ senha_hash: await hashSenha(body.senha_nova, salt), senha_salt: salt, senha_em: new Date(now()).toISOString() }, { merge: true });
      return res(200, { ok: true });
    }

    if (acao === 'listar') {
      const hoje = agoraBr(now()).data;
      const de = dataValida(str(body.de, 10)) ? body.de : hoje;
      let ate = dataValida(str(body.ate, 10)) ? body.ate : somaDias(de, 6);
      if (ate < de) ate = de;
      if (ate > somaDias(de, 62)) ate = somaDias(de, 62);
      const snap = await itens.where('data', '>=', de).where('data', '<=', ate).get();
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio));
      // Pedidos que esperam resposta, mesmo fora do período visto.
      const pend = await itens.where('status', '==', 'pendente').get();
      const pendentes = pend.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.data >= hoje).sort((a, b) => (a.data + a.inicio).localeCompare(b.data + b.inicio));
      return res(200, { de, ate, hoje, itens: lista, pendentes, config: cfg });
    }

    if (acao === 'horarios') {
      const data = str(body.data, 10);
      if (!dataValida(data)) return res(400, { error: 'Data inválida.' });
      const servico = cfg.servicos.find(s => s.id === str(body.servico, 40)) || cfg.servicos[0];
      // A dona pode marcar em cima da hora: sem antecedência mínima.
      return res(200, { data, horarios: horariosLivres({ ...cfg, antecedencia_horas: 0 }, data, servico.duracao, await itensDoDia(data), now()) });
    }

    if (acao === 'criar') {
      const { pessoa, error } = limparPessoa(body, { exigirContato: false });
      if (error) return res(400, { error });
      const data = str(body.data, 10);
      const inicio = str(body.inicio, 5);
      if (!dataValida(data) || !HORA_RE.test(inicio)) return res(400, { error: 'Escolha o dia e o horário.' });
      const servico = cfg.servicos.find(s => s.id === str(body.servico, 40));
      if (!servico) return res(400, { error: 'Escolha o serviço.' });
      const fim = hhmm(min(inicio) + servico.duracao);
      if (min(inicio) + servico.duracao > 1440) return res(400, { error: 'O atendimento passa da meia-noite.' });
      const conflito = (await itensDoDia(data)).find(it => ocupaHorario(it) && sobrepoe(min(inicio), min(fim), min(it.inicio), min(it.fim)));
      if (conflito) return res(409, { error: conflito.tipo === 'bloqueio' ? 'Esse horário está bloqueado.' : `Já tem ${conflito.nome} das ${conflito.inicio} às ${conflito.fim}.` });
      const item = { tipo: 'agendamento', status: 'confirmado', origem: 'painel', data, inicio, fim, servico: servico.id, servico_nome: servico.nome, ...pessoa, criado_em: new Date(now()).toISOString() };
      const id = await gravarComTravas(item, cfg);
      if (!id) return res(409, { error: 'Esse horário acabou de ser ocupado.' });
      return res(201, { ok: true, id });
    }

    if (acao === 'status') {
      const id = str(body.id, 64);
      if (!ID_RE.test(id)) return res(400, { error: 'Agendamento inválido.' });
      if (!STATUS.includes(body.status)) return res(400, { error: 'Situação inválida.' });
      const ref = itens.doc(id);
      const s = await ref.get();
      if (!s.exists || s.data().tipo !== 'agendamento') return res(404, { error: 'Agendamento não encontrado.' });
      const atual = s.data();
      const liberar = ATIVOS.includes(atual.status) && !ATIVOS.includes(body.status);
      const reocupar = !ATIVOS.includes(atual.status) && ATIVOS.includes(body.status);
      if (reocupar) {
        const conflito = (await itensDoDia(atual.data)).find(it => it.id !== id && ocupaHorario(it) && sobrepoe(min(atual.inicio), min(atual.fim), min(it.inicio), min(it.fim)));
        if (conflito) return res(409, { error: 'Esse horário já foi ocupado por outra pessoa.' });
        const lote = db.batch();
        for (const f of fatias(atual.inicio, atual.fim, cfg.intervalo)) lote.set(conta.collection('ocupado').doc(`${atual.data}_${f}`), { item: id });
        await lote.commit();
      }
      await ref.update({ status: body.status, atualizado_em: new Date(now()).toISOString() });
      if (liberar) await soltarTravas(id, atual, cfg);
      return res(200, { ok: true });
    }

    if (acao === 'bloquear') {
      const data = str(body.data, 10);
      if (!dataValida(data)) return res(400, { error: 'Escolha o dia.' });
      const inicio = HORA_RE.test(str(body.inicio, 5)) ? body.inicio : '00:00';
      const fim = HORA_RE.test(str(body.fim, 5)) ? body.fim : '23:59';
      if (min(inicio) >= min(fim)) return res(400, { error: 'O fim precisa ser depois do início.' });
      const item = { tipo: 'bloqueio', data, inicio, fim, dia_todo: inicio === '00:00' && fim === '23:59', motivo: str(body.motivo, 120), criado_em: new Date(now()).toISOString() };
      const ref = await itens.add(item);
      const marcados = (await itensDoDia(data)).filter(it => it.tipo === 'agendamento' && ATIVOS.includes(it.status) && sobrepoe(min(inicio), min(fim), min(it.inicio), min(it.fim)));
      return res(201, { ok: true, id: ref.id, aviso: marcados.length ? `Atenção: ${marcados.length} agendamento(s) já marcado(s) nesse período continuam valendo.` : '' });
    }

    if (acao === 'desbloquear') {
      const id = str(body.id, 64);
      if (!ID_RE.test(id)) return res(400, { error: 'Bloqueio inválido.' });
      const ref = itens.doc(id);
      const s = await ref.get();
      if (!s.exists || s.data().tipo !== 'bloqueio') return res(404, { error: 'Bloqueio não encontrado.' });
      await ref.delete();
      return res(200, { ok: true });
    }

    if (acao === 'config') {
      const novo = body.config && typeof body.config === 'object' ? body.config : {};
      const salvar = {};
      for (const k of ['nome', 'whatsapp', 'endereco', 'servicos', 'semana', 'intervalo', 'antecedencia_horas', 'dias_a_frente', 'aviso']) if (novo[k] !== undefined) salvar[k] = novo[k];
      const final = montarConfig(cadastro, { ...(dados.config || {}), ...salvar });
      await conta.set({ config: final }, { merge: true });
      return res(200, { ok: true, config: final });
    }

    return res(400, { error: 'Ação desconhecida.' });
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
exports.horariosLivres = horariosLivres;
exports.montarConfig = montarConfig;
exports.hashSenha = hashSenha;
exports.fatias = fatias;
exports.agoraBr = agoraBr;
exports.COLLECTION = COLLECTION;
