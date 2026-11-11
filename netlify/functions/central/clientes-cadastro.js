'use strict';
// Central (só o dono/master): criar cliente SEM PR (11/11/2026, regra dos 20 projetos em 1 hora).
// Grava kernex_cadastros/<tipo>__<slug> (lido por lib/cadastro-banco.js) e devolve o CÓDIGO de primeiro acesso UMA vez:
// no banco fica só o hash (mesma função de cada tipo). Nada de código em log.
const crypto = require('crypto');
const { COLECAO, limparCache } = require('../../../lib/cadastro-banco.js');

const TIPOS = {
  agenda: { arquivo: () => require('../../../clientes/agendas.js').AGENDAS, hash: () => require('../agenda.js').hashSenha },
  locacao: { arquivo: () => require('../../../clientes/locacoes.js').LOCACOES, hash: () => require('../locacao.js').hashSenha },
  viagem: { arquivo: () => require('../../../clientes/viagens.js').VIAGENS, hash: () => require('../viagem.js').hashSenha },
  nutri: { arquivo: () => require('../../../clientes/nutris.js').NUTRIS, hash: () => require('../nutri.js').hashSenha },
};
const ALFA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
const limpa = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

function validar(b) {
  const erros = [];
  if (!TIPOS[b.tipo]) erros.push('tipo deve ser: ' + Object.keys(TIPOS).join(', '));
  if (!SLUG_RE.test(String(b.slug || ''))) erros.push('slug: letras minúsculas, números e hífen (3 a 40)');
  if (limpa(b.nome, 120).length < 3) erros.push('nome obrigatório');
  if (b.whatsapp && !/^55\d{10,11}$/.test(String(b.whatsapp))) erros.push('whatsapp no formato 55DDDNÚMERO');
  return erros;
}

async function criar(body, { getDb, gerarCodigo, agora = () => new Date() } = {}) {
  const erros = validar(body || {});
  if (erros.length) return { status: 400, corpo: { error: erros.join('; ') } };
  const t = TIPOS[body.tipo];
  let noArquivo; try { noArquivo = (t.arquivo() || {})[body.slug]; } catch { noArquivo = undefined; }
  if (noArquivo) return { status: 409, corpo: { error: 'Já existe um cliente com esse endereço (no código).' } };
  const db = getDb();
  if (!db) return { status: 503, corpo: { error: 'Banco indisponível.' } };
  const ref = db.collection(COLECAO).doc(`${body.tipo}__${body.slug}`);
  const ja = await ref.get();
  if (ja && ja.exists) return { status: 409, corpo: { error: 'Já existe um cliente com esse endereço.' } };
  const codigo = (gerarCodigo || (() => Array.from(crypto.randomBytes(10)).map(b => ALFA[b % ALFA.length]).join('')))();
  const salt = crypto.randomBytes(16).toString('hex');
  const nome = limpa(body.nome, 120);
  const config = { nome, whatsapp: body.whatsapp ? String(body.whatsapp) : '', ...(body.config && typeof body.config === 'object' ? body.config : {}) };
  await ref.set({
    tipo: body.tipo, slug: body.slug, nome, versao: 1, ativo: true,
    codigo_salt: salt, codigo_hash: await t.hash()(codigo, salt),
    config, criado_em: agora().toISOString(), origem: 'central',
  });
  limparCache();
  return { status: 201, corpo: { ok: true, tipo: body.tipo, slug: body.slug, nome, codigo: `${codigo.slice(0, 5)}-${codigo.slice(5)}`, aviso: 'Anote o código: ele aparece só agora. No banco fica apenas o hash.' } };
}

async function listar({ getDb }) {
  const db = getDb();
  if (!db) return [];
  const snap = await db.collection(COLECAO).limit(500).get();
  return (snap.docs || []).map(d => { const x = d.data() || {}; return { tipo: x.tipo, slug: x.slug, nome: x.nome, ativo: x.ativo !== false, criado_em: x.criado_em || '' }; });
}

module.exports = { criar, listar, validar, TIPOS };
