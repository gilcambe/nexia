const tokenCounter = require('../../utils/tokenCounter');
const summary = require('../../utils/summary');

class ContextManager {
  constructor(maxTokens) {
    this.maxTokens = maxTokens;
  }

  async manageContext(context) {
    let currentTokens = await tokenCounter.countTokens(context);

    while (currentTokens > this.maxTokens) {
      context = await summary.summarize(context);
      currentTokens = await tokenCounter.countTokens(context);
    }

    return context;
  }
}

module.exports = ContextManager;