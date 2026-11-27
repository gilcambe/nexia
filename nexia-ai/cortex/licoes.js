/**
 * Lições do Cortex em CommonJS
 * Implementação da classe LessonStore com persistência via módulo Cofre.
 */

const cofreInstance = require('./cofre');

class LessonStore {
  constructor() {
    this.lessons = [];
    this.avoidCounts = {};
    this.initializationPromise = this.loadInitialState();
  }

  async loadInitialState() {
    try {
      const savedLessons = await cofreInstance.recuperar('lessons');
      const savedAvoidCounts = await cofreInstance.recuperar('avoidCounts');
      if (Array.isArray(savedLessons)) this.lessons = savedLessons;
      if (savedAvoidCounts && typeof savedAvoidCounts === 'object' && !Array.isArray(savedAvoidCounts)) this.avoidCounts = savedAvoidCounts;
    } catch (err) {
      // Estado inicial seguro: mantém lessons/avoidCounts vazios se o Cofre tiver dado inválido.
      this.lessons = [];
      this.avoidCounts = {};
    }
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
    const safeLimit = parseInt(limit) || 3;
    // Similaridade por substring: a assinatura da lição contém (ou é contida por) a assinatura buscada,
    // ordenadas pela mais recente (createdAt desc) e limitadas ao solicitado.
    return this.lessons
      .filter(lesson => String(lesson.assinatura || '').includes(assinatura) || assinatura.includes(String(lesson.assinatura || '')))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      .slice(0, safeLimit);
  }

  async incrementAvoidCount(assinatura) {
    await this.ensureInitialized();
    this.avoidCounts[assinatura] = (this.avoidCounts[assinatura] || 0) + 1;

    // incrementAvoidCount atualiza apenas a contagem de evitações, não as lições em si.
    await cofreInstance.salvar('avoidCounts', this.avoidCounts);
    await cofreInstance.sincronizar();

    return this.avoidCounts[assinatura];
  }

  getRecentLessons(limit = 10) {
    const safeLimit = parseInt(limit) || 10;
    return this.lessons.slice(-safeLimit);
  }

  getAvoidCounts() {
    return { ...this.avoidCounts };
  }
}

/**
 * Instância exportada do LessonStore para gerenciamento de lições e persistência.
 */
const lessonStore = new LessonStore();
module.exports = { LessonStore };
module.exports.LessonStore = LessonStore;
module.exports.lessonStore = lessonStore;
