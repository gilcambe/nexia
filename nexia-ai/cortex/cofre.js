/**
 * Cofre para sincronizar dados
 */

class Cofre {
  constructor() {
    this.data = {};
  }

  async save(key, value) {
    this.data[key] = value;
    return true;
  }

  async get(key) {
    return this.data[key];
  }
}

module.exports = Cofre;
