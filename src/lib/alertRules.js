'use strict';
/**
 * Regras de alerta do Prumo / Kernex Finance:
 * - Queda ou alta > 3%
 * - Cotação perto do preço médio
 * - Provento decrescente
 * - Divergência com print
 */
function verificarQuedaAlta(ativo) {
  if (!ativo || typeof ativo.variacao_pct !== 'number') return null;
  if (ativo.variacao_pct > 3) return { tipo: 'alta_3', texto: `Ativo ${ativo.nome || ativo.ticker} teve alta superior a 3% (${ativo.variacao_pct}%).` };
  if (ativo.variacao_pct < -3) return { tipo: 'queda_3', texto: `Ativo ${ativo.nome || ativo.ticker} teve queda superior a 3% (${ativo.variacao_pct}%).` };
  return null;
}

function verificarPrecoMedio(ativo) {
  if (!ativo || typeof ativo.cotacao !== 'number' || typeof ativo.preco_medio !== 'number') return null;
  const diff = Math.abs(ativo.cotacao - ativo.preco_medio) / ativo.preco_medio;
  if (diff <= 0.01) {
    return { tipo: 'preco_medio', texto: `Ativo ${ativo.nome || ativo.ticker} está muito próximo do preço médio.` };
  }
  return null;
}

function verificarProventoDecrescente(historicoProventos) {
  if (!Array.isArray(historicoProventos) || historicoProventos.length < 2) return null;
  const ultimo = historicoProventos[historicoProventos.length - 1];
  const penultimo = historicoProventos[historicoProventos.length - 2];
  if (typeof ultimo === 'number' && typeof penultimo === 'number' && ultimo < penultimo) {
    return { tipo: 'provento_decrescente', texto: `Provento recente decrescente em relação ao anterior.` };
  }
  return null;
}

function verificarDivergenciaPrint(ativo, dadosPrint) {
  if (!ativo || !dadosPrint) return null;
  if (dadosPrint.cotacao && Math.abs(ativo.cotacao - dadosPrint.cotacao) > 0.01) {
    return { tipo: 'divergencia_print', texto: `Divergência detectada entre a cotação e o print enviado para ${ativo.nome || ativo.ticker}.` };
  }
  return null;
}

function avaliarAlertas(ativo, historicoProventos, dadosPrint) {
  const alertas = [];
  const qa = verificarQuedaAlta(ativo); if (qa) alertas.push(qa);
  const pm = verificarPrecoMedio(ativo); if (pm) alertas.push(pm);
  const pd = verificarProventoDecrescente(historicoProventos); if (pd) alertas.push(pd);
  const dp = verificarDivergenciaPrint(ativo, dadosPrint); if (dp) alertas.push(dp);
  return alertas;
}

module.exports = {
  verificarQuedaAlta,
  verificarPrecoMedio,
  verificarProventoDecrescente,
  verificarDivergenciaPrint,
  avaliarAlertas
};
