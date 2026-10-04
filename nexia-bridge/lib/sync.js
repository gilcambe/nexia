'use strict';
// Envio do log local ao Vault (ADR-F12-04). Lê <stateDir>/bridge-log.jsonl a partir do
// ponto já enviado (<stateDir>/sync-state.json) e manda em lotes para
// POST <vault.url>/api/nexia/bridge/events com o token do Bridge (variável NEXIA_BRIDGE_TOKEN).
// Cada linha leva um id derivado do próprio conteúdo: reenvio não duplica no Vault.
// Falha de rede ou resposta de erro não perde nada: o ponto só avança depois do 200.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BATCH = 100;
const TOKEN_RE = /^nxb_[0-9a-f]{64}$/;

function createSync({ stateDir, logFile, url, token, fetchImpl = globalThis.fetch, timeoutMs = 15000 }) {
  const stateFile = path.join(stateDir, 'sync-state.json');
  const readOffset = () => { try { return Number(JSON.parse(fs.readFileSync(stateFile, 'utf8')).offset) || 0; } catch { return 0; } };
  const writeOffset = offset => fs.writeFileSync(stateFile, JSON.stringify({ offset, at: new Date().toISOString() }), { mode: 0o600 });
  let running = null;

  async function flushOnce() {
    if (!url || !TOKEN_RE.test(String(token || ''))) return { sent: 0, skipped: 'not_configured' };
    if (!fs.existsSync(logFile)) return { sent: 0 };
    let offset = readOffset();
    const size = fs.statSync(logFile).size;
    if (offset > size) offset = 0; // log apagado/trocado: recomeça (o id evita duplicar)
    let sent = 0;
    while (offset < size) {
      const fd = fs.openSync(logFile, 'r');
      const buf = Buffer.alloc(Math.min(size - offset, 1024 * 1024));
      fs.readSync(fd, buf, 0, buf.length, offset);
      fs.closeSync(fd);
      const text = buf.toString('utf8');
      const end = text.lastIndexOf('\n');
      if (end < 0) break; // linha ainda incompleta
      const lines = text.slice(0, end + 1).split('\n').slice(0, -1).slice(0, BATCH);
      const bytes = lines.reduce((n, l) => n + Buffer.byteLength(l) + 1, 0);
      const events = [];
      for (const l of lines) {
        try { events.push({ id: crypto.createHash('sha256').update(l).digest('hex').slice(0, 32), ...JSON.parse(l) }); } catch { /* linha corrompida: pula */ }
      }
      const r = await fetchImpl(`${url}/api/nexia/bridge/events`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ events }), signal: AbortSignal.timeout(timeoutMs),
      });
      if (!r.ok) return { sent, error: `HTTP ${r.status}` };
      offset += bytes;
      writeOffset(offset);
      sent += events.length;
    }
    return { sent };
  }

  return {
    /** Envia o que falta. Nunca lança; chamadas simultâneas esperam a mesma rodada. */
    flush() {
      if (!running) running = flushOnce().catch(e => ({ sent: 0, error: e && (e.name === 'TimeoutError' ? 'TIMEOUT' : e.code || 'NETWORK') })).finally(() => { running = null; });
      return running;
    },
  };
}

module.exports = { createSync, TOKEN_RE };
