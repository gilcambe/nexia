'use strict';
// Kernex Store na Central (S2, 13/11/2026). Usa o mesmo caminho da Fábrica (prefixo fabrica-):
//   GET  parte=fabrica-store                        → { modulos: [...modulo.json], clientes: [slug...] }  (lidos do kernex-clientes)
//   POST acao=fabrica-store-instalar {cliente, modulo, tirar?: true, cor?}
//        → dispara kernex-clientes/modulo-instalar.yml (instala, testa, publica no Pages do cliente, abre PR)
//   GET  parte=fabrica-store-status&cliente=&modulo= → { status: 'rodando'|'ok'|'falhou'|'nada', link? }
const REPO = 'gilcambe/kernex-clientes';
const WORKFLOW = 'modulo-instalar.yml';
const ID_RE = /^[a-z0-9-]{2,40}$/;
const COR_RE = /^#[0-9a-fA-F]{3,8}$/;

const dirs = (lista) => (Array.isArray(lista) ? lista : []).filter(x => x && x.type === 'dir' && ID_RE.test(x.name)).map(x => x.name);

async function lista({ gh }) {
  const [mods, clis] = await Promise.all([
    gh(`/repos/${REPO}/contents/modulos?ref=main`).catch(() => []),
    gh(`/repos/${REPO}/contents/clientes?ref=main`).catch(() => []),
  ]);
  const modulos = [];
  for (const id of dirs(mods)) {
    try {
      const f = await gh(`/repos/${REPO}/contents/modulos/${id}/modulo.json?ref=main`);
      const m = JSON.parse(Buffer.from(String(f.content || ''), 'base64').toString('utf8'));
      modulos.push({ id: m.id || id, nome: m.nome || id, faz: m.faz || '', versao: m.versao || '', preco: m.preco || null, ramos: m.ramos || ['*'] });
    } catch { /* módulo com json quebrado fica de fora */ }
  }
  // demo-* são os modelos da Fábrica, não clientes
  const clientes = dirs(clis).filter(s => !s.startsWith('demo-'));
  return { status: 200, corpo: { modulos, clientes } };
}

async function instalar(body, { gh }) {
  const b = body || {};
  const cliente = String(b.cliente || ''); const modulo = String(b.modulo || '');
  // body.acao é o nome da ação da Central (fabrica-store-instalar); tirar vem em campo próprio
  const acao = b.tirar === true ? 'tirar' : 'instalar';
  const cor = String(b.cor || '');
  if (!ID_RE.test(cliente) || cliente.startsWith('demo-')) return { status: 400, corpo: { error: 'cliente inválido.' } };
  if (!ID_RE.test(modulo)) return { status: 400, corpo: { error: 'módulo inválido.' } };
  if (cor && !COR_RE.test(cor)) return { status: 400, corpo: { error: 'cor inválida (use #rrggbb).' } };
  try {
    await gh(`/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, { method: 'POST', body: JSON.stringify({ ref: 'main', inputs: { cliente, modulo, acao, cor } }) });
  } catch (e) {
    return { status: 502, corpo: { error: 'O GitHub não aceitou agora: ' + e.message } };
  }
  return { status: 200, corpo: { status: 'rodando', cliente, modulo, acao, mensagem: `${acao === 'tirar' ? 'Tirando' : 'Instalando'} ${modulo} em ${cliente}. Leva uns 2 minutos.` } };
}

async function status(query, { gh }) {
  const cliente = String((query || {}).cliente || ''); const modulo = String((query || {}).modulo || '');
  if (!ID_RE.test(cliente) || !ID_RE.test(modulo)) return { status: 400, corpo: { error: 'cliente/módulo inválido.' } };
  const r = await gh(`/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=30&event=workflow_dispatch`);
  const run = (r.workflow_runs || []).find(x => { const t = String(x.display_title || '').split(/\s+/); return t.includes(cliente) && t.includes(modulo); });
  if (!run) return { status: 200, corpo: { status: 'nada' } };
  if (run.status !== 'completed') return { status: 200, corpo: { status: 'rodando', link: run.html_url } };
  return { status: 200, corpo: { status: run.conclusion === 'success' ? 'ok' : 'falhou', link: run.html_url } };
}

module.exports = { lista, instalar, status, REPO, WORKFLOW };
