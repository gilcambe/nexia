import { WebLLM } from 'webllm';

class WebLLMChat {
  private model: WebLLM;

  constructor() {
    this.model = new WebLLM({
      model: 'gemma-2b-it',
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

export const webLLMChat = new WebLLMChat();
