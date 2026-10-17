'use strict';
// Cortex no celular (/meu-cortex): os pedidos do Cortex são as issues "cortex-fila" do GitHub.
// O histórico fica guardado lá para sempre, de graça, e não depende da Claude.

const REPO = 'gilcambe/nexia';
const API = 'https://api.github.com';

const nomes = (i) => (i.labels || []).map((l) => l.name || l);
const tentativas = (i) => Math.max(0, (i.reactions && i.reactions.eyes ? i.reactions.gross : 0));

/**
 * Busca do REST do GitHub as issues abertas com o label 'cortex-fila'.
 * Usa o token do ambiente (GITHUB_TOKEN), presente no deployment.
 */
async function buscarFila() {
  const token = process.env.GITHUB_TOKEN || '';
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const url =
    `${API}/repos/${REPO}/issues?state=open`+
    `&labels=cortex-fila&per_page=100&sort=created&direction=asc`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GitHub HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const lista = await res.json();
  if (!Array.isArray(lista)) return [];
  return lista
    .filter((i) => (i && typeof i === 'object') && !i.pull_request)
    .map((i) => ({
      n: i.number,
      titulo: i.title || '',
      autor: (i.user && (i.user.login || i.user.name)) || '',
      criada_em: i.created_at || '',
      numeros: nomes(i),
      tentativas: tentativas(i),
      url: i.html_url || '',
    }));
}

// Handler da Netlify Function: GET /api/central/pedidos-gh
export default async function handler(_req, res) {
  try {
    const fila = await buscarFila();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.statusCode = 200;
    res.send(JSON.stringify({ ok: true, repo: REPO, total: fila.length, fila }));
  } catch (err) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.statusCode = 502;
    res.send(JSON.stringify({ ok: false, erro: (err && err.message) || 'falha ao consultar o GitHub' }));
  }
}
