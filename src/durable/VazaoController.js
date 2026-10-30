'use strict';
// #2221: Contador de uso por banco, trocas preventivas (70%), cache em memória no Vault e testes.

class VazaoController {
  constructor() {
    this.usoDiario = new Map(); // banco -> { data, leituras, escritas }
    this.bancos = ['firestore-b', 'firestore-c', 'd1', 'cofresql'];
    this.bancoAtualIndex = 0;
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

  obter(banco) {
    const key = banco || this.bancos[this.bancoAtualIndex];
    const hoje = new Date().toISOString().slice(0, 10);
    const entry = this.usoDiario.get(key);
    if (!entry || entry.data !== hoje) return { data: hoje, leituras: 0, escritas: 0, status: 'ativo' };
    return { ...entry };
  }

  verificarLimite(banco) {
    const key = banco || this.bancos[this.bancoAtualIndex];
    const u = this.obter(key);
    const isD1 = key === 'd1';
    const isCofre = key === 'cofresql';
    const maxL = isD1 ? 5000000 : (isCofre ? 50000000 : 50000);
    const maxE = isD1 ? 100000 : (isCofre ? 10000000 : 20000);
    const quaseCheio = u.leituras >= maxL * 0.7 || u.escritas >= maxE * 0.7;
    return { quaseCheio, ...u, maxL, maxE, status: quaseCheio ? 'quase cheio' : (u.status || 'ativo') };
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
}

module.exports = { VazaoController };
