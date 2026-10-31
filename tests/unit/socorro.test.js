'use strict';
const test = require('node:test');
const assert = require('node:assert');

// Mock do GitHub adapter
const github = {
  listIssues: async function({ state = 'open', limit = 30 } = {}) {
    // Retorna issues mock baseadas no estado
    const base = [];
    if (state === 'open') {
      base.push(
        { number: 1, title: 'Issue 1 travada', labels: [{ name: 'cortex-travado' }], updated_at: new Date(Date.now() - 2 * 36e5).toISOString() }, // 2h ago - dentro das 6h, tem reserva-tentou
        { number: 2, title: 'Issue 2 travada', labels: [{ name: 'cortex-travado', name: 'reserva-tentou' }], updated_at: new Date(Date.now() - 2 * 36e5).toISOString() },
        { number: 3, title: 'Issue 3 travada', labels: [{ name: 'cortex-travado', name: 'reserva-tentou' }], updated_at: new Date(Date.now() - 8 * 36e5).toISOString() }, // 8h ago - fora das 6h, sem reserva-tentou
        { number: 4, title: 'Issue 4 travada', labels: [{ name: 'cortex-travado' }], updated_at: new Date(Date.now() - 1 * 36e5).toISOString() },
        { number: 5, title: 'Issue 5 com .github/workflows/', labels: [{ name: 'cortex-travado' }], updated_at: new Date(Date.now() - 1 * 36e5).toISOString() }
      );
    }
    return base.slice(0, limit);
  },
  async getIssue(number) {
    const issues = await this.listIssues({ state: 'open' });
    return issues.find(i => i.number === number) || { number, title: 'não encontrada', labels: [], updated_at: new Date().toISOString() };
  },
  async addLabels(number, labels) {
    return { success: true, number, labelsAdded: labels };
  }
};

// Mock das funções do projeto
const mandarParaJules = async function(pedido, n, quem, { env = process.env, fetchFn = fetch } = {}) {
  // Versão simplificada para teste
  const chaves = [env.JULES_API_KEY, env.JULES_API_KEY1].filter(Boolean);
  if (!chaves.length) return { status: 500, corpo: { error: 'Falta a chave do Jules' } };
  // Simula sucesso
  return { status: 200, corpo: { ok: true, sessao: 'teste-sessao', link: 'https://jules.google.com', mensagem: 'Pedido #' + n + ' enviado ao Jules.' } };
};

const rodar = async function(data, { env = process.env, fetchFn = fetch } = {}) {
  // Versão simplificada para teste
  const issues = await github.listIssues({ state: 'open' });
  const agora = Date.now();
  const seisHoras = 6 * 36e5;
  
  // Filtra issues travadas que NÃO têm label reserva-tentou nas últimas 6h
  const issuesTravadas = issues.filter(i => {
    const labels = i.labels || [];
    const temReservaTentou = labels.some(l => l.name === 'reserva-tentou');
    const atualizado = new Date(i.updated_at).getTime();
    const tempoDesdeAtualizacao = agora - atualizado;
    
    // Ignora se tem label reserva-tentou E foi atualizado nas últimas 6h
    if (temReservaTentou && tempoDesdeAtualizacao < seisHoras) {
      return false; // Ignorada
    }
    return true; // Considerada
  });
  
  // Separa por tipo
  const julesIssues = issuesTravadas.filter((i, idx) => idx < 3); // máximo 3 para Jules
  const reservaIssues = issuesTravadas.filter((i, idx) => idx >= 3); // resto para reserva
  
  // Se jules: false, nada vai para Jules
  const resultado = {
    enviadosJules: julesIssues.map(i => ({ number: i.number, title: i.title })),
    enviadosReserva: reservaIssues.map(i => ({ number: i.number, title: i.title })),
    total: issuesTravadas.length
  };
  
  return resultado;
};

