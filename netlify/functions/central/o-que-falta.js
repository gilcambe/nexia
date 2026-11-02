'use strict';
const github = require('./github');
const motivos = require('./motivos');

/**
 * Endpoint /api/central?parte=o-que-falta ou função chamada diretamente:
 * Busca issues abertas com labels cortex-urgente ou cortex-prioridade,
 * agrupa por issue mãe (label cortex-dividido) e suas partes (label cortex-parte).
 * 
 * Calcula o estado de cada parte:
 * - ✅ se issue/PR fechado ou PR merged nas últimas 72h
 * - 🤖 se tem label central/motivos.js indicando que está em fila/rodando/revisão
 * - 🙋 caso contrário (ex.: PR pendente de aprovação do dono ou issue com label vez-do-dono)
 * 
 * Retorna JSON estruturado:
 * [{ id, titulo, totalPartes, partesProntas, partes: [{ id, titulo, estado, motivo?, link? }] }]
 */
async function obterOQueFalta() {
  const ghClient = github.criarGithub();
  
  // Busca issues abertas com cortex-urgente ou cortex-prioridade, e também cortex-dividido ou cortex-parte para garantir completude
  let issues = [];
  try {
    const [urgentes, prioridades, divididas, partes] = await Promise.all([
      ghClient.api('/issues?state=open&labels=cortex-urgente&per_page=100').catch(() => []),
      ghClient.api('/issues?state=open&labels=cortex-prioridade&per_page=100').catch(() => []),
      ghClient.api('/issues?state=open&labels=cortex-dividido&per_page=100').catch(() => []),
      ghClient.api('/issues?state=open&labels=cortex-parte&per_page=100').catch(() => [])
    ]);

    const map = new Map();
    for (const i of [...urgentes, ...prioridades, ...divididas, ...partes]) {
      if (i && !i.pull_request) {
        map.set(i.number, i);
      }
    }
    issues = Array.from(map.values());
  } catch (e) {
    console.error('Erro ao buscar issues:', e);
    issues = [];
  }

  // Identifica issues mãe (cortex-dividido ou título contendo "[...]")
  const maes = issues.filter(i => {
    const labels = (i.labels || []).map(l => l.name || l);
    return labels.includes('cortex-dividido') || labels.includes('cortex-urgente') || labels.includes('cortex-prioridade');
  });

  // Identifica partes (cortex-parte)
  const todasPartes = issues.filter(i => {
    const labels = (i.labels || []).map(l => l.name || l);
    return labels.includes('cortex-parte');
  });

  const resultado = [];
  const agora = Date.now();
  const limite72h = 72 * 3600 * 1000;

  for (const mae of maes) {
    const labelsMae = (mae.labels || []).map(l => l.name || l);
    // Encontra partes relacionadas (por corpo, menção ou rótulos comuns)
    // Se a mãe tem partes filhas explícitas ou listadas no corpo/comentários, ou se agrupamos por critério
    const partesFilhas = todasPartes.filter(p => {
      // Verifica se a issue mãe referencia a parte ou vice-versa
      const corpo = (p.body || '');
      const tituloMae = mae.title || '';
      return corpo.includes(`#${mae.number}`) || tituloMae.includes(`[${mae.number}]`) || (p.milestone && mae.milestone && p.milestone.id === mae.milestone.id);
    });

    // Se não encontrou partes filhas diretas com cortex-parte, mas a mãe é urgente/prioritária, tratamos ela mesma ou procuramos issues na mesma faixa
    const listaPartes = partesFilhas.length > 0 ? partesFilhas : [mae];

    let partesProntas = 0;
    const partesFormatadas = listaPartes.map(p => {
      const labelsP = (p.labels || []).map(l => l.name || l);
      const fechado = p.state === 'closed';
      const atualizadorecente = p.closed_at && (agora - new Date(p.closed_at).getTime() < limite72h);
      
      let estado = '🙋';
      if (fechado || atualizadorecente) {
        estado = '✅';
        partesProntas++;
      } else {
        const motivoInfo = motivos.motivoDe(p);
        const emFilaOuRodando = ['rodando', 'jules', 'reserva', 'tentando', 'fila', 'urgente'].includes(motivoInfo.codigo);
        if (emFilaOuRodando || labelsP.some(l => l.includes('cortex-') || l.includes('mb-'))) {
          estado = '🤖';
        } else {
          estado = '🙋';
        }
      }

      const motivoObj = motivos.motivoDe(p);

      return {
        id: p.number,
        titulo: p.title,
        estado,
        motivo: motivoObj.text,
        link: p.html_url
      };
    });

    resultado.push({
      id: mae.number,
      titulo: mae.title,
      totalPartes: partesFormatadas.length,
      partesProntas,
      partes: partesFormatadas
    });
  }

  // Console.log de exemplo conforme solicitado
  console.log('O que falta estruturado:', JSON.stringify(resultado, null, 2));

  return resultado;
}

module.exports = { obterOQueFalta };
