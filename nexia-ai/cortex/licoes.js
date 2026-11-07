/**
 * Lições do Cortex em CommonJS
 */

// Importa a classe Cofre do módulo cofre.js
const Cofre = require('./cofre.js');
const cofreInstance = new Cofre();

class LessonStore {
  constructor() {
    this.lessons = [];
    this.avoidCounts = {};
    // Carrega dados do Cofre ao inicializar
    const savedLessons = cofreInstance.recuperar('lessons');
    if (savedLessons) {
      this.lessons = savedLessons;
    }
    const savedCounts = cofreInstance.recuperar('avoidCounts');
    if (savedCounts) {
      this.avoidCounts = savedCounts;
    }
  }

  async addLesson({ assinatura, causa, resolucao, issue }) {
    const lesson = { assinatura, causa, resolucao, issue, createdAt: new Date().toISOString() };
    this.lessons.push(lesson);
    this.avoidCounts[assinatura] = (this.avoidCounts[assinatura] || 0) + 1;

    // Salva no Cofre
    await cofreInstance.salvar('lessons', this.lessons);
    await cofreInstance.salvar('avoidCounts', this.avoidCounts);
    await cofreInstance.sincronizar(); // Garante que os dados estão sincronizados

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
    this.avoidCounts[assinatura] = (this.avoidCounts[assinatura] || 0) + 1;

    // Salva no Cofre
    await cofreInstance.salvar('avoidCounts', this.avoidCounts);
    await cofreInstance.sincronizar(); // Garante que os dados estão sincronizados

    return this.avoidCounts[assinatura];
  }

  getRecentLessons(limit = 10) {
    return this.lessons.slice(-limit);
  }

  getAvoidCounts() {
    return this.avoidCounts;
  }
}

// Exporta a instância da LessonStore já configurada com o Cofre
const lessonStore = new LessonStore();
module.exports = { LessonStore, lessonStore };
