'use strict';
/**
 * VazaoController: Contador de uso por banco (leituras e escritas do dia) e gerenciador
 * de rodízio preventivo do cofre (B -> C -> D1 -> CofreSql) ao atingir 70% da cota.
 */

const BANK_LIMITS = {
  'firestore-default': { reads: 50000, writes: 20000, warnThreshold: 0.7 },
  'firestore-b': { reads: 50000, writes: 20000, warnThreshold: 0.7 },
  'firestore-c': { reads: 50000, writes: 20000, warnThreshold: 0.7 },
  'd1': { reads: 5000000, writes: 100000, warnThreshold: 0.7 },
  'cofresql': { reads: 50000000, writes: 10000000, warnThreshold: 0.7 }
};

const BANK_ROTATION = ['firestore-default', 'firestore-b', 'firestore-c', 'd1', 'cofresql'];

class VazaoController {
  constructor() {
    this.usage = {}; // { [banco]: { [dataYYYYMMDD]: { leituras: 0, escritas: 0 } } }
    this.currentIndex = 0;
    this.quaseCheioFlags = {}; // { [banco]: boolean }
  }

  _getHoje() {
    return new Date().toISOString().slice(0, 10);
  }

  registrarUso(bancoKey, leiturasIncrement = 0, escritasIncrement = 0) {
    const banco = bancoKey || BANK_ROTATION[this.currentIndex] || 'firestore-default';
    const hoje = this._getHoje();
    if (!this.usage[banco]) this.usage[banco] = {};
    if (!this.usage[banco][hoje]) this.usage[banco][hoje] = { leituras: 0, escritas: 0 };

    this.usage[banco][hoje].leituras += Number(leiturasIncrement) || 0;
    this.usage[banco][hoje].escritas += Number(escritasIncrement) || 0;

    const stats = this.usage[banco][hoje];
    const limits = BANK_LIMITS[banco] || BANK_LIMITS['firestore-default'];

    const pctL = stats.leituras / limits.reads;
    const pctE = stats.escritas / limits.writes;

    if (pctL >= limits.warnThreshold || pctE >= limits.warnThreshold) {
      if (!this.quaseCheioFlags[banco]) {
        this.quaseCheioFlags[banco] = true;
        this._dispararAvisoSentinel(banco, stats.leituras, stats.escritas, limits);
        this.switchToNextBank();
      }
    }

    return stats;
  }

  getUso(bancoKey) {
    const banco = bancoKey || BANK_ROTATION[this.currentIndex];
    const hoje = this._getHoje();
    return (this.usage[banco] && this.usage[banco][hoje]) || { leituras: 0, escritas: 0 };
  }

  getUsoTodos() {
    const hoje = this._getHoje();
    const resultado = {};
    for (const b of BANK_ROTATION) {
      resultado[b] = (this.usage[b] && this.usage[b][hoje]) || { leituras: 0, escritas: 0 };
    }
    return resultado;
  }

  getNextBank() {
    return BANK_ROTATION[this.currentIndex];
  }

  switchToNextBank() {
    this.currentIndex = (this.currentIndex + 1) % BANK_ROTATION.length;
    const novoBanco = BANK_ROTATION[this.currentIndex];
    console.log(`[VAULT ROTATION] Tráfego alternado preventivamente para o banco: ${novoBanco}`);
    return novoBanco;
  }

  _dispararAvisoSentinel(banco, leituras, escritas, limits) {
    try {
      const alerta = {
        tipo: 'sentinel',
        label: 'sentinel',
        banco,
        leituras,
        escritas,
        limiteLeituras: limits.reads,
        limiteEscritas: limits.writes,
        percentualLeituras: Number(((leituras / limits.reads) * 100).toFixed(1)),
        percentualEscritas: Number(((escritas / limits.writes) * 100).toFixed(1)),
        timestamp: new Date().toISOString(),
        acao: 'alternar_tráfego_preventivo_cofre',
        passoAPasso: [
          `1. O banco ${banco} atingiu o limite preventivo de 70% da cota gratuita.`,
          `2. O sistema acionou automaticamente o rodízio para o próximo banco (${BANK_ROTATION[(this.currentIndex + 1) % BANK_ROTATION.length]}).`,
          `3. Verifique o consumo detalhado na Central (aba Sistema/Cofre) e valide a integridade dos dados.`
        ]
      };
      console.warn(`[SENTINEL ALERT] [sentinel] Banco ${banco} atingiu 70% da cota!`);
      console.log('[SENTINEL CENTRAL ALARM] [sentinel]', JSON.stringify(alerta));
    } catch (e) {
      console.error('Erro ao disparar aviso sentinel:', e);
    }
  }
}

const globalVazaoController = new VazaoController();

module.exports = {
  VazaoController,
  globalVazaoController,
  BANK_LIMITS,
  BANK_ROTATION
};
