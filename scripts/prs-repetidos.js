// Script para gerenciar PRs repetidos do mesmo issue
// Agrupa PRs abertos de branch "nexia/" pelo número da issue e mantém apenas o mais recente com CI verde

// Função pura que decide quais PRs manter e quais fechar
function decidir(prs, agora) {
  // 1. Agrupa PRs abertos de branch "nexia/" pelo número da issue
  const prsNexia = prs.filter(pr => 
    pr.head && pr.head.ref && pr.head.ref.startsWith('nexia/') && 
    !pr.labels.some(l => ['dono-aprovou', 'revisao-manual', 'so-humano'].includes(l.name || l))
  );
  
  // Extrai números de issue dos títulos e corpos
  const extrairNumeroIssue = (text) => {
    const match = text.match(/#(\d+)/);
    return match ? parseInt(match[1]) : null;
  };
  
  // Agrupa por issue
  const grupos = {};
  prsNexia.forEach(pr => {
    const numeroIssue = extrairNumeroIssue(pr.title) || 
                         extrairNumeroIssue(pr.body) || 
                         extrairNumeroIssue(pr.title + '\n' + pr.body);
    
    if (numeroIssue) {
      if (!grupos[numeroIssue]) grupos[numeroIssue] = [];
      grupos[numeroIssue].push(pr);
    }
  });
  
  // Resultado
  const manter = [];
  const fechar = [];
  
  // Processa cada grupo
  Object.keys(grupos).forEach(numeroIssue => {
    const grupo = grupos[numeroIssue];
    
    // Filtra PRs válidos (exclui já fechados e sem issue)
    const prsValidos = grupo.filter(pr => pr.state === 'open');
    
    if (prsValidos.length <= 1) {
      // Só um PR ou nenhum, mantém
      manter.push(...prsValidos);
      return;
    }
    
    // Encontra o PR mais novo com CI verde
    const prsVerdes = prsValidos.filter(pr => 
      pr.status && pr.status.state === 'success' && 
      new Date(pr.updated_at || pr.created_at) > new Date(Date.now() - 48 * 60 * 60 * 1000)
    );
    
    // Ordena por data (mais recente primeiro)
    const ordenados = prsValidos.sort((a, b) => 
      new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
    );
    
    // Mantém o de CI verde mais novo, ou o mais novo se nenhum verde
    const manterPr = prsVerdes.length > 0 ? prsVerdes[0] : ordenados[0];
    manter.push(manterPr);
    
    // Fecha os outros (exceto o mantido)
    prsValidos.forEach(pr => {
      if (pr !== manterPr) {
        fechar.push({
          number: pr.number,
          issue: numeroIssue,
          motivo: `repetido de #${numeroIssue}`
        });
      }
    });
  });
  
  // 3. PR com CI vermelho há mais de 48 h cuja issue já está fechada: fecha com comentário
  // (essa verificação será feita externamente, pois precisa de informações de issues)
  
  // 4. Limita a 15 fechamentos por rodada
  const fecharLimitado = fechar.slice(0, 15);
  
  return {
    manter: manter.map(pr => pr.number),
    fechar: fecharLimitado,
    totalFechar: fechar.length,
    totalManter: manter.length
  };
}

// Função para rodar o processo
async function rodar({ env = process.env, fetchFn = fetch } = {}) {
  if (!env.GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN não configurado');
  }
  
  const REPO = '/repos/gilcambe/nexia';
  const headers = {
    'Authorization': `token ${env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json'
  };
  
  // Busca PRs abertos
  const prsResponse = await fetchFn(`${REPO}/pulls?state=open&per_page=100`, { headers });
  if (!prsResponse.ok) {
    throw new Error(`Falha ao buscar PRs: ${prsResponse.status}`);
  }
  
  const prs = await prsResponse.json();
  
  // Decide quais PRs manter e quais fechar
  const resultado = decidir(prs, Date.now());
  
  // Fecha PRs repetidos
  for (const pr of resultado.fechar) {
    try {
      // Adiciona comentário
      await fetchFn(`${REPO}/issues/${pr.number}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          body: `Fechado: ${pr.motivo} (fica o mais novo)`
        })
      });
      
      // Fecha o PR
      await fetchFn(`${REPO}/pulls/${pr.number}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ state: 'closed' })
      });
    } catch (error) {
      console.error(`Erro ao fechar PR #${pr.number}:`, error);
    }
  }
  
  return {
    manter: resultado.manter,
    fechar: resultado.fechar,
    totalFechar: resultado.totalFechar,
    totalManter: resultado.totalManter
  };
}

module.exports = { decidir, rodar };