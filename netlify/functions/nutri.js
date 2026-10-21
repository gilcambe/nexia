'use strict';

// KERNEX Nutri — Backend para sites de nutricionistas (Adriano Blumer e outros).
// Grátis: Cloudflare Workers + Firestore.
//
// Público:
//   GET  /api/nutri?site=<slug>                 → informações públicas do perfil
//   GET  /api/nutri?site=<slug>&conteudo=1      → conteúdo editado do site
//   GET  /api/nutri?site=<slug>&foto_listar=1   → lista de fotos (pode filtrar por grupo)
//   GET  /api/nutri?site=<slug>&foto=<id>       → arquivo binário da foto
//
// Painel (POST com { acao, site, token, ... }):
//   primeiro-acesso { codigo, senha_nova } · entrar { senha } · sair · trocar-senha { senha_atual, senha_nova }
//   site-salvar { conteudo } · site-historico · site-restaurar { id } · site-desfazer
//   foto-enviar { dados, tipo, grupo, legenda, ordem, capa } · foto-listar · foto-editar · foto-remover
//   dm-config-ler · dm-config-salvar { regras, mensagem_padrao }
//
// Firestore: nutri_contas/<slug> { senha_hash, senha_salt, versao, config }
//            nutri_contas/<slug>/sessoes/<hash do token>
//            nutri_contas/<slug>/site/conteudo
//            nutri_contas/<slug>/historico/<id>
//            nutri_contas/<slug>/fotos/<id>
//            nutri_contas/<slug>/dm_config/regras

const COLLECTION = 'nutri_contas';
const SESSAO_DIAS = 30;
const SUPORTE_HORAS = 8;
const PBKDF2_ITER = 100000;
const LIMITES = { entrar: { max: 8, windowMs: 10 * 60_000 } };

const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
const digits = v => String(v || '').replace(/\D/g, '');
const SLUG_RE = /^[a-z0-9-]{3,40}$/;
const FOTO_ID_RE = /^[a-f0-9]{24}$/;
const GRUPOS_FOTO_VALIDOS = ['consultorio', 'bastidores', 'pacientes'];

const CONTEUDO_MAX_BYTES = 900 * 1024; // ~900 KB
const FOTO_MAX_BYTES = 600 * 1024; // 600 KB
const FOTOS_MAX_POR_GRUPO = 150;
const FOTOS_MAX_TOTAL = 300;
const TIPOS_FOTO = { 'image/webp': [0x52, 0x49, 0x46, 0x46], 'image/jpeg': [0xff, 0xd8, 0xff], 'image/png': [0x89, 0x50, 0x4e, 0x47] };

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

function urlHttpsOuVazio(uStr) {
  const s = str(uStr, 500);
  if (!s) return '';
  try {
    const parsed = new URL(s);
    if (parsed.protocol === 'https:') return parsed.href;
  } catch {
    // URL inválida
  }
  return '';
}

// ── Configuração ───────────────────────────────────────────────────────────

function montarConfig(cadastro = {}, salvo = {}) {
  const c = { ...(cadastro.config || {}), ...(salvo || {}) };
  return {
    nome: str(c.nome, 80) || str(cadastro.nome, 80) || 'Nutricionista',
    crn: str(c.crn, 40),
    whatsapp: digits(c.whatsapp).slice(0, 13),
    email: str(c.email, 120),
    endereco: str(c.endereco, 200),
    biolink: str(c.biolink, 200),
    instagram: str(c.instagram, 200),
    tiktok: str(c.tiktok, 200),
    youtube: str(c.youtube, 200),
    horario_resposta: str(c.horario_resposta, 200),
    mensagem_instagram: str(c.mensagem_instagram, 500),
    aviso: str(c.aviso, 300),
  };
}

const configPublica = cfg => ({
  nome: cfg.nome,
  crn: cfg.crn,
  whatsapp: cfg.whatsapp,
  email: cfg.email,
  endereco: cfg.endereco,
  biolink: cfg.biolink,
  instagram: cfg.instagram,
  tiktok: cfg.tiktok,
  youtube: cfg.youtube,
  horario_resposta: cfg.horario_resposta,
  mensagem_instagram: cfg.mensagem_instagram,
  aviso: cfg.aviso,
});

// ── Limite de Tentativas por IP ─────────────────────────────────────────────

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

