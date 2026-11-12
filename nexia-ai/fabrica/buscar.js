'use strict';
// Buscador da fábrica: ficha → modelo sugerido + módulos prontos / parecidos / que faltam (só estes vão para o Cortex).
const { carregar, sem } = require('./catalogo');
const { normalizarFicha, validarFicha } = require('./ficha');

const NIVEL3 = ['pagamento', 'cobranca', 'cartao', 'financeiro', 'erp', 'marketplace', 'nota fiscal', 'multi empresa', 'app nativo'];
const MIN_NIVEL1 = 3;          // modelo pronto + dados: gerar e publicar prévia (medido: segundos + ~26 s por 3 sites)
const MIN_POR_FALTA = 30;      // cada módulo novo vira tarefa pequena do Cortex (SUPOSIÇÃO a medir no M7)

/** Ramo digitado ("Clínica odontológica") → nichos do catálogo (["saude"]). */
function nichosDoRamo(ramo, cat) {
  const r = sem(ramo);
  const achados = Object.entries(cat.ramos || {})
    .filter(([nicho, palavras]) => r.includes(sem(nicho)) || palavras.some(p => r.includes(sem(p))))
    .map(([nicho]) => nicho);
  return achados.length ? achados : [r];
}

/** Pedido ("marcar horário") → módulo do catálogo, olhando id, nome e apelidos. */
function acharModulo(pedido, cat) {
  const p = sem(pedido);
  return (cat.modulos || []).find(m => sem(m.id) === p || sem(m.nome) === p || (m.apelidos || []).some(a => sem(a) === p))
    || (cat.modulos || []).find(m => (m.apelidos || []).some(a => p.includes(sem(a)) || sem(a).includes(p)) || p.includes(sem(m.id)));
}

function consultar(fichaBruta, cat = carregar()) {
  const ficha = normalizarFicha(fichaBruta);
  const erros = validarFicha(ficha);
  if (erros.length) return { ficha, modelo: null, prontos: [], parecidos: [], faltam: [], nivel: null, minutos: null, erros };
  const nichos = nichosDoRamo(ficha.ramo, cat);

  // Pedidos que viram módulos; os que não existem ficam guardados como "faltam".
  const pedidos = ficha.precisa.map(p => ({ pedido: p, modulo: acharModulo(p, cat) }));
  const idsPedidos = new Set(pedidos.filter(x => x.modulo).map(x => x.modulo.id));

  // Modelo: mesmo nicho vale mais; cobrir os módulos pedidos também conta; clonável desempata.
  const pontua = mo => mo.nichos.filter(n => nichos.includes(n)).length * 10 + mo.modulos.filter(x => idsPedidos.has(x)).length * 2 + (mo.clonavel ? 1 : 0);
  const candidatos = (cat.modelos || []).map(mo => ({ mo, p: pontua(mo) })).filter(x => x.p >= 2).sort((a, b) => b.p - a.p);
  const mo = candidatos[0] ? candidatos[0].mo : null;
  const modelo = mo ? { id: mo.id, nome: mo.nome, clonavel: !!mo.clonavel, falta_para_clonar: mo.falta_para_clonar || null, porque: mo.nichos.some(n => nichos.includes(n)) ? `mesmo ramo (${nichos.join(', ')})` : 'usa os módulos pedidos' } : null;

  const porId = new Map((cat.modulos || []).map(m => [m.id, m]));
  const prontos = new Map(), parecidos = [], faltam = [];
  for (const id of (mo ? mo.modulos : [])) { const m = porId.get(id); if (m && m.pronto) prontos.set(id, { id, nome: m.nome }); }
  for (const { pedido, modulo } of pedidos) {
    if (modulo && modulo.pronto) { prontos.set(modulo.id, { id: modulo.id, nome: modulo.nome }); continue; }
    const n3 = NIVEL3.some(k => pedido.includes(k));
    if (modulo) parecidos.push({ pedido, id: modulo.id, nome: modulo.nome, diferenca: 'existe, mas ainda não está pronto para copiar', nivel: n3 ? 3 : modulo.nivel });
    else faltam.push({ pedido, nivel: n3 ? 3 : 2 });
  }

  const niveis = [...prontos.keys()].map(id => porId.get(id).nivel).concat(parecidos.map(x => x.nivel), faltam.map(x => x.nivel));
  const nivel = Math.max(1, ...niveis, modelo && !modelo.clonavel ? 2 : 1);
  const minutos = nivel >= 3 ? null : MIN_NIVEL1 + (faltam.length + parecidos.length) * MIN_POR_FALTA + (modelo && !modelo.clonavel ? MIN_POR_FALTA : 0);
  return { ficha, modelo, prontos: [...prontos.values()], parecidos, faltam, nivel, minutos, erros: [] };
}

module.exports = { consultar, nichosDoRamo, acharModulo };
