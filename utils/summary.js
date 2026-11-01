const { encode } = require('gpt-3-encoder');
const { Configuration, OpenAIApi } = require('openai');

class Summary {
  static async summarize(text) {
    // Configuração do cliente OpenAI
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);

    // Chamada ao modelo para gerar um resumo
    const response = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt: `Resuma o seguinte texto mantendo os pontos principais:\n\n${text}`,
      max_tokens: 150,
      temperature: 0.7,
    });

    return response.data.choices[0].text.trim();
  }
}

module.exports = Summary;