// ── Sanitização de Conteúdo do Site ────────────────────────────────────────

function limparConteudoNutri(c) {
  c = c && typeof c === 'object' && !Array.isArray(c) ? c : {};
  const out = {};

  if (c.hero && typeof c.hero === 'object') {
    out.hero = {
      eyebrow: str(c.hero.eyebrow, 120),
      title: str(c.hero.title, 120),
      subtitle: str(c.hero.subtitle, 300),
      cta_label: str(c.hero.cta_label, 60),
      cta2_label: str(c.hero.cta2_label, 60),
    };
  }

  if (c.sobre && typeof c.sobre === 'object') {
    out.sobre = {
      title: str(c.sobre.title, 120),
      subtitle: str(c.sobre.subtitle, 200),
      text: str(c.sobre.text, 2000),
    };
  }

  if (c.aviso && typeof c.aviso === 'object') {
    out.aviso = {
      ativo: Boolean(c.aviso.ativo),
      texto: str(c.aviso.texto, 300),
      cor: str(c.aviso.cor, 30) || 'info',
    };
  }

  if (c.contatos && typeof c.contatos === 'object') {
    const cnt = c.contatos;
    out.contatos = {
      whatsapp: digits(cnt.whatsapp).slice(0, 13),
      email: str(cnt.email, 120),
      endereco: str(cnt.endereco, 200),
      instagram: str(cnt.instagram, 200),
      tiktok: str(cnt.tiktok, 200),
      youtube: str(cnt.youtube, 200),
      biolink: str(cnt.biolink, 200),
      horario_resposta: str(cnt.horario_resposta, 200),
    };
  }

  if (Array.isArray(c.dicas)) {
    out.dicas = c.dicas.slice(0, 50).map(d => {
      if (!d || typeof d !== 'object') return null;
      return {
        id: str(d.id, 40) || aleatorio(8),
        titulo: str(d.titulo, 120),
        texto: str(d.texto, 1000),
        categoria: str(d.categoria, 60),
      };
    }).filter(d => d && (d.titulo || d.texto));
  }

  if (Array.isArray(c.posts)) {
    out.posts = c.posts.slice(0, 50).map(p => {
      if (!p || typeof p !== 'object') return null;
      return {
        id: str(p.id, 40) || aleatorio(8),
        titulo: str(p.titulo, 120),
        resumo: str(p.resumo, 300),
        link: urlHttpsOuVazio(p.link),
        imagem: str(p.imagem, 300),
      };
    }).filter(p => p && (p.titulo || p.resumo));
  }

  if (Array.isArray(c.especialidades)) {
    out.especialidades = c.especialidades.slice(0, 30).map(e => {
      if (!e || typeof e !== 'object') return null;
      return {
        id: str(e.id, 40) || aleatorio(8),
        titulo: str(e.titulo, 120),
        texto: str(e.texto, 500),
      };
    }).filter(e => e && e.titulo);
  }

  if (Array.isArray(c.perguntas)) {
    out.perguntas = c.perguntas.slice(0, 50).map(pq => {
      if (!pq || typeof pq !== 'object') return null;
      return {
        id: str(pq.id, 40) || aleatorio(8),
        pergunta: str(pq.pergunta, 200),
        resposta: str(pq.resposta, 1000),
      };
    }).filter(pq => pq && pq.pergunta);
  }

  if (Array.isArray(c.depoimentos)) {
    out.depoimentos = c.depoimentos.slice(0, 30).map(dp => {
      if (!dp || typeof dp !== 'object') return null;
      return {
        id: str(dp.id, 40) || aleatorio(8),
        nome: str(dp.nome, 80),
        texto: str(dp.texto, 800),
        oculto: dp.oculto !== undefined ? Boolean(dp.oculto) : true, // oculto por padrão
      };
    }).filter(dp => dp && dp.texto);
  }

  if (Array.isArray(c.redes)) {
    out.redes = c.redes.slice(0, 20).map(r => {
      if (!r || typeof r !== 'object') return null;
      return {
        id: str(r.id, 40) || aleatorio(8),
        rotulo: str(r.rotulo, 60),
        url: urlHttpsOuVazio(r.url),
      };
    }).filter(r => r && r.rotulo && r.url);
  }

  if (c.galeria && typeof c.galeria === 'object') {
    out.galeria = {
      titulo: str(c.galeria.titulo, 120) || 'Galeria de fotos',
      subtitulo: str(c.galeria.subtitulo, 200) || 'Consultório, rotina e bastidores',
      aviso_cfn: str(c.galeria.aviso_cfn, 300) || 'Atenção: o conselho de nutrição (CFN) restringe fotos de antes e depois e de resultados. Confirme com seu CRN antes de publicar e tenha autorização escrita do paciente.',
    };
  }

  return out;
}

