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

export async function chatWithWebLLM(prompt: string): Promise<{ response: string; engine: string }> {
  try {
    await webLLMChat.init();
    return { response: await webLLMChat.chat(prompt), engine: 'WebLLM' };
  } catch (error) {
    console.error('WebLLM initialization failed:', error);
    throw error;
  }
}

export async function chatWithFallback(prompt: string): Promise<{ response: string; engine: string }> {
  try {
    const response = await webLLMChat.chat(prompt);
    return { response, engine: 'WebLLM' };
  } catch (error) {
    console.error('WebLLM failed, falling back to Ollama:', error);
    if (config.fallbackToOllama) {
      const ollamaResponse = await ollamaEngine.chat(prompt);
      return { response: ollamaResponse, engine: 'Ollama' };
    }
    throw error;
  }
}
export async function chatWithFallback(prompt: string): Promise<{ response: string; engine: string }> {
  try {
    const response = await webLLMChat.chat(prompt);
    return { response, engine: 'WebLLM' };
  } catch (error) {
    console.error('WebLLM failed, falling back to Ollama:', error);
    if (config.fallbackToOllama) {
      const ollamaResponse = await ollamaEngine.chat(prompt);
      return { response: ollamaResponse, engine: 'Ollama' };
    }
    throw error;
  }
}
  try {
    const response = await webLLMChat.chat(prompt);
    return { response, engine: 'WebLLM' };
  } catch (error) {
    console.error('WebLLM failed, falling back to Ollama:', error);
    if (config.fallbackToOllama) {
      const ollamaResponse = await ollamaEngine.chat(prompt);
      return { response: ollamaResponse, engine: 'Ollama' };
    }
    throw error;
  }
}
