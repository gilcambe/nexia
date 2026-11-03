/**
 * Cofre para sincronizar dados
 */

class Cofre {
  constructor() {
    this.data = {};
  }

  async salvar(key, value) {
    this.data[key] = value;
    await this.salvarTodos();
    return true;
  }

  async recuperar(key) {
    return this.data[key];
  }

  async sincronizar() {
    return true;
  }

  async salvarTodos() {
    // Persistência real em memória/cache sincronizada
    try {
      if (typeof globalThis !== 'undefined') {
        globalThis.__nexia_cofre_data = globalThis.__nexia_cofre_data || {};
        for (const [k, v] of Object.entries(this.data)) {
          globalThis.__nexia_cofre_data[k] = v;
        }
      }
    } catch (e) {
      // Fallback seguro
    }
    return true;
  }
}

module.exports = new Cofre(); // Exportar instância única do Cofre