// ── Manipulação de Fotos e Armazenamento ────────────────────────────────────

const _fotosCache = new Map();
let _fotosBytesCache = 0;

function guardarFotoEmMemoria(k, v) {
  if (_fotosCache.has(k)) return;
  _fotosCache.set(k, v);
  _fotosBytesCache += v.base64.length;
  while (_fotosBytesCache > 30 * 1024 * 1024 && _fotosCache.size) {
    const [k0, v0] = _fotosCache.entries().next().value;
    _fotosCache.delete(k0);
    _fotosBytesCache -= v0.base64.length;
  }
}

function lerFoto(dados, tipo) {
  const assinatura = TIPOS_FOTO[tipo];
  if (!assinatura || typeof dados !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(dados)) {
    return { error: 'Envie uma foto válida (JPG, PNG ou WebP).' };
  }
  const buf = Buffer.from(dados, 'base64');
  if (!buf.length) return { error: 'Foto vazia.' };
  if (buf.length > FOTO_MAX_BYTES) return { error: 'Foto grande demais (máximo 600 KB). Tente outra foto ou reduza o tamanho.' };
  if (!assinatura.every((b, i) => buf[i] === b)) return { error: 'Este arquivo não é uma foto válida.' };
  return { base64: buf.toString('base64'), bytes: buf.length };
}

function painelDe(slug) {
  return `https://${slug}.pages.dev/painel/`;
}

// ── Handler Principal ───────────────────────────────────────────────────────

