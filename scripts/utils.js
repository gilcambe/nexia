'use strict';

// Funções utilitárias para revisão de PRs

// Devolve o número da issue citada no PR (fecha/closes/fixes/resolve #N).
function issueDoPr(pr) {
  const m = /(?:fecha|closes|fixes|resolve[sd]?|de)\s+#(\d+)/i.exec(`${pr.title || ''}\n${pr.body || ''}`) || /#(\d{3,})/.exec(`${pr.title || ''}\n${pr.body || ''}`);
  return m ? Number(m[1]) : null;
}

// CI verde: todos os check-runs relevantes concluídos com sucesso.
function ciVerde(runs) {
  const r = (runs || []).filter(c => c.name !== 'Merge automático' && c.name !== 'Testar com login');
  return r.some(c => c.name === 'Typecheck, testes e build')
    && r.every(c => c.status === 'completed' && ['success', 'skipped', 'neutral'].includes(c.conclusion));
}

// Verifica se o PR altera arquivos restritos.
function isRestrictedChange(pr) {
  const RESTritos = /^(\.github\/|firestore\.rules|firestore\.indexes|storage\.rules|\.env|wrangler|package(-lock)?\.json|cloudflare\/(worker|app)\.js|lib\/firebase-lite|sites\/[^/]+\/dados)|(secret|credential|auth|login|senha|\.pem$|\.key$)/i;
  const nomes = (pr.files || []).map(f => f.filename);
  return nomes.some(n => RESTritos.test(n));
}

// Verifica se o PR está vazio (sem arquivos alterados).
function isEmptyPR(pr) {
  return !(pr.files && pr.files.length > 0);
}

// Verifica se a descrição menciona uma issue contendo 'cortex-fila'.
function mencionaCortexFila(pr, issuesPorNumero) {
  const n = issueDoPr(pr);
  if (!n) return false;
  const corpo = issuesPorNumero[n] || '';
  return /cortex-fila/i.test(String(corpo));
}

// Lê o veredito da IA.
function lerVeredito(texto) {
  const m = /\{[\s\S]*\}/.exec(String(texto || ''));
  if (!m) return null;
  try {
    const v = JSON.parse(m[0]);
    if (typeof v.aprovar !== 'boolean') return null;
    return { aprovar: v.aprovar, nota: Number(v.nota) || 0, motivo: String(v.motivo || '').slice(0, 300), problemas: (Array.isArray(v.problemas) ? v.problemas : []).map(String).slice(0, 6) };
  } catch { return null; }
}

// Decisão final: SEMPRE 2 provedores diferentes aprovando com nota mínima; 1 voto só nunca aprova.
function decidir(votos) {
  const NOTA_MIN = 8;
  const validos = votos.filter(Boolean);
  if (!validos.length) return { acao: 'esperar' };
  const recusa = validos.find(v => !v.aprovar || v.nota < NOTA_MIN);
  if (recusa) return { acao: 'recusar', voto: recusa };
  const provedores = new Set(validos.map(v => v.provider));
  if (provedores.size >= 2) return { acao: 'aprovar' };
  return { acao: 'esperar' };
}

module.exports = { issueDoPr, ciVerde, isRestrictedChange, isEmptyPR, mencionaCortexFila, lerVeredito, decidir };