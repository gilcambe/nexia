/**
 * Cofre para sincronizar dados em memória
 */

class Cofre {
  constructor() {
    // Inicializa os dados em memória. Se houver dados salvos no escopo global, carrega-os.
    this.data = (typeof globalThis !== 'undefined' && globalThis.__nexia_cofre_data)
      ? JSON.parse(JSON.stringify(globalThis.__nexia_cofre_data)) // Clonagem profunda para evitar referências
      : {};
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
    // A sincronização real ocorreria aqui, talvez com um serviço externo ou um mecanismo mais robusto.
    // Por enquanto, apenas garante que os dados em memória estão atualizados.
    await this.salvarTodos();
    return true;
  }

  async salvarTodos() {
    // Persistência real em memória/cache sincronizada
    if (typeof globalThis !== 'undefined') {
      globalThis.__nexia_cofre_data = JSON.parse(JSON.stringify(this.data)); // Clonagem profunda
    }
    return true;
  }
}

// Exportar instância única do Cofre
module.exports = new Cofre();
