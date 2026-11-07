/**
 * Lições do Cortex em CommonJS
 */

const cofreInstance = require('./cofre.js');

class LessonStore {
  constructor() {
    this.lessons = [];
    this.avoidCounts = {};
    const savedLessons = cofreInstance.recuperar('lessons');
    if (savedLessons && typeof savedLessons.then === 'function') {
      // se for async/promessa, não faremos await no construtor (construtor síncrono)
    }
    // Como a recuperação no cofre é síncrona nos dados em memória ou tratada, vamos garantir atribuição segura
    if (savedLessons && !savedLessons.then) {
      this.lessons = savedLessons;
    }
    const savedCounts = cofreInstance.recuperar('avoidCounts');
    if (savedCounts && !savedCounts.then) {
      this.avoidCounts = savedCounts;
    }
  }

  async addLesson({ assinatura, causa, resolucao, issue }) {
    const lesson = { assinatura, causa, resolucao, issue, createdAt: new Date().toISOString() };
    this.lessons.push(lesson);
    this.avoidCounts[assinatura] = (this.avoidCounts[assinatura] || 0) + 1;

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

module.exports = { LessonStore };