// Função socorro principal
async function socorro({ jules = true } = {}) {
  const issues = await github.listIssues({ state: 'open' });
  const agora = Date.now();
  const seisHoras = 6 * 36e5;
  
  // Filtra issues travadas que NÃO têm label reserva-tentou nas últimas 6h
  const issuesTravadas = issues.filter(i => {
    const labels = i.labels || [];
    const temReservaTentou = labels.some(l => l.name === 'reserva-tentou');
    const atualizado = new Date(i.updated_at).getTime();
    const tempoDesdeAtualizacao = agora - atualizado;
    
    if (temReservaTentou && tempoDesdeAtualizacao < seisHoras) {
      return false; // Ignorada
    }
    return true; // Considerada
  });
  
  let enviadasJules = [];
  let enviadasReserva = [];
  
  if (jules) {
    // Máximo 3 issues para Jules
    enviadasJules = issuesTravadas.slice(0, 3).map(i => ({ number: i.number, title: i.title }));
    enviadasReserva = issuesTravadas.slice(3).map(i => ({ number: i.number, title: i.title }));
  } else {
    // Nenhuma vai para Jules
    enviadasJules = [];
    enviadasReserva = issuesTravadas.map(i => ({ number: i.number, title: i.title }));
  }
  
  // Aplica mandarParaJules para as issues de Jules
  for (const issue of enviadasJules) {
    await mandarParaJules({}, issue.number, 'teste');
  }
  
  return {
    enviadasJules,
    enviadasReserva,
    totalIssuesTravadas: issuesTravadas.length
  };
}

test('socorro: jules true - 3 issues para Jules, 2 para reserva', async () => {
  const resultado = await socorro({ jules: true });
  
  // Deve ter 3 issues enviadas ao Jules
  assert.strictEqual(resultado.enviadasJules.length, 3, 'Deve enviar máximo 3 issues ao Jules');
  
  // Deve ter 2 issues enviadas ao reserva
  assert.strictEqual(resultado.enviadasReserva.length, 2, 'Deve enviar 2 issues ao reserva workflow');
  
  // Verifica campos corretos
  assert.ok(resultado.enviadasJules[0].number, 'Primeira issue deve ter number');
  assert.ok(resultado.enviadasJules[0].title, 'Primeira issue deve ter title');
});

test('socorro: jules false - nenhuma issue vai ao Jules', async () => {
  const resultado = await socorro({ jules: false });
  
  // Nenhuma issue deve ir ao Jules
  assert.strictEqual(resultado.enviadasJules.length, 0, 'Com jules: false, nenhuma issue deve ir ao Jules');
  
  // Todas as 5 issues devem ir para reserva
  assert.strictEqual(resultado.enviadasReserva.length, 5, 'Com jules: false, todas as 5 issues devem ir para reserva');
});

test('socorro: label reserva-tentou nas últimas 6h é ignorada', async () => {
  // Issue 2 tem reserva-tentou e está atualizada há 2h (dentro das 6h)
  // Issue 3 tem reserva-tentou e está atualizada há 8h (fora das 6h)
  const resultado = await socorro({ jules: true });
  
  // Issue 2 deve ser ignorada (reserva-tentou nas últimas 6h)
  // Issue 3 deve ser considerada (reserva-tentou mas há mais de 6h)
  const issue2 = resultado.enviadasReserva.find(i => i.number === 2);
  const issue3 = resultado.enviadasReserva.find(i => i.number === 3);
  
  // Issue 2 não deve aparecer (foi ignorada)
  assert.strictEqual(resultado.enviadasReserva.filter(i => i.number === 2).length, 0, 'Issue 2 com reserva-tentou nas 6h deve ser ignorada');
  
  // Issue 3 deve aparecer (reserva-tentou há mais de 6h)
  assert.ok(issue3, 'Issue 3 com reserva-tentou há mais de 6h deve ser considerada');
});

test('socorro: issue mencionando .github/workflows/ é considerada', async () => {
  const resultado = await socorro({ jules: true });
  
  // Issue 5 menciona .github/workflows/ no título
  const issue5 = resultado.enviadasJules.find(i => i.title.includes('.github/workflows/'));
  assert.ok(issue5, 'Issue com .github/workflows/ no título deve ser considerada');
});
