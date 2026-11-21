/**
 * Lições do Cortex em CommonJS
 * Classe LessonStore implementada para persistência via Cofre
 */

const cofreInstance = require('./cofre.js');

class LessonStore {
  constructor() {
    this.lessons = [];
    this.avoidCounts = {};
    this.initialized = this.loadInitialState();
  }

  async loadInitialState() {
    this.lessons = (await cofreInstance.recuperar('lessons')) || [];
    this.avoidCounts = (await cofreInstance.recuperar('avoidCounts')) || {};
    return true;
  }

  async ensureInitialized() {
    await this.initialized;
  }

  async addLesson({ assinatura, causa, resolucao, issue }) {
    await this.ensureInitialized();
    const lesson = { assinatura, causa, resolucao, issue, createdAt: new Date().toISOString() };
    this.lessons.push(lesson);
    
    // O pedido solicita persistir tanto as 'lessons' quanto os 'avoidCounts' atualizados
    // Embora o incrementAvoidCount não seja chamado aqui, garantimos a consistência inicial
    // caso necessário no futuro. O método abaixo já salva ambos.
    await cofreInstance.salvar('lessons', this.lessons);
    await cofreInstance.salvar('avoidCounts', this.avoidCounts);
    await cofreInstance.sincronizar();

    return lesson;
  }

  getSimilarLessons(assinatura, limit = 3) {
    if (!assinatura || typeof assinatura !== 'string' || !assinatura.trim()) {
      return [];
    }
    return this.lessons
      .filter(lesson => lesson.assinatura && lesson.assinatura.includes(assinatura))
      .slice(0, limit);
  }

  async incrementAvoidCount(assinatura) {
    await this.ensureInitialized();
    this.avoidCounts[assinatura] = (this.avoidCounts[assinatura] || 0) + 1;

    await cofreInstance.salvar('avoidCounts', this.avoidCounts);
    await cofreInstance.sincronizar();

    return this.avoidCounts[assinatura];
  }

  getRecentLessons(limit = 10) {
    return this.lessons.slice(-limit);
  }

  getAvoidCounts() {
    return this.avoidCounts;
  }
}

/**
 * Instância exportada do LessonStore para gerenciamento de lições e persistência.
 */
module.exports = { LessonStore, lessonStore: new LessonStore() };
