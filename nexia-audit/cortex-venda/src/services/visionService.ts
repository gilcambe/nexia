// Serviço de visão: processa imagem via Workers AI (binding AI) com fallback Gemini
// Modelo gratuito: @cf/llama-3.2-11b-vision-instruct (ou similar)
// Fallback: API gratuita do Gemini (gemini-1.5-flash)

interface VisionOptions {
  imageBase64: string;
  prompt?: string;
  model?: string;
  env?: any;
}

interface VisionResult {
  description: string;
  provider: 'workers-ai' | 'gemini';
  model: string;
}

interface WorkersAIResponse {
  description?: string;
  answer?: string;
}

const WORKERS_AI_MODEL = '@cf/llama-3.2-11b-vision-instruct';
const GEMINI_MODEL = 'gemini-1.5-flash';

function getApiKey(env?: any): string | undefined {
  return env?.GEMINI_API_KEY;
}

const DEFAULT_PROMPT =
  'Descreva o que aparece nesta imagem de forma objetiva e direta, em português, frases curtas.';

function isBase64Image(value: string): boolean {
  return /^data:image\/(jpeg|jpg|png|gif|webp);base64,[a-zA-Z0-9+/=]+$/.test(value);
}

function stripDataUrl(imageBase64: string): { data: string; mimeType: string } {
  const match = imageBase64.match(/^data:image\/([a-zA-Z]+);base64,/);
  const mimeType = match ? `image/${match[1]}` : 'image/jpeg';
  const data = imageBase64.replace(/^data:image\/[^;]+;base64,/, '');
  return { data, mimeType };
}

async function callWorkersAI(
  imageBase64: string,
  prompt: string,
  ai: any,
  model: string
): Promise<{ description: string; model: string }> {
  if (!ai || !ai.run) {
    throw new Error('Binding AI não disponível no ambiente Workers');
  }

  const cleanImage = stripDataUrl(imageBase64);

  const response = await ai.run(model, {
    image: cleanImage.data,
    prompt,
  });

  const description = (response as any)?.description || (response as any)?.answer || String(response);

  return { description, model };
}

async function callGemini(imageBase64: string, prompt: string, env?: any): Promise<{ description: string; model: string }> {
  const apiKey = getApiKey(env);
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY não configurada');
  }

  const { data: cleanImage, mimeType } = stripDataUrl(imageBase64);

  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: cleanImage,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 512,
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Gemini falhou (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  const description =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    String(data);

  return { description, model: GEMINI_MODEL };
}

/**
 * Processa uma imagem em base64 e retorna uma descrição.
 * Tenta Workers AI primeiro; em caso de falha, cai no Gemini.
 */
export async function describeImage(options: VisionOptions, ai?: any): Promise<VisionResult> {
  const imageBase64 = options.imageBase64;
  const prompt = options.prompt || DEFAULT_PROMPT;
  const model = options.model || WORKERS_AI_MODEL;
  const env = options.env;

  if (!imageBase64 || !isBase64Image(imageBase64)) {
    throw new Error('Imagem inválida: envie base64 ou data URL de imagem');
  }

  let lastError: Error | null = null;

  // 1) Workers AI (binding AI) — modelo gratuito com visão
  try {
    const result = await callWorkersAI(imageBase64, prompt, ai, model);
    return {
      description: result.description,
      provider: 'workers-ai',
      model: result.model,
    };
  } catch (err) {
    lastError = err as Error;
    // segue para fallback
  }

  // 2) Fallback: Gemini gratuito
  try {
    const result = await callGemini(imageBase64, prompt, env);
    return {
      description: result.description,
      provider: 'gemini',
      model: result.model,
    };
  } catch (err) {
    lastError = err as Error;
  }

  throw new Error(
    `Falha ao descrever imagem. Workers AI: ${lastError?.message ?? 'indisponível'}`
  );
}

/* Atalhos para uso direto na cadeia de troca de modelos do Cortex */
export { WORKERS_AI_MODEL, GEMINI_MODEL };
export default { describeImage };
