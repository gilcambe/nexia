'use strict';
// Fase 3 do épico #4013 (manual CFO Pessoal, seção 2): primeiros passos em etapas, na ordem do manual.
const ETAPAS = [
  { id: 'salario', nome: 'Salário e dia do pagamento', aba: 'orcamento' },
  { id: 'jornada', nome: 'Jornada de trabalho', aba: 'carreira' },
  { id: 'contas', nome: 'Contas e saldos', aba: 'contas' },
  { id: 'cartoes', nome: 'Cartões de crédito', aba: 'cartoes' },
  { id: 'fixas', nome: 'Despesas fixas do mês', aba: 'gastos' },
  { id: 'importacoes', nome: 'Primeiro extrato ou lançamentos', aba: 'documentos' },
];
const feito = (v) => (typeof v === 'number' ? v > 0 : !!v);

function etapas(d) {
  const dd = d || {};
  const lista = ETAPAS.map((e) => ({ ...e, feito: feito(dd[e.id]) }));
  const prox = lista.find((e) => !e.feito);
  return { etapas: lista, proxima: prox ? prox.id : null, feitas: lista.filter((e) => e.feito).length, total: lista.length };
}

async function agirOnboarding(acao, body, c) {
  if (acao !== 'onboarding_status' && acao !== 'onboarding_pular') return null;
  const { base, listar } = c;
  const doc = async (col, id) => { const s = await base.collection(col).doc(id).get(); return s && s.exists ? s.data() || {} : null; };
  if (acao === 'onboarding_pular') { // etapa que não serve para a pessoa (ex.: não tem cartão) conta como feita
    if (!ETAPAS.some((e) => e.id === body.id)) return [400, { error: 'Etapa inválida.' }];
    const atual = (await doc('config', 'onboarding')) || {};
    const pulados = [...new Set([...(Array.isArray(atual.pulados) ? atual.pulados : []), body.id])];
    await base.collection('config').doc('onboarding').set({ pulados, atualizado_em: c.agoraIso });
    return [200, { ok: true, pulados }];
  }
  const [sal, car, orc, pagamentos, contas, cartoes, lancs, cfgOnb] = await Promise.all([doc('config', 'salario'), doc('config', 'carreira'), doc('orcamento', 'atual'),
    listar(base.collection('pagamentos')), listar(base.collection('contas')), listar(base.collection('cartoes')), listar(base.collection('lancamentos')), doc('config', 'onboarding')]);
  const pulou = new Set(cfgOnb && Array.isArray(cfgOnb.pulados) ? cfgOnb.pulados : []);
  const d = {
    salario: !!(sal && Object.keys(sal).length) || pagamentos.length > 0,
    jornada: !!(car && Object.keys(car).length),
    contas: contas.length,
    cartoes: cartoes.length,
    fixas: orc && Array.isArray(orc.fixas) ? orc.fixas.length : 0,
    importacoes: lancs.length,
  };
  for (const id of pulou) d[id] = true;
  return [200, etapas(d)];
}

module.exports = { etapas, agirOnboarding, ETAPAS };
