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

  addLesson({ assinatura, causa, resolucao, issue }) {
    const lesson = { assinatura, causa, resolucao, issue };
    this.lessons.push(lesson);
    this.avoidCounts[assinatura] = (this.avoidCounts[assinatura] || 0) + 1;
    // Sincronizar com Cofre
    const Cofre = require('./cofre.js');
    Cofre.salvar('lessons', this.lessons);
    Cofre.salvar('avoidCounts', this.avoidCounts);
    return lesson;
  }

  getSimilarLessons(assinatura, limit = 3) {
    return this.lessons
      .filter(lesson => lesson.assinatura.includes(assinatura))
      .slice(0, limit);
  }

  incrementAvoidCount(assinatura) {
    this.avoidCounts[assinatura] = (this.avoidCounts[assinatura] || 0) + 1;
    // Sincronizar com Cofre
    const Cofre = require('./cofre.js');
    Cofre.salvar('avoidCounts', this.avoidCounts);
    return this.avoidCounts[assinatura];
  }

  getRecentLessons(limit = 10) {
    return this.lessons.slice(-limit);
  }

  getAvoidCounts() {
    return this.avoidCounts;
  }
}

const lessonStore = new LessonStore();

module.exports = {
  LICOES,
  licoesParaPrompt,
  LessonStore: lessonStore
};
