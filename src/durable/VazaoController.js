'use strict';
// #2221: Contador de uso por banco, trocas preventivas (70%), cache em memória no Vault e testes.

class VazaoController {
  constructor(state) {
    this.usoDiarioBancos = new Map(); // banco -> { data, leituras, escritas, status, limiteLeituras, limiteEscritas }
    this.bancoAtual = 'firestore-b';
    this.ordemBancos = ['firestore-b', 'firestore-c', 'd1', 'cofresql'];
    this.BANK_LIMITS = {
      'firestore-b': { reads: 50000, writes: 20000, warnThreshold: 0.7 },
      'firestore-c': { reads: 50000, writes: 20000, warnThreshold: 0.7 },
      'd1': { reads: 5000000, writes: 100000, warnThreshold: 0.7 },
      'cofresql': { reads: 50000000, writes: 10000000, warnThreshold: 0.7 },
    };
    if (state?.storage?.sql) {
      this.sql = state.storage.sql;
    }
  }
  
  getBancoAtivo() {
    return this.bancoAtual;
  }
  
  getNextBank() {
    const i = this.ordemBancos.indexOf(this.bancoAtual);
    if (i >= 0 && i < this.ordemBancos.length - 1) {
      return this.ordemBancos[i + 1];
    }
    return this.ordemBancos[this.ordemBancos.length - 1];
  }
  
  switchToNextBank() {
    const i = this.ordemBancos.indexOf(this.bancoAtual);
    const prox = i >= 0 && i < this.ordemBancos.length - 1 ? this.ordemBancos[i + 1] : this.ordemBancos[this.ordemBancos.length - 1];
    if (prox !== this.bancoAtual) {
      this.bancoAtual = prox;
      return prox;
    }
    return this.bancoAtual;
  }

  registrar(banco, leituras = 0, escritas = 0) {
    const hoje = new Date().toISOString().slice(0, 10);
    const key = banco || this.bancos[this.bancoAtualIndex];
    let entry = this.usoDiario.get(key);
    if (!entry || entry.data !== hoje) {
      entry = { data: hoje, leituras: 0, escritas: 0, status: 'ativo' };
      this.usoDiario.set(key, entry);
    }
    entry.leituras += leituras;
    entry.escritas += escritas;

    const limite = this.verificarLimite(key);
    if (limite.quaseCheio) {
      entry.status = 'quase cheio';
      this.proximoBanco();
    }
    return entry;
  }

  verificarLimite(banco) {
    const key = banco || this.bancos[this.bancoAtualIndex];
    const u = this.obterContador(key);
    const isD1 = key === 'd1';
    const isCofre = key === 'cofresql';
    const isFs = /firestore/.test(key);
    const maxL = isD1 ? 5000000 : (isCofre ? 50000000 : isFs ? 50000 : 50000);
    const maxE = isD1 ? 100000 : (isCofre ? 10000000 : isFs ? 20000 : 20000);
    const quaseCheio = u.leituras >= maxL * 0.7 || u.escritas >= maxE * 0.7;
    return { quaseCheio, leituras: u.leituras, escritas: u.escritas, maxL, maxE, status: u.status || 'ativo' };
  }

  obterContador(banco) {
    const key = banco || this.bancos[this.bancoAtualIndex];
    const hoje = new Date().toISOString().slice(0, 10);
    const entry = this.usoDiario.get(key);
    if (!entry || entry.data !== hoje) return { leituras: 0, escritas: 0, status: 'ativo' };
    return { leituras: entry.leituras, escritas: entry.escritas, status: entry.status || 'ativo' };
  }

  proximoBanco() {
    this.bancoAtualIndex = (this.bancoAtualIndex + 1) % this.bancos.length;
    return this.bancos[this.bancoAtualIndex];
  }

  obterBancoAtual() {
    return this.bancos[this.bancoAtualIndex];
  }

  obterResumoGeral() {
    const resumo = {};
    for (const b of this.bancos) {
      resumo[b] = this.verificarLimite(b);
    }
    return resumo;
  }

  /**
   * Obtém o uso diário de um banco específico.
   * @param {string} banco - Nome do banco
   * @returns {Object} { data, leituras, escritas, status }
   */
  obterUsoDiario(banco) {
    const key = banco || this.obterBancoAtual();
    const hoje = new Date().toISOString().slice(0, 10);
    const entry = this.usoDiario.get(key);
    if (!entry || entry.data !== hoje) {
      return { data: hoje, leituras: 0, escritas: 0, status: 'ativo' };
    }
    return { data: entry.data, leituras: entry.leituras, escritas: entry.escritas, status: entry.status || 'ativo' };
  }

  /**
   * Obtém o uso diário de todos os bancos.
   * @returns {Object[]} Lista de { banco, data, leituras, escritas, status, limiteLeituras, limiteEscritas }
   */
  obterUsoTodosBancos() {
    const res = [];
    for (const b of this.bancos) {
      const u = this.obterUsoDiario(b);
      const limite = this.verificarLimite(b);
      res.push({
        banco: b,
        data: u.data,
        leituras: u.leituras,
        escritas: u.escritas,
        status: u.status || 'ativo',
        limiteLeituras: limite.maxL,
        limiteEscritas: limite.maxE,
        percentualLeituras: limite.maxL ? Number(((u.leituras / limite.maxL) * 100).toFixed(1)) : 0,
        percentualEscritas: limite.maxE ? Number(((u.escritas / limite.maxE) * 100).toFixed(1)) : 0
      });
    }
    return res;
  }

  /**
   * Verifica se algum banco está quase cheio (>= 70%) e retorna o banco para troca.
   * @returns {Object|null} { bancoCheio, proximoBanco, alerta } ou null se nenhum banco estiver quase cheio
   */
  checarBancosQuaseCheios() {
    for (const b of this.bancos) {
      const u = this.obterUsoDiario(b);
      const limite = this.verificarLimite(b);
      if (limite.quaseCheio) {
        const proximo = this.proximoBanco();
        return {
          bancoCheio: b,
          proximoBanco: proximo,
          alerta: {
            tipo: 'sentinel',
            banco: b,
            leituras: u.leituras,
            escritas: u.escritas,
            limiteLeituras: limite.maxL,
            limiteEscritas: limite.maxE,
            percentualLeituras: limite.maxL ? Number(((u.leituras / limite.maxL) * 100).toFixed(1)) : 0,
            percentualEscritas: limite.maxE ? Number(((u.escritas / limite.maxE) * 100).toFixed(1)) : 0,
            timestamp: new Date().toISOString(),
            acao: 'alternar_tráfego_preventivo',
            passoAPasso: [
              `1. Banco ${b} atingiu o limite preventivo de 70% da cota.`,
              `2. O Vault ativou automaticamente o rodízio para o próximo banco disponível.`,
              `3. Verifique o consumo na Central e valide a integridade dos dados.`
            ]
          }
        };
      }
    }
    return null;
  }
}



module.exports = { VazaoController };
