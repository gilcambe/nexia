const { encode } = require('gpt-3-encoder');

class TokenCounter {
  static countTokens(text) {
    return encode(text).length;
  }
}

module.exports = TokenCounter;