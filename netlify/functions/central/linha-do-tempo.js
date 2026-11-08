'use strict';
// #3131 (#3125 parte 2/6): linha do tempo de uma tarefa, em português simples.
const { estadoTarefa } = require('./estado-tarefas');

const LABELS = {
  'cortex-rodando': ['⚙️', 'O Cortex pegou a tarefa'],
  'jules-enviado': ['🤖', 'O Jules pegou'],
  'cortex-jules': ['🤖', 'O Jules pegou'],
  'reserva-tentou': ['🤖', 'As IAs grátis pegaram'],
  'vez-do-claude': ['🧠', 'Foi para a Claude'],
  'cortex-travado': ['⚠️', 'Travou'],
  'cortex-feito': ['✅', 'Marcada como feita'],
};

/** Função pura: issue + eventos do timeline + PRs → [{ quando, icone, texto, link? }] em ordem de data. */
function montarLinha(issue, eventos = [], prs = [], agora = Date.now()) {
  const out = [{ quando: issue.created_at, icone: '📥', texto: 'Entrou na fila' }];
  const vistos = new Set();
  for (const e of Array.isArray(eventos) ? eventos : []) {
    const quando = e.created_at || e.submitted_at || null;
    if (!quando) continue;
    if (e.event === 'labeled' && e.label) {
      const nome = e.label.name;
      const t = /^tentativa-(\d+)$/.exec(nome);
      if (t) out.push({ quando, icone: '🔁', texto: 'Tentativa ' + t[1] });
      else if (LABELS[nome]) out.push({ quando, icone: LABELS[nome][0], texto: LABELS[nome][1] });
    } else if (e.event === 'cross-referenced' && e.source && e.source.issue && e.source.issue.pull_request) {
      const pr = e.source.issue;
      if (vistos.has(pr.number)) continue;
      vistos.add(pr.number);
      out.push({ quando, icone: '🔧', texto: 'Abriu o PR #' + pr.number, link: pr.html_url });
    } else if (e.event === 'closed') {
      const feito = (issue.labels || []).some((l) => ['cortex-feito', 'jules-feito'].includes(l.name || l));
      out.push({ quando, icone: feito ? '✅' : '⛔', texto: feito ? 'Concluída' : 'Fechada' });
    } else if (e.event === 'reopened') {
      out.push({ quando, icone: '↩️', texto: 'Reaberta' });
    }
  }
  for (const p of Array.isArray(prs) ? prs : []) {
    if (p.estado === 'juntado') out.push({ quando: p.quando, icone: '🎉', texto: 'PR #' + p.numero + ' juntado', link: p.link });
  }
  out.sort((a, b) => Date.parse(a.quando) - Date.parse(b.quando));
  out.push({ quando: new Date(agora).toISOString(), icone: '📍', texto: 'Agora: ' + estadoTarefa(issue, agora).texto });
  return out;
}

module.exports = { montarLinha };