function createHandler(deps = {}) {
  const getDb = deps.getDb || (() => require('./firebase-init').db);
  const getMw = deps.getMw || (() => require('./middleware'));
  const getCadastro = deps.getCadastro || (slug => {
    try { return require('../../clientes/nutris.js').NUTRIS[slug]; } catch { return undefined; }
  });
  const getLista = deps.getLista || (() => {
    try { return require('../../clientes/nutris.js').NUTRIS; } catch { return {}; }
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

    // Suporte KERNEX: lista de todas as contas de nutricionistas (só master)
    if (method === 'GET' && q.suporte === 'lista') {
      const auth = await getAuth();
      if (!auth.ok || auth.role !== 'master') return res(403, { error: 'Só o administrador da KERNEX vê esta lista.' });
      const lista = Object.entries(getLista())
        .map(([s, c]) => ({ site: s, nome: c.nome || s, painel: painelDe(s) }));
      return res(200, { nutris: lista });
    }

    const slug = str(method === 'GET' ? q.site : body.site, 40).toLowerCase();
    if (!SLUG_RE.test(slug)) return res(400, { error: 'Conta de nutricionista inválida.' });
    const cadastro = getCadastro(slug);
    if (!cadastro) return res(404, { error: 'Esta conta de nutricionista não existe.' });
    const db = getDb();
    if (!db) return res(503, { error: 'Serviço indisponível. Tente de novo em instantes.' });
    const ip = headers['cf-connecting-ip'] || String(headers['x-forwarded-for'] || '').split(',')[0].trim();

    const conta = db.collection(COLLECTION).doc(slug);
    const lerConta = async () => { const s = await conta.get(); return s.exists ? s.data() : {}; };

    // ── Público: Servir Arquivo da Foto por ID ──
    if (method === 'GET' && q.foto !== undefined) {
      const id = str(q.foto, 40);
      if (!FOTO_ID_RE.test(id)) return res(400, { error: 'Foto inválida.' });
      const k = slug + '/' + id;
      let f = _fotosCache.get(k);
      if (!f) {
        const snap = await conta.collection('fotos').doc(id).get();
        if (!snap.exists) return res(404, { error: 'Foto não encontrada.' });
        f = { tipo: snap.data().tipo, base64: snap.data().dados };
        guardarFotoEmMemoria(k, f);
      }
      return { statusCode: 200, isBase64Encoded: true, body: f.base64, headers: { ...cors, 'Content-Type': f.tipo, 'Cache-Control': 'public, max-age=31536000, immutable' } };
    }

    // ── Público: Conteúdo Editado do Site ──
    if (method === 'GET' && q.conteudo !== undefined) {
      const snap = await conta.collection('site').doc('conteudo').get();
      return res(200, { conteudo: snap.exists ? limparConteudoNutri(snap.data()) : null });
    }

    // ── Público: Lista Pública de Fotos ──
    if (method === 'GET' && q.foto_listar !== undefined) {
      const snap = await conta.collection('fotos').get();
      let fotos = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          tipo: data.tipo,
          grupo: GRUPOS_FOTO_VALIDOS.includes(data.grupo) ? data.grupo : 'consultorio',
          legenda: data.legenda || '',
          ordem: Number(data.ordem) || 0,
          capa: Boolean(data.capa),
          url: `/api/nutri?site=${slug}&foto=${d.id}`,
          criado_em: data.criado_em || null,
        };
      });
      const grupoFiltro = str(q.grupo, 40);
      if (grupoFiltro && GRUPOS_FOTO_VALIDOS.includes(grupoFiltro)) {
        fotos = fotos.filter(f => f.grupo === grupoFiltro);
      }
      fotos.sort((a, b) => (a.ordem - b.ordem) || (b.criado_em || '').localeCompare(a.criado_em || ''));
      return res(200, { fotos });
    }

    // ── Público: Perfil Geral / Config Pública ──
    if (method === 'GET') {
      const cfg = montarConfig(cadastro, (await lerConta()).config);
      return res(200, configPublica(cfg));
    }

    const acao = str(body.acao, 30);

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
        if (dados.senha_hash && (Number(dados.versao) || 1) >= versao) {
          return res(400, { error: 'Esta conta já tem senha. Use "Entrar".' });
        }
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

    // ── Suporte KERNEX: Acesso Master sem senha ──
    if (acao === 'suporte') {
      const auth = await getAuth();
      if (!auth.ok || auth.role !== 'master') return res(403, { error: 'Só o administrador da KERNEX entra como suporte.' });
      const token = aleatorio(32);
      const quando = new Date(now()).toISOString();
      const por = str(auth.email || auth.uid || 'master', 120);
      await conta.collection('sessoes').doc(await sha256(token)).set({ expira: now() + SUPORTE_HORAS * 3600000, criado_em: quando, suporte: true, por });
      await conta.collection('suporte').add({ por, em: quando });
      return res(200, { ok: true, token, painel: painelDe(slug), horas: SUPORTE_HORAS });
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

    if (acao === 'sair') {
      if (sessaoId) await conta.collection('sessoes').doc(sessaoId).delete();
      return res(200, { ok: true });
    }

    if (acao === 'trocar-senha') {
      const dados = await lerConta();
      if (!dados.senha_hash || typeof body.senha_atual !== 'string' || !iguais(await hashSenha(body.senha_atual.slice(0, 100), dados.senha_salt), dados.senha_hash)) {
        return res(401, { error: 'Senha atual incorreta.' });
      }
      const fraca = senhaFraca(body.senha_nova);
      if (fraca) return res(400, { error: fraca });
      const salt = aleatorio(16);
      await conta.set({ senha_hash: await hashSenha(body.senha_nova, salt), senha_salt: salt, senha_em: new Date(now()).toISOString() }, { merge: true });
      return res(200, { ok: true });
    }

    // ── Salvar e Restaurar Conteúdo do Site ──
    if (acao === 'site-salvar') {
      const conteudo = limparConteudoNutri(body.conteudo);
      if (JSON.stringify(conteudo).length > CONTEUDO_MAX_BYTES) {
        return res(413, { error: 'Conteúdo grande demais.' });
      }

      const agoraIso = new Date(now()).toISOString();
      const refAtual = conta.collection('site').doc('conteudo');
      const snapAtual = await refAtual.get();

      if (snapAtual.exists) {
        const antigo = snapAtual.data();
        const histId = aleatorio(12);
        await conta.collection('historico').doc(histId).set({
          ...antigo,
          salvo_em: agoraIso,
          historico_id: histId,
        });

        const histSnap = await conta.collection('historico').get();
        const versoes = histSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (versoes.length > 10) {
          versoes.sort((a, b) => (a.salvo_em || '').localeCompare(b.salvo_em || ''));
          const excedente = versoes.slice(0, versoes.length - 10);
          for (const item of excedente) {
            await conta.collection('historico').doc(item.id).delete();
          }
        }
      }

      const novoConteudo = { ...conteudo, atualizado_em: agoraIso };
      await refAtual.set(novoConteudo);
      return res(200, { ok: true, conteudo: novoConteudo });
    }

    if (acao === 'site-historico') {
      const snap = await conta.collection('historico').get();
      const items = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          atualizado_em: data.atualizado_em || data.salvo_em || null,
          salvo_em: data.salvo_em || null,
        };
      });
      items.sort((a, b) => (b.salvo_em || '').localeCompare(a.salvo_em || ''));
      return res(200, { historico: items.slice(0, 10) });
    }

    if (acao === 'site-restaurar') {
      const id = str(body.id, 64);
      if (!id) return res(400, { error: 'ID da versão do histórico é obrigatório.' });

      const refHist = conta.collection('historico').doc(id);
      const snapHist = await refHist.get();
      if (!snapHist.exists) return res(404, { error: 'Versão do histórico não encontrada.' });

      const dadosHist = snapHist.data();
      const conteudoLimpo = limparConteudoNutri(dadosHist);
      const agoraIso = new Date(now()).toISOString();
      const novoConteudo = { ...conteudoLimpo, atualizado_em: agoraIso };

      await conta.collection('site').doc('conteudo').set(novoConteudo);
      return res(200, { ok: true, conteudo: novoConteudo });
    }

    if (acao === 'site-desfazer') {
      await conta.collection('site').doc('conteudo').delete();
      return res(200, { ok: true });
    }

    // ── Gerenciamento de Fotos ──
    if (acao === 'foto-enviar') {
      let rawDados = body.dados || '';
      let tipo = str(body.tipo, 20);
      if (typeof rawDados === 'string' && rawDados.startsWith('data:')) {
        const match = rawDados.match(/^data:(image\/[a-z]+);base64,(.*)$/);
        if (match) {
          if (!tipo) tipo = match[1];
          rawDados = match[2];
        } else if (rawDados.includes(',')) {
          rawDados = rawDados.split(',')[1];
        }
      }

      const { base64, bytes, error: errFoto } = lerFoto(rawDados, tipo);
      if (errFoto) return res(400, { error: errFoto });

      const grupo = GRUPOS_FOTO_VALIDOS.includes(str(body.grupo, 40)) ? str(body.grupo, 40) : 'consultorio';

      const snapTotal = await conta.collection('fotos').get();
      const todasFotos = snapTotal.docs.map(d => d.data());
      if (todasFotos.length >= FOTOS_MAX_TOTAL) {
        return res(400, { error: 'Limite total de fotos atingido. Remova alguma foto antes de enviar outra.' });
      }

      const fotosDoGrupo = todasFotos.filter(f => (f.grupo || 'consultorio') === grupo);
      if (fotosDoGrupo.length >= FOTOS_MAX_POR_GRUPO) {
        return res(400, { error: `Limite de fotos atingido para a galeria "${grupo}". Remova alguma foto antes de enviar outra.` });
      }

      const id = aleatorio(12);
      const agoraIso = new Date(now()).toISOString();
      const novaFoto = {
        id,
        tipo,
        dados: base64,
        bytes,
        grupo,
        legenda: str(body.legenda, 200),
        ordem: Number(body.ordem) || 0,
        capa: Boolean(body.capa),
        criado_em: agoraIso,
        atualizado_em: agoraIso,
      };

      await conta.collection('fotos').doc(id).set(novaFoto);
      return res(201, { ok: true, id, foto: { id, tipo, grupo, url: `/api/nutri?site=${slug}&foto=${id}` } });
    }

    if (acao === 'foto-listar') {
      const snap = await conta.collection('fotos').get();
      let fotos = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          tipo: data.tipo,
          grupo: GRUPOS_FOTO_VALIDOS.includes(data.grupo) ? data.grupo : 'consultorio',
          legenda: data.legenda || '',
          ordem: Number(data.ordem) || 0,
          capa: Boolean(data.capa),
          url: `/api/nutri?site=${slug}&foto=${d.id}`,
          criado_em: data.criado_em || null,
        };
      });
      const grupoFiltro = str(body.grupo || q.grupo, 40);
      if (grupoFiltro && GRUPOS_FOTO_VALIDOS.includes(grupoFiltro)) {
        fotos = fotos.filter(f => f.grupo === grupoFiltro);
      }
      fotos.sort((a, b) => (a.ordem - b.ordem) || (b.criado_em || '').localeCompare(a.criado_em || ''));
      return res(200, { fotos });
    }

    if (acao === 'foto-editar') {
      const id = str(body.id, 64);
      if (!id || !FOTO_ID_RE.test(id)) return res(400, { error: 'ID de foto inválido.' });

      const refFoto = conta.collection('fotos').doc(id);
      const snap = await refFoto.get();
      if (!snap.exists) return res(404, { error: 'Foto não encontrada.' });

      const updateData = { atualizado_em: new Date(now()).toISOString() };
      if (body.legenda !== undefined) updateData.legenda = str(body.legenda, 200);
      if (body.ordem !== undefined) updateData.ordem = Number(body.ordem) || 0;
      if (body.capa !== undefined) updateData.capa = Boolean(body.capa);
      if (body.grupo !== undefined && GRUPOS_FOTO_VALIDOS.includes(str(body.grupo, 40))) {
        updateData.grupo = str(body.grupo, 40);
      }

      await refFoto.update(updateData);
      _fotosCache.delete(slug + '/' + id);
      return res(200, { ok: true });
    }

    if (acao === 'foto-remover') {
      const id = str(body.id, 64);
      if (!id || !FOTO_ID_RE.test(id)) return res(400, { error: 'ID de foto inválido.' });

      const refFoto = conta.collection('fotos').doc(id);
      const snap = await refFoto.get();
      if (!snap.exists) return res(404, { error: 'Foto não encontrada.' });

      await refFoto.delete();
      _fotosCache.delete(slug + '/' + id);
      return res(200, { ok: true });
    }

    // ── Configuração das Palavras-Chave do Instagram DM ──
    if (acao === 'dm-config-ler') {
      const snap = await conta.collection('dm_config').doc('regras').get();
      if (!snap.exists) {
        const cfg = montarConfig(cadastro, (await lerConta()).config);
        return res(200, {
          regras: [],
          mensagem_padrao: cfg.mensagem_instagram || 'Olá! Deixe sua mensagem e entrarei em contato em breve.',
        });
      }
      return res(200, snap.data());
    }

    if (acao === 'dm-config-salvar') {
      const regrasRaw = Array.isArray(body.regras) ? body.regras : [];
      if (regrasRaw.length > 30) {
        return res(400, { error: 'O limite de regras de palavras-chave do Instagram é 30.' });
      }

      const regrasSanitizadas = regrasRaw.slice(0, 30).map(r => {
        if (!r || typeof r !== 'object') return null;
        const palavrasRaw = Array.isArray(r.palavras) ? r.palavras : [];
        const palavras = palavrasRaw
          .slice(0, 20)
          .map(p => str(p, 50).toLowerCase())
          .filter(Boolean);

        const mensagem = str(r.mensagem, 1000);
        const link = urlHttpsOuVazio(r.link);
        const ativa = r.ativa !== undefined ? Boolean(r.ativa) : true;

        if (palavras.length === 0 || !mensagem) return null;

        return {
          id: str(r.id, 40) || aleatorio(8),
          palavras,
          mensagem,
          link,
          ativa,
        };
      }).filter(Boolean);

      const mensagemPadrao = str(body.mensagem_padrao, 1000) || str((await lerConta()).config?.mensagem_instagram, 500);
      const agoraIso = new Date(now()).toISOString();

      const docData = {
        regras: regrasSanitizadas,
        mensagem_padrao: mensagemPadrao,
        atualizado_em: agoraIso,
      };

      await conta.collection('dm_config').doc('regras').set(docData);
      return res(200, { ok: true, config: docData });
    }

    return res(400, { error: 'Ação desconhecida.' });
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
exports.montarConfig = montarConfig;
exports.hashSenha = hashSenha;
exports.COLLECTION = COLLECTION;
exports.limparConteudoNutri = limparConteudoNutri;
