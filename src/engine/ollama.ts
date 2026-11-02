import { Ollama } from 'ollama';
import { config } from '../config';
import { chatWithWebLLM } from '../ui/webllm';

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

  async chat(prompt: string): Promise<{ response: string; engine: string }> {
    if (config.useWebLLM) {
      try {
        const response = await chatWithWebLLM(prompt);
        return response;
      } catch (error) {
        console.error('WebLLM failed, falling back to Ollama:', error);
        if (config.fallbackToOllama) {
          const response = await this.model.chat(prompt);
          return { response, engine: 'Ollama' };
        }
        throw error;
      }
    } else {
      const response = await this.model.chat(prompt);
      return { response, engine: 'Ollama' };
    }
  }
}

export const ollamaEngine = new OllamaEngine();
