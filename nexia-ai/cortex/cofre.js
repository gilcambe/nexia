/**
 * Cofre para sincronizar dados
 */

class Cofre {
  constructor() {
    this.data = {};
  }

  async salvar(key, value) {
    this.data[key] = value;
    return true;
  }

  async recuperar(key) {
    return this.data[key];
  }

  async recuperar(key) {
    return this.data[key];
  }
}

module.exports = Cofre;
