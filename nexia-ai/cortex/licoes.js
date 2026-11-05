/**
 * Lições do Cortex em CommonJS
 */


class LessonStore {
  constructor() {
    this.lessons = [];
    this.avoidCounts = {};
    try {
      const Cofre = require('./cofre.js');
      if (Cofre && typeof Cofre.recuperar === 'function') {
        const savedLessons = Cofre.recuperar('lessons');
        if (savedLessons) {
          this.lessons = savedLessons;
        }
        const savedCounts = Cofre.recuperar('avoidCounts');
        if (savedCounts) {
          this.avoidCounts = savedCounts;
        }
      }
    } catch (e) {
      // Ignorar
    }
  }

  async addLesson({ assinatura, causa, resolucao, issue }) {
    const lesson = { assinatura, causa, resolucao, issue, createdAt: new Date().toISOString() };
    this.lessons.push(lesson);
    this.avoidCounts[assinatura] = (this.avoidCounts[assinatura] || 0) + 1;
    const Cofre = require('./cofre.js');
    if (Cofre) {
      if (typeof Cofre.salvar === 'function') {
        await Cofre.salvar('lessons', this.lessons);
        await Cofre.salvar('avoidCounts', this.avoidCounts);
      }
      if (typeof Cofre.sincronizar === 'function') {
        await Cofre.sincronizar();
      }
    }
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
    const Cofre = require('./cofre.js');
    if (Cofre) {
      if (typeof Cofre.salvar === 'function') {
        await Cofre.salvar('avoidCounts', this.avoidCounts);
      }
      if (typeof Cofre.sincronizar === 'function') {
        await Cofre.sincronizar();
      }
    }
    return this.avoidCounts[assinatura];
  }

  getRecentLessons(limit = 10) {
    return this.lessons.slice(-limit);
  }

  getAvoidCounts() {
    return this.avoidCounts;
  }
}

module.exports = { LessonStore, lessonStore: new LessonStore(), LICOES, licoesParaPrompt };
