'use strict';

/**
 * Módulo para gerar pedidos de lições após merge em develop.
 * Marca partes como "jules-feito" e limita a 3 lições por dia.
 */
const fs = require('fs');
const path = require('path');

// Caminho para o arquivo de contador de lições por dia
const LICTIONS_COUNTER_FILE = path.join(__dirname, '.licao-counter.json');

/**
 * Lê o contador de lições do dia atual.
 * @returns {Promise<number>} - Número de lições geradas hoje.
 */
async function getLicaoCountToday() {
  try {
    if (fs.existsSync(LICTIONS_COUNTER_FILE)) {
      const data = fs.readFileSync(LICTIONS_COUNTER_FILE, 'utf8');
      const counter = JSON.parse(data);
      // Atualiza para o dia atual se necessário
      const today = new Date().toISOString().split('T')[0];
      if (counter.date !== today) {
        counter.date = today;
        counter.count = 0;
        fs.writeFileSync(LICTIONS_COUNTER_FILE, JSON.stringify(counter));
      }
      return counter.count;
    }
    // Cria novo contador para hoje
    const today = new Date().toISOString().split('T')[0];
    const counter = { date: today, count: 0 };
    fs.writeFileSync(LICTIONS_COUNTER_FILE, JSON.stringify(counter));
    return 0;
  } catch (error) {
    console.error('Erro ao ler contador de lições:', error);
    return 0;
  }
}

/**
 * Incrementa o contador de lições do dia atual.
 */
async function incrementLicaoCount() {
  try {
    let counter;
    if (fs.existsSync(LICTIONS_COUNTER_FILE)) {
      const data = fs.readFileSync(LICTIONS_COUNTER_FILE, 'utf8');
      counter = JSON.parse(data);
    } else {
      const today = new Date().toISOString().split('T')[0];
      counter = { date: today, count: 0 };
    }
    counter.count += 1;
    fs.writeFileSync(LICTIONS_COUNTER_FILE, JSON.stringify(counter));
  } catch (error) {
    console.error('Erro ao incrementar contador de lições:', error);
  }
}

/**
 * Verifica se pode gerar mais lições hoje (máximo 3).
 * @returns {Promise<boolean>} - true se pode gerar mais lições.
 */
async function canGenerateLicao() {
  const count = await getLicaoCountToday();
  return count < 3;
}

/**
 * Marca partes do código como "jules-feito" após merge em develop.
 * @param {string} issue - O número da issue.
 * @param {object} pr - O objeto do Pull Request.
 * @returns {Promise<string|boolean>} - Mensagem de sucesso ou false se não pode gerar lição.
 */
async function montarPedidoLicao(issue, pr) {
  // Verifica se pode gerar mais lições hoje
  if (!await canGenerateLicao()) {
    console.log(`Máximo de 3 lições por dia atingido. Issue ${issue} ignorada.`);
    return false;
  }

  // Incrementa o contador
  await incrementLicaoCount();

  console.log(`Gerando pedido de lição para issue ${issue} (PR #${pr.number})`);
  console.log(`Lição ${await getLicaoCountToday()} de 3 por dia.`);

  // Retorna uma mensagem indicando que a lição foi gerada
  return `Lição gerada para issue ${issue} (PR #${pr.number})`;
}

module.exports = {
  montarPedidoLicao,
  getLicaoCountToday,
  incrementLicaoCount,
  canGenerateLicao,
};
