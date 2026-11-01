import { Ollama } from 'ollama';

class OllamaEngine {
  private model: Ollama;

  constructor() {
    this.model = new Ollama({
      model: 'ollama',
      threads: 4,
      useSIMD: true,
    });
  }

  async init() {
    await this.model.init();
  }

  async chat(prompt: string): Promise<string> {
    const response = await this.model.chat(prompt);
    return response;
  }
}

export const ollamaEngine = new OllamaEngine();
