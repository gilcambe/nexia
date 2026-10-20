'use strict';
// ID de requisição (#815). Um `rid` por pedido: vem do cabeçalho X-Request-Id (se for seguro) ou é
// gerado aqui; volta na resposta (X-Request-Id), entra no corpo dos erros 5xx e em cada log JSON.
// Erros 5xx também são guardados (sem dado pessoal: só rota, código, mensagem curta e rid) para a
// Central mostrar "últimos erros". Grátis: no máximo LIMITE_HORA gravações por hora por instância.

const crypto = require('crypto');

const COLECAO = 'erros_recentes';
const LIMITE_HORA = 30;
const RE_RID = /^[A-Za-z0-9._:-]{8,64}$/;

function novoRid() {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
}

/** @param {string | null | undefined} recebido valor do cabeçalho X-Request-Id */
function ridDe(recebido) {
  const v = String(recebido || '').trim();
  return RE_RID.test(v) ? v : novoRid();
}

/** Log de 1 linha em JSON (o painel do Cloudflare acha pelo rid). */
function logJson(nivel, msg, meta = {}) {
  const linha = JSON.stringify({ nivel, msg: String(msg).slice(0, 500), em: new Date().toISOString(), ...meta });
  if (nivel === 'error') console.error(linha); else if (nivel === 'warn') console.warn(linha); else console.log(linha);
  return linha;
}

let janela = { hora: '', n: 0 };
const _resetJanela = () => { janela = { hora: '', n: 0 }; };

/** Guarda 1 erro (best effort, nunca lança). Devolve true se gravou. */
async function guardarErro(db, item, agora = Date.now()) {
  if (!db) return false;
  const hora = new Date(agora).toISOString().slice(0, 13);
  if (janela.hora !== hora) janela = { hora, n: 0 };
  if (janela.n >= LIMITE_HORA) return false;
  janela.n++;
  try {
    const doc = {
      em: agora, rid: String(item.rid || ''), rota: String(item.rota || '').slice(0, 120),
      metodo: String(item.metodo || '').slice(0, 8), codigo: Number(item.codigo) || 0,
      msg: String(item.msg || '').slice(0, 300),
    };
    await db.collection(COLECAO).doc(`${agora}-${doc.rid.slice(0, 12)}`).set(doc);
    return true;
  } catch { return false; }
}

/** Últimos N erros, mais novo primeiro. */
async function listarErros(db, n = 50) {
  if (!db) return [];
  const snap = await db.collection(COLECAO).orderBy('em', 'desc').limit(Math.min(Math.max(1, n), 100)).get();
  return snap.docs.map((d) => d.data());
}

module.exports = { ridDe, novoRid, logJson, guardarErro, listarErros, COLECAO, LIMITE_HORA, _resetJanela };
