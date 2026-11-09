'use strict';

const { lerRegistro, itensPendentes } = require('../../../nexia-ai/passagem/registro.js');
const { estaParado } = require('../../../cloudflare/gestor-ia.js');

/**
 * Formata quanto tempo se passou em minutos a partir de um ISO timestamp.
 */
function minutosAtras(iso, agora = Date.now()) {
  const ms = Date.parse(iso || 0);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.round((agora - ms) / 60000));
}

/**
 * Obtém o status de quem está trabalhando baseado nas issues com label `trabalho-ativo`.
 */
async function obterQuemTrabalha({ gh, agora = Date.now(), placar = null } = {}) {
  if (!gh) return { itens: [] };

  const issues = await gh('/repos/gilcambe/nexia/issues?state=open&labels=trabalho-ativo&per_page=50').catch(() => []);
  if (!Array.isArray(issues)) return { itens: [] };

  const itens = [];

  for (const issue of issues) {
    const reg = lerRegistro(issue.body);
    if (!reg) continue;

    const mins = minutosAtras(reg.sinal, agora);
    const pendentes = itensPendentes(reg);
    const par = estaParado(reg, agora, placar);

    let status = 'trabalhando';
    let motivo = null;
    let detalhes = `sinal há ${mins != null ? mins + ' min' : 'tempo desconhecido'}`;

    if (reg.estado === 'passado') {
      status = 'assumido';
      detalhes = `${reg.quem || 'IA'} parou → passado para Cortex/IAs grátis`;
    } else if (par.parado) {
      status = 'parou';
      motivo = par.motivo;
      detalhes = `parou há ${mins != null ? mins + ' min' : ''} (${motivo})`;
    }

    itens.push({
      issue: issue.number,
      quem: reg.quem || 'IA',
      onde: reg.onde || issue.title,
      repo: reg.repo || 'gilcambe/nexia',
      ramo: reg.ramo,
      sinal: reg.sinal,
      minutosSinal: mins,
      status, // 'trabalhando' | 'parou' | 'assumido'
      motivo,
      detalhes,
      pendentesCount: pendentes.length,
      totalCount: Array.isArray(reg.itens) ? reg.itens.length : 0,
    });
  }

  return { itens };
}

module.exports = {
  obterQuemTrabalha,
  minutosAtras,
};
