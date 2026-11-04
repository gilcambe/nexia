/**
 * Lições do Cortex em CommonJS
 */

const LICOES = [
  "modelos grátis ignoram especificação longa, quebre em passos pequenos",
  "use arquivos novos em vez de editar trechos",
  "sempre await em funções assíncronas",
  "não invente funções que não existem, leia o arquivo antes",
  "cite só caminhos que existem"
];

function licoesParaPrompt() {
  return LICOES.map((licao, index) => `${index + 1}. ${licao}`).join('\n');
}

class LessonStore {
  constructor() {
    this.lessons = [];
    this.avoidCounts = {};
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
