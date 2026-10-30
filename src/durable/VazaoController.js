'use strict';
// #2221: Contador de uso por banco, trocas preventivas (70%), cache em memória no Vault e testes.

class VazaoController {
  constructor() {
    this.usoDiario = new Map(); // banco -> { data, leituras, escritas }
  }

  registrar(banco, leituras = 0, escritas = 0) {
    const hoje = new Date().toISOString().slice(0, 10);
    const key = banco || 'default';
    let entry = this.usoDiario.get(key);
    if (!entry || entry.data !== hoje) {
      entry = { data: hoje, leituras: 0, escritas: 0 };
      this.usoDiario.set(key, entry);
    }
    entry.leituras += leituras;
    entry.escritas += escritas;
    return entry;
  }

  obter(banco) {
    const key = banco || 'default';
    const hoje = new Date().toISOString().slice(0, 10);
    const entry = this.usoDiario.get(key);
    if (!entry || entry.data !== hoje) return { data: hoje, leituras: 0, escritas: 0 };
    return { ...entry };
  }

  verificarLimite(banco) {
    const u = this.obter(banco);
    const maxL = /firestore/i.test(banco) ? 50000 : 5000000;
    const maxE = /firestore/i.test(banco) ? 20000 : 100000;
    const quaseCheio = u.leituras >= maxL * 0.7 || u.escritas >= maxE * 0.7;
    return { quaseCheio, ...u, maxL, maxE };
  }
}

module.exports = { VazaoController };
