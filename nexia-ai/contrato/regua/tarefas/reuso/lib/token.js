'use strict';
// Módulo pronto do projeto: token assinado com HMAC-SHA256. NÃO duplicar esta lógica em outro arquivo.
const crypto = require('node:crypto');
const b64 = s => Buffer.from(s).toString('base64url');
function assinar(dados, segredo) {
  const corpo = b64(JSON.stringify(dados));
  return corpo + '.' + crypto.createHmac('sha256', segredo).update(corpo).digest('base64url');
}
function validar(token, segredo) {
  const [corpo, ass] = String(token || '').split('.');
  if (!corpo || !ass) return null;
  const certo = crypto.createHmac('sha256', segredo).update(corpo).digest('base64url');
  if (ass.length !== certo.length || !crypto.timingSafeEqual(Buffer.from(ass), Buffer.from(certo))) return null;
  try { const d = JSON.parse(Buffer.from(corpo, 'base64url').toString()); return d.exp && d.exp < Date.now() ? null : d; } catch { return null; }
}
module.exports = { assinar, validar };
