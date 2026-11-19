'use strict';
// Epico #4013 fase 3 (manual secao 2): onboarding em etapas.
// etapas(d) recebe d = { salario, jornada, contas, cartoes, fixas, importacoes } (numeros ou booleanos)
// e devolve { etapas: [{id,nome,feito,aba}], proxima, feitas, total } na ordem do manual.
// agirOnboarding(acao, ctx) responde a 'onboarding_status' lendo as origens em paralelo.
const ORDEM = [
  { id: 'salario', nome: 'Conta salario / orcamento', aba: 'orcamento' },
  { id: 'jornada', nome: 'Jornada da carreira', aba: 'carreira' },
  { id: 'contas', nome: 'Contas bancarias', aba: 'contas' },
  { id: 'cartoes', nome: 'Cartoes', aba: 'cartoes' },
  { id: 'fixas', nome: 'Despesas fixas', aba: 'gastos' },
  { id: 'importacoes', nome: 'Importacoes', aba: 'documentos' },
];

function etapas(d) {
  const dados = d || {};
  const lista = ORDEM.map((c) => ({ id: c.id, nome: c.nome, feito: !!dados[c.id], aba: c.aba }));
  const feitas = lista.filter((e) => e.feito).length;
  const naoFeita = lista.find((e) => !e.feito);
  return { etapas: lista, proxima: naoFeita ? naoFeita.id : null, feitas, total: lista.length };
}

const lerDoc = async (base, colecao, id) => {
  try {
    const snap = await base.collection(colecao).doc(id).get();
    return snap && snap.exists ? snap.data() : null;
  } catch { return null; };
};
const lerLista = async (listar, colecao) => {
  try { return await listar(colecao); } catch { return []; };
};

async function agirOnboarding(acao, ctx) {
  if (acao !== 'onboarding_status') return null;
  const { base, listar } = ctx || {};
  const [orc, contas, cartoes, gastos, importacoes] = await Promise.all([
    lerDoc(base, 'orcamento', 'atual'),
    lerLista(listar, base.collection('contas')),
    lerLista(listar, base.collection('cartoes')),
    lerLista(listar, base.collection('gastos')),
    lerLista(listar, base.collection('importacoes')),
  ]);
  const d = {
    salario: orc ? 1 : 0,
    jornada: orc && orc.jornada ? 1 : 0,
    contas: Array.isArray(contas) ? contas.length : 0,
    cartoes: Array.isArray(cartoes) ? cartoes.length : 0,
    fixas: Array.isArray(gastos) ? gastos.length : 0,
    importacoes: Array.isArray(importacoes) ? importacoes.length : 0,
  };
  return [200, etapas(d)];
}

module.exports = { etapas, agirOnboarding };

