'use strict';
// #2717 (Ordem Mestra Kernex, fase 8): por que cada tarefa da fila está parada ou esperando, em português simples.
// Lê só rótulos (o que a fila, o Jules e a Reserva já gravam). Função pura, testada em tests/unit/central-motivos.test.js.

const MOTIVOS = Object.freeze({
  rodando: 'Fazendo agora',
  'esperando-dono': 'Esperando você (só o dono pode aprovar)',
  'vez-do-claude': 'IAs grátis não conseguiram: vez da Claude',
  jules: 'Com o Jules (IA grátis do Google)',
  reserva: 'Com as IAs conectadas na Central',
  'sem-cota': 'Sem cota grátis hoje: volta sozinha amanhã',
  travado: 'Travada depois de várias tentativas',
  'esperando-parte': 'Esperando a parte anterior terminar',
  dividido: 'Dividida em partes menores',
  tentando: 'Tentando de novo',
  urgente: 'Na frente da fila (pedido do dono)',
  fila: 'Esperando a vez na fila',
});

const nomes = (i) => (i.labels || []).map((l) => l.name || l);
const tentativas = (ls) => ls.reduce((m, l) => { const x = /^tentativa-(\d+)$/.exec(l); return x ? Math.max(m, Number(x[1])) : m; }, 0);

/** Motivo de uma issue: { codigo, texto }. A ordem dos testes é a ordem de importância. */
function motivoDe(issue) {
  const ls = nomes(issue);
  const t = tentativas(ls);
  const has = (l) => ls.includes(l);
  let codigo = 'fila';
  if (has('cortex-rodando')) codigo = 'rodando';
  else if (has('so-humano') || has('esperando-dono')) codigo = 'esperando-dono';
  else if (has('vez-do-claude')) codigo = 'vez-do-claude';
  else if (has('jules-enviado') || has('cortex-jules')) codigo = 'jules';
  else if (has('cortex-reserva-sem-cota')) codigo = 'sem-cota';
  else if (has('cortex-travado')) codigo = 'travado';
  else if (has('cortex-dividido')) codigo = 'dividido';
  else if (has('reserva-tentou') && t >= 3) codigo = 'reserva';
  else if (t > 0) codigo = 'tentando';
  else if (has('cortex-urgente')) codigo = 'urgente';
  let texto = MOTIVOS[codigo];
  if ((codigo === 'travado' || codigo === 'tentando') && t) texto += ` (${t} tentativa${t > 1 ? 's' : ''})`;
  return { codigo, texto };
}

/** Contagem por motivo, do maior para o menor: [{ codigo, texto, total }]. */
function resumo(issues) {
  const c = {};
  for (const i of issues || []) { if (i.pull_request) continue; const m = motivoDe(i).codigo; c[m] = (c[m] || 0) + 1; }
  return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([codigo, total]) => ({ codigo, texto: MOTIVOS[codigo], total }));
}

module.exports = { MOTIVOS, motivoDe, resumo };
