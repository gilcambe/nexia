/**
 * Lições do Cortex em CommonJS
 * Implementação da classe LessonStore com persistência via módulo Cofre.
 * Sincronizado conforme pedido original. (Versão atualizada)
 */

const cofreInstance = require('./cofre');

class LessonStore {
  constructor() {
    this.lessons = [];
    this.avoidCounts = {};
    this.initializationPromise = this.loadInitialState();
  }

  async loadInitialState() {
    const savedLessons = await cofreInstance.recuperar('lessons');
    const savedAvoidCounts = await cofreInstance.recuperar('avoidCounts');
    if (savedLessons) this.lessons = savedLessons;
    if (savedAvoidCounts) this.avoidCounts = savedAvoidCounts;
    return true;
  }

  async ensureInitialized() {
    await this.initializationPromise;
  }

  async addLesson({ assinatura, causa, resolucao, issue }) {
    if (!assinatura || typeof assinatura !== 'string' || !assinatura.trim()) {
      throw new Error('Assinatura inválida');
    }
    await this.ensureInitialized();
    const lesson = { assinatura, causa, resolucao, issue, createdAt: new Date().toISOString() };
    this.lessons.push(lesson);
    
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
const lessonStore = new LessonStore();
module.exports = { LessonStore, lessonStore };
