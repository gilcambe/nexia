'use strict';
// Clonar site (ADR-CLONE-01): só endereço público na web. Recusa file:, data:, javascript:, usuário/senha
// na URL, porta fora de 80/443/8080/8443, localhost e IP de rede interna (IPv4 e IPv6), antes e depois do DNS.

const UA = 'NEXIA-Clone/1.0 (+https://github.com/gilcambe/nexia)';
const PORTS = ['', '80', '443', '8080', '8443'];

/** IPv4 em 4 números (a forma inteira/hex já chega normalizada pelo WHATWG URL). */
function ipv4Parts(host) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const p = m.slice(1).map(Number);
  return p.every(n => n <= 255) ? p : null;
}

function privateIpv4([a, b, c]) {
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)            // CGNAT
    || (a === 169 && b === 254)                       // link-local / metadados de nuvem
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 192 && b === 0 && (c === 0 || c === 2)) // IETF / TEST-NET-1
    || (a === 198 && (b === 18 || b === 19))          // benchmark
    || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113);
}

function privateIpv6(raw) {
  const h = raw.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === '::' || h === '::1') return true;
  const mapped = /^::ffff:(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/.exec(h);
  if (mapped) {
    if (mapped[1]) { const p = ipv4Parts(mapped[1]); return !p || privateIpv4(p); }
    const hi = parseInt(mapped[2], 16), lo = parseInt(mapped[3], 16);
    return privateIpv4([hi >> 8, hi & 255, lo >> 8, lo & 255]);
  }
  return /^(fc|fd|fe[89ab]|ff)/.test(h) || h.startsWith('::ffff:') || h.startsWith('64:ff9b:') || h.startsWith('2001:db8');
}

/** true se o IP (texto) é loopback, rede interna, link-local, multicast ou reservado. */
function isPrivateIp(ip) {
  const s = String(ip || '').trim();
  if (s.includes(':')) return privateIpv6(s);
  const p = ipv4Parts(s);
  return p ? privateIpv4(p) : false;
}

/**
 * Confere a URL pedida (sem rede).
 * @returns {{ ok: true, url: string, origin: string, host: string } | { ok: false, error: string }}
 */
function validateUrl(input) {
  const raw = String(input || '').trim();
  if (!raw || raw.length > 2000) return { ok: false, error: 'informe a URL do site (até 2000 caracteres)' };
  let u;
  try { u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`); } catch { return { ok: false, error: 'URL inválida' }; }
  if (!['http:', 'https:'].includes(u.protocol)) return { ok: false, error: 'só http:// ou https://' };
  if (u.username || u.password) return { ok: false, error: 'URL com usuário/senha não é aceita (nunca usamos credenciais)' };
  if (!PORTS.includes(u.port)) return { ok: false, error: 'porta não permitida' };
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!host || host === 'localhost' || /\.(localhost|local|internal|lan|home\.arpa)$/.test(host)) return { ok: false, error: 'endereço local não é aceito' };
  if (isPrivateIp(host)) return { ok: false, error: 'IP de rede interna não é aceito' };
  if (!host.includes('.') && !host.includes(':')) return { ok: false, error: 'domínio inválido' };
  u.hash = '';
  return { ok: true, url: u.href, origin: u.origin, host };
}

/**
 * Confere também o DNS (todos os IPs do nome). lookup = dns.promises.lookup; sem ele (ex.: Worker), vale só a checagem do texto.
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
async function checkResolved(host, lookup) {
  if (!lookup) return { ok: true };
  if (isPrivateIp(host)) return { ok: false, error: 'IP de rede interna não é aceito' };
  let addrs;
  try { addrs = await lookup(host, { all: true, verbatim: true }); } catch { return { ok: false, error: 'domínio não encontrado (DNS)' }; }
  const list = Array.isArray(addrs) ? addrs : [addrs];
  if (!list.length) return { ok: false, error: 'domínio sem endereço' };
  if (list.some(a => isPrivateIp(a && a.address !== undefined ? a.address : a))) return { ok: false, error: 'o domínio aponta para rede interna' };
  return { ok: true };
}

/** dns.promises.lookup quando o ambiente tem (Node); undefined no Worker. */
function defaultLookup() {
  try { return require('dns').promises.lookup; } catch { return undefined; }
}

module.exports = { UA, validateUrl, isPrivateIp, checkResolved, defaultLookup };
