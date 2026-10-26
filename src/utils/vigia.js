'use strict';

const REPO = 'gilcambe/nexia';
const ROTULO = 'cortex-alerta';

const tituloAlerta = (url) => `Cortex Alerta: ${url}`;

async function abrirAlerta(alerta, { token, fetchImpl = (...a) => fetch(...a) }) {
  const h = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'nexia-vigia', 'X-GitHub-Api-Version': '2022-11-28' };
  const lista = await fetchImpl(`https://api.github.com/repos/${REPO}/issues?state=open&labels=${ROTULO}&per_page=100`, { headers: h });
  const abertas = lista.ok ? await lista.json() : null;
  if (!Array.isArray(abertas)) return 'erro-lista';
  if (abertas.some((i) => i && i.title === tituloAlerta(alerta.url || alerta.nome))) return 'ja-aberta';
  const corpo = [
    `Aviso de cota ou alerta do sistema: ${alerta.nome || alerta.url}.`,
    `Detalhes / Uso: ${alerta.codigo || '81%'}.`,
    '',
    'O que fazer: verificar cotas de provedores de IA e transacionar para planos pagos se necessário.',
    'Feche esta issue quando o limite estiver normalizado.',
  ].join('\\n');
  const r = await fetchImpl(`https://api.github.com/repos/${REPO}/issues`, { method: 'POST', headers: h, body: JSON.stringify({ title: tituloAlerta(alerta.url || alerta.nome), body: corpo, labels: [ROTULO] }) });
  return r.status === 201 ? 'aberta' : `erro-${r.status}`;
}

module.exports = { abrirAlerta, tituloAlerta };
