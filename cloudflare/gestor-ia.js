'use strict';

const { lerRegistro, escreverRegistro, itensPendentes } = require('../nexia-ai/passagem/registro.js');
const { registrarPassagem } = require('../nexia-ai/orchestrator/licoes.js');
const { getPlacar } = require('../nexia-ai/model-router/cota.js');

const LIMITE_PARADA_MS = 15 * 60 * 1000; // 15 minutos sem sinal
const MAX_ISSUES_RODADA = 10;
const REPO_PADRAO = 'gilcambe/nexia';

/**
 * Verifica se um registro de trabalho está parado.
 */
function estaParado(reg, agora = Date.now(), placarCota = null) {
  if (!reg || typeof reg !== 'object') return false;
  if (reg.estado !== 'trabalhando') return false;
  const pendentes = itensPendentes(reg);
  if (!pendentes.length) return false;

  // 1. Sem sinal há mais de 15 minutos
  const sinalMs = Date.parse(reg.sinal || 0);
  if (Number.isFinite(sinalMs) && (agora - sinalMs) >= LIMITE_PARADA_MS) {
    return { parado: true, motivo: 'sem sinal há mais de 15 min' };
  }

  // 2. Provedor/modelo sem cota no placar de cota
  if (placarCota && reg.quem) {
    if (placarCota.bloqueado(reg.quem) || placarCota.bloqueado({ provider: reg.quem })) {
      return { parado: true, motivo: 'provedor sem cota' };
    }
  }

  return { parado: false };
}

/**
 * Cria corpo da issue de continuação com marcador anti-duplicação.
 */
function gerarCorpoPassagem({ item, registro, regIssueNumber, feitos = [] }) {
  const indice = item.indice;
  const marcador = `<!-- passagem:${registro.repo || REPO_PADRAO}#${regIssueNumber}#${indice} -->`;
  const arquivosTexto = (item.arquivos && item.arquivos.length)
    ? `\n**Arquivos citados:**\n${item.arquivos.map(a => `- \`${a}\``).join('\n')}`
    : '';
  const feitosTexto = feitos.length
    ? `\n**Itens já concluídos:**\n${feitos.map(f => `- [x] ${f.t}`).join('\n')}`
    : '';

  return `${item.t}

**Origem:** Passagem automática de ${registro.quem || 'IA'} (${registro.onde || 'registro #' + regIssueNumber})
**Repositório:** ${registro.repo || REPO_PADRAO}
**Ramo base:** \`${registro.ramo || 'develop'}\`
${arquivosTexto}
${feitosTexto}

${marcador}`;
}

/**
 * Executa a detecção e passagem automática de tarefas paradas.
 */
async function processarPassagens({ gh, agora = Date.now(), placar = getPlacar() } = {}) {
  const out = { paradas: [], criadas: [], atualizados: [] };
  if (!gh) return out;

  // Busca issues com rótulo trabalho-ativo no nexia
  const issuesAtivas = await gh(`/repos/${REPO_PADRAO}/issues?state=open&labels=trabalho-ativo&per_page=50`).catch(() => []);
  if (!Array.isArray(issuesAtivas) || !issuesAtivas.length) return out;

  let totalCriadas = 0;

  for (const issue of issuesAtivas) {
    if (totalCriadas >= MAX_ISSUES_RODADA) break;
    const reg = lerRegistro(issue.body);
    if (!reg) continue;

    const status = estaParado(reg, agora, placar);
    if (!status.parado) continue;

    const pendentes = itensPendentes(reg);
    if (!pendentes.length) continue;

    out.paradas.push({ issue: issue.number, quem: reg.quem, motivo: status.motivo });

    const destinoRepo = reg.repo || REPO_PADRAO;
    const feitas = (reg.itens || []).filter(i => i && i.feito === true);

    // Lista issues abertas e recentes do repo destino para checar marcador anti-duplicação
    const issuesDestino = await gh(`/repos/${destinoRepo}/issues?state=all&per_page=100`).catch(() => []);
    const jaPassados = new Set();
    if (Array.isArray(issuesDestino)) {
      for (const d of issuesDestino) {
        const m = (d.body || '').match(/<!--\s*passagem:([^\s]+)\s*-->/);
        if (m) jaPassados.add(m[1]);
      }
    }

    const novasIssues = [];
    let falhas = 0; // issue que não abriu (ex.: sem acesso ao repo): o registro NÃO vira 'passado', a próxima rodada tenta de novo.
    for (const item of pendentes) {
      if (totalCriadas >= MAX_ISSUES_RODADA) break;
      const chaveMarcador = `${reg.repo || REPO_PADRAO}#${issue.number}#${item.indice}`;
      if (jaPassados.has(chaveMarcador)) continue;

      const corpoIssue = gerarCorpoPassagem({
        item,
        registro: reg,
        regIssueNumber: issue.number,
        feitos: feitas,
      });

      const rotuloAssumido = `assumido-de-${String(reg.quem || 'ia').toLowerCase().replace(/[^a-z0-9_-]/g, '')}`;
      const labels = ['cortex-fila', 'cortex-urgente', rotuloAssumido];

      const res = await gh(`/repos/${destinoRepo}/issues`, {
        method: 'POST',
        body: JSON.stringify({
          title: item.t,
          body: corpoIssue,
          labels,
        }),
      }).catch(err => {
        console.warn(`[gestor-ia] erro ao abrir issue no repo ${destinoRepo}:`, err && err.message);
        return null;
      });

      if (!res || !res.number) { falhas++; continue; }
      if (res && res.number) {
        novasIssues.push(res.number);
        jaPassados.add(chaveMarcador);
        totalCriadas++;
        out.criadas.push({ repo: destinoRepo, issue: res.number, de: issue.number, indice: item.indice });
      }
    }

    if (falhas) { out.paradas[out.paradas.length - 1].falhas = falhas; continue; }

    // Se passou itens ou todos já haviam sido passados, atualiza estado do registro para 'passado'
    const regAtualizado = { ...reg, estado: 'passado', atualizadoEm: new Date(agora).toISOString() };
    const novoCorpo = escreverRegistro(issue.body, regAtualizado);

    await gh(`/repos/${REPO_PADRAO}/issues/${issue.number}`, {
      method: 'PATCH',
      body: JSON.stringify({ body: novoCorpo }),
    }).catch(() => null);

    const horaSinal = reg.sinal ? new Date(reg.sinal).toISOString().slice(11, 16) : 'desconhecido';
    const listaTxt = novasIssues.length ? ` #${novasIssues.join(', #')}` : ' (já haviam sido enfileirados)';
    await gh(`/repos/${REPO_PADRAO}/issues/${issue.number}/comments`, {
      method: 'POST',
      body: JSON.stringify({
        body: `${reg.quem || 'A IA'} parou (sem sinal desde ${horaSinal} UTC). Passei ${novasIssues.length} itens para a fila:${listaTxt}.`,
      }),
    }).catch(() => null);

    registrarPassagem({
      data: new Date(agora).toISOString(),
      quem: reg.quem,
      motivo: status.motivo,
      para: `fila ${destinoRepo}`,
    });

    out.atualizados.push(issue.number);
  }

  return out;
}

module.exports = {
  LIMITE_PARADA_MS,
  MAX_ISSUES_RODADA,
  estaParado,
  gerarCorpoPassagem,
  processarPassagens,
};
