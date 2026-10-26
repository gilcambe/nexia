/**
 * lib/cortex-planos.js
 * Lógica de verificação de uso de créditos e limite diário do plano gratuito.
 * Exporta funções puras para uso em handlers e telas.
 */

// Planos disponíveis e seus limites de créditos.
const PLANOS = {
  gratuito: {
    nome: 'Gratuito',
    creditos: 10,          // créditos totais do plano grátis
    limiteDiario: 3,       // operações por dia no plano grátis
    valor: 'R$ 0,00',
  },
  basico: {
    nome: 'Básico',
    creditos: 50,
    limiteDiario: null,    // sem limite diário rígido
    valor: 'R$ 19,90',
  },
  pro: {
    nome: 'Pro',
    creditos: 200,
    limiteDiario: null,
    valor: 'R$ 49,90',
  },
};

const PLANO_PADRAO = 'gratuito';

/** Retorna a configuração de um plano (ou o gratuito se não existir). */
function obterPlano(plano) {
  return PLANOS[plano] || PLANOS[PLANO_PADRAO];
}

/**
 * Verifica se uma operação pode ser executada com base nos créditos.
 * @param {string} plano - nome do plano do usuário
 * @param {number} creditosUsados - créditos já consumidos no período
 * @param {number} creditosOperacao - créditos que a operação consome (padrão 1)
 * @returns {Object} { permitido, motivo, plano, aviso }
 */
function verificarCreditos(plano, creditosUsados, creditosOperacao = 1) {
  const config = obterPlano(plano);
  const disponiveis = config.creditos - creditosUsados;

  if (disponiveis < creditosOperacao) {
    return {
      permitido: false,
      motivo: 'creditos_esgotados',
      plano: config.nome,
      aviso: gerarAvisoLimite('Seus créditos acabaram. Você ainda pode fazer operações hoje, mas vai precisar mudar de plano para continuar sem limite.'),
    };
  }

  return { permitido: true, motivo: null, plano: config.nome, aviso: null };
}

/**
 * Verifica o limite diário do plano gratuito.
 * @param {string} plano - nome do plano
 * @param {number} usosHoje - operações já feitas hoje
 * @returns {Object} { permitido, motivo, aviso }
 */
function verificarLimiteDiario(plano, usosHoje) {
  const config = obterPlano(plano);

  if (plano === 'gratuito' && config.limiteDiario && usosHoje >= config.limiteDiario) {
    return {
      permitido: false,
      motivo: 'limite_diario',
      aviso: gerarAvisoLimite('Você atingiu o limite diário do plano gratuito (3 operações por dia). Volte amanhã ou mude de plano para continuar agora.'),
    };
  }

  return { permitido: true, motivo: null, aviso: null };
}

/**
 * Gera o aviso amigável com opção de mudar de plano.
 * @param {string} mensagem - texto do aviso
 * @returns {Object} { mensagem, botao, acao }
 */
function gerarAvisoLimite(mensagem) {
  return {
    mensagem,
    botao: 'Mudar de plano',
    acao: 'upgrade-plano',
  };
}

/**
 * Verifica tudo antes de uma operação: créditos e limite diário.
 * Retorna o primeiro bloqueio encontrado, ou { permitido: true }.
 * @param {Object} dados - { plano, creditosUsados, usosHoje, creditosOperacao }
 * @returns {Object}
 */
function verificarAntesDaOperacao({ plano = PLANO_PADRAO, creditosUsados = 0, usosHoje = 0, creditosOperacao = 1 } = {}) {
  // 1. Limite diário do plano gratuito (checa primeiro por ser mais restritivo)
  const diario = verificarLimiteDiario(plano, usosHoje);
  if (!diario.permitido) return diario;

  // 2. Créditos disponíveis
  const creditos = verificarCreditos(plano, creditosUsados, creditosOperacao);
  if (!creditos.permitido) return creditos;

  return { permitido: true };
}

module.exports = {
  PLANOS,
  PLANO_PADRAO,
  obterPlano,
  verificarCreditos,
  verificarLimiteDiario,
  gerarAvisoLimite,
  verificarAntesDaOperacao,
};
