'use strict';
// Cloudflare Adapter (spec §11). Somente leitura nesta fase: estado de deploy de Pages e
// Workers, domínios customizados do Pages e registros DNS de uma zona. Deploy não é feito
// pelo agente: passa pelo pipeline (deploy.staging, Fase 9; produção, Fase 11).
//
// Cada Integration "cloudflare" aponta para UM recurso pelo external_ref:
//   pages:<account_id>:<projeto>    workers:<account_id>:<script>    zone:<zone_id>
// Credencial: API token (recomendado: só leitura) numa variável do servidor referenciada
// pela Integration.
const { GatewayError, CODES } = require('../tool-gateway/errors');

const API = 'https://api.cloudflare.com/client/v4';
const ID = /^[0-9a-f]{32}$/;
const NAME = /^[A-Za-z0-9][A-Za-z0-9-]{0,62}$/;

function parseRef(ref) {
  const [kind, a, b] = String(ref || '').split(':');
  if (kind === 'pages' || kind === 'workers') { if (ID.test(a) && NAME.test(b || '')) return { kind, account: a, name: b }; }
  else if (kind === 'zone' && ID.test(a) && b === undefined) return { kind, zone: a };
  throw new GatewayError(CODES.INVALID_INPUT, 'external_ref da integração Cloudflare deve ser pages:<conta>:<projeto>, workers:<conta>:<script> ou zone:<zona>.');
}

function createCloudflareAdapter({ externalRef, token, fetchImpl = (...a) => fetch(...a) }) {
  const ref = parseRef(externalRef);
  if (!token) throw new GatewayError(CODES.CREDENTIAL_MISSING, 'Token Cloudflare ausente.');

  async function get(path) {
    let r;
    try { r = await fetchImpl(`${API}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(20000) }); }
    catch { throw new GatewayError(CODES.UPSTREAM, 'Cloudflare indisponível.'); }
    if (r.status === 401 || r.status === 403) throw new GatewayError(CODES.PROVIDER_AUTH, `Cloudflare recusou o token (${r.status}).`);
    if (r.status === 404) throw new GatewayError(CODES.UPSTREAM_NOT_FOUND, 'Recurso não encontrado na Cloudflare (ou sem acesso).');
    if (!r.ok) throw new GatewayError(CODES.UPSTREAM, `Cloudflare respondeu ${r.status}.`, { status: r.status });
    const d = await r.json();
    if (d.success === false) throw new GatewayError(CODES.UPSTREAM, 'Cloudflare devolveu erro.');
    return d.result;
  }

  return {
    ref,
    async deploymentStatus({ limit = 5 } = {}) {
      const n = Math.min(Math.max(limit, 1), 20);
      if (ref.kind === 'pages') {
        const base = `/accounts/${ref.account}/pages/projects/${encodeURIComponent(ref.name)}`;
        const [deps, domains] = await Promise.all([get(`${base}/deployments?per_page=${n}`), get(`${base}/domains`).catch(() => [])]);
        return { kind: 'pages', name: ref.name,
          deployments: (deps || []).slice(0, n).map(d => ({ id: d.id, environment: d.environment, url: d.url, created_on: d.created_on,
            stage: d.latest_stage ? `${d.latest_stage.name}:${d.latest_stage.status}` : null,
            branch: d.deployment_trigger && d.deployment_trigger.metadata && d.deployment_trigger.metadata.branch || null,
            commit: d.deployment_trigger && d.deployment_trigger.metadata && d.deployment_trigger.metadata.commit_hash || null })),
          custom_domains: (domains || []).map(x => ({ name: x.name, status: x.status })) };
      }
      if (ref.kind === 'workers') {
        const d = await get(`/accounts/${ref.account}/workers/scripts/${encodeURIComponent(ref.name)}/deployments`);
        const list = (d && d.deployments) || [];
        return { kind: 'workers', name: ref.name,
          deployments: list.slice(0, n).map(x => ({ id: x.id, created_on: x.created_on, source: x.source, strategy: x.strategy,
            versions: (x.versions || []).map(v => ({ version_id: v.version_id, percentage: v.percentage })) })) };
      }
      throw new GatewayError(CODES.INVALID_INPUT, 'Esta integração é de DNS (zone); use cloudflare.list_dns.');
    },

    async listDns({ limit = 100 } = {}) {
      if (ref.kind !== 'zone') throw new GatewayError(CODES.INVALID_INPUT, 'Esta integração não é de zona DNS.');
      const d = await get(`/zones/${ref.zone}/dns_records?per_page=${Math.min(Math.max(limit, 1), 100)}`);
      return { kind: 'zone', records: (d || []).map(x => ({ name: x.name, type: x.type, content: x.type === 'TXT' ? '(TXT omitido: pode conter token de verificação)' : x.content, proxied: !!x.proxied, ttl: x.ttl })) };
    },
  };
}

module.exports = { createCloudflareAdapter, parseRef };
