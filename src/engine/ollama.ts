import { Ollama } from 'ollama';
import { webLLMEnabled } from '../config';
import { webLLMChat } from '../ui/webllm';

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
    if (webLLMEnabled) {
      try {
        const response = await webLLMChat.chat(prompt);
        return response;
      } catch (error) {
        console.error('WebLLM failed, falling back to Ollama:', error);
      }
    }
    const response = await this.model.chat(prompt);
    return response;
  }
}

export const ollamaEngine = new OllamaEngine();
