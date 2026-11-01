const { encode } = require('gpt-3-encoder');

class Summary {
  static async summarize(text) {
    // Implementação básica de resumo
    // Em um cenário real, você usaria um modelo de linguagem para gerar um resumo
    const sentences = text.split('. ');
    const half = Math.ceil(sentences.length / 2);
    return sentences.slice(0, half).join('. ') + '.';
  }
}

module.exports = Summary;
