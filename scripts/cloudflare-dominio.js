// Liga um subdomínio do kernex.com.br ao Worker (Cloudflare > Workers > Custom Domains). Só ADICIONA, nunca remove.
// Uso: CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... node scripts/cloudflare-dominio.js finance.kernex.com.br [worker]
async function main() {
  const host = String(process.argv[2] || '').trim().toLowerCase();
  const servico = process.argv[3] || 'nexia';
  if (!/^[a-z0-9-]+\.kernex\.com\.br$/.test(host)) throw new Error('Use um subdomínio de kernex.com.br');
  const conta = process.env.CLOUDFLARE_ACCOUNT_ID; const tok = process.env.CLOUDFLARE_API_TOKEN;
  if (!conta || !tok) throw new Error('Faltam CLOUDFLARE_ACCOUNT_ID ou CLOUDFLARE_API_TOKEN');
  const h = { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' };
  const api = async (metodo, caminho, corpo) => {
    const r = await fetch(`https://api.cloudflare.com/client/v4${caminho}`, { method: metodo, headers: h, body: corpo ? JSON.stringify(corpo) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.success === false) throw new Error(`${metodo} ${caminho.split('?')[0]}: ${r.status} ${JSON.stringify(j.errors || j).slice(0, 300)}`);
    return j.result;
  };
  const ja = await api('GET', `/accounts/${conta}/workers/domains?hostname=${host}`);
  if (Array.isArray(ja) && ja.some((d) => d.hostname === host)) { console.log(`${host} já está ligado ao Worker ${ja[0].service}.`); return; }
  const zonas = await api('GET', '/zones?name=kernex.com.br');
  if (!zonas || !zonas[0]) throw new Error('Zona kernex.com.br não encontrada nesta conta');
  const r = await api('PUT', `/accounts/${conta}/workers/domains`, { environment: 'production', hostname: host, service: servico, zone_id: zonas[0].id });
  console.log(`Ligado: ${r.hostname} -> Worker ${r.service}`);
}
main().catch((e) => { console.error('Falhou:', e.message); process.exit(1); });
