'use strict';
// Confirmação humana de operações de escrita (spec §8 "modo write com confirmação").
// O modelo nunca consegue aprovar a própria operação:
//  1. Se o cliente MCP suporta elicitation, o Bridge pergunta direto à pessoa na
//     interface do cliente (a resposta não passa pelo modelo).
//  2. Senão, a operação fica pendente com um código de uso único que só aparece no
//     terminal do Bridge (stderr), nunca no resultado da ferramenta. A pessoa aprova com
//     `nexia-bridge approve <id> <código>`, que grava em <stateDir>/approvals (fora de
//     qualquer workspace). O modelo então repete a chamada com confirmation_id.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TTL_MS = 15 * 60 * 1000;
const ID_RE = /^[a-f0-9]{12}$/;
const CODE_RE = /^[A-Z2-9]{8}$/;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newCode() {
  return Array.from(crypto.randomBytes(8), b => ALPHABET[b % ALPHABET.length]).join('');
}
const hash = s => crypto.createHash('sha256').update(s).digest('hex');

function createApprovals(stateDir, { now = () => Date.now() } = {}) {
  const dir = path.join(stateDir, 'approvals');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const pending = new Map(); // id → { fingerprint, codeHash, expires, summary }

  return {
    dir,
    /** Cria um pedido. Devolve { id, code } — o código vai só para o stderr do Bridge. */
    request(fingerprint, summary) {
      const id = crypto.randomBytes(6).toString('hex');
      const code = newCode();
      pending.set(id, { fingerprint, codeHash: hash(code), expires: now() + TTL_MS, summary });
      return { id, code };
    },
    /** A operação repetida é a mesma do pedido e foi aprovada no terminal? Consome o pedido. */
    consume(id, fingerprint) {
      if (!ID_RE.test(String(id))) return { ok: false, reason: 'confirmation_id inválido.' };
      const p = pending.get(id);
      if (!p) return { ok: false, reason: 'Pedido de confirmação não encontrado (o Bridge foi reiniciado ou o pedido expirou).' };
      if (now() > p.expires) { pending.delete(id); return { ok: false, reason: 'Pedido de confirmação expirou.' }; }
      if (p.fingerprint !== fingerprint) return { ok: false, reason: 'A operação mudou desde o pedido; peça de novo.' };
      const file = path.join(dir, `${id}.json`);
      let approved = null;
      try { approved = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* ainda não aprovado */ }
      if (!approved) return { ok: false, pending: true, reason: 'Ainda não aprovado no terminal do Bridge.' };
      try { fs.unlinkSync(file); } catch { /* já removido */ }
      if (hash(String(approved.code || '')) !== p.codeHash) { pending.delete(id); return { ok: false, reason: 'Código de aprovação incorreto; o pedido foi cancelado.' }; }
      pending.delete(id);
      return { ok: true };
    },
  };
}

/** CLI: grava a aprovação. */
function approveFromCli(stateDir, id, code) {
  if (!ID_RE.test(String(id)) || !CODE_RE.test(String(code || '').toUpperCase())) throw new Error('Uso: nexia-bridge approve <id> <código>');
  const dir = path.join(stateDir, 'approvals');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify({ code: String(code).toUpperCase(), at: new Date().toISOString() }), { mode: 0o600 });
}

module.exports = { createApprovals, approveFromCli, TTL_MS };
