// #2856 (parte 4 de #2729) / #1823: "IA no meu aparelho" = WebLLM no navegador (WebGPU), grátis e sem gastar cota.
// Desligada por padrão. Liga no Cortex > Perguntar. Só responde perguntas curtas e simples; o resto (e qualquer erro)
// vai para a nuvem como sempre. O modelo baixa uma vez (~400 MB a 1 GB) e fica no cache do navegador.
// Ollama não entra aqui: ele roda no PC do dono, não no aparelho do cliente; o servidor já cai para as IAs grátis.

export const MODELOS = { leve: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC", normal: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC" } as const;
export const WEBLLM_URL = "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.46/+esm";
const CHAVE = "nexia_ia_local_config"; // mesma chave do ia-local.js antigo
const MAX_CARACTERES = 280;
const LIMITE_MS = 20000;

export interface ConfigAparelho { ativo: boolean; modelo: string }
type Motor = { chat: { completions: { create: (o: unknown) => Promise<{ choices?: { message?: { content?: string } }[] }> } } };

export function lerConfig(): ConfigAparelho {
  try {
    const o = JSON.parse(localStorage.getItem(CHAVE) || "{}");
    return { ativo: !!o.ativo, modelo: Object.values(MODELOS).includes(o.modelo) ? o.modelo : MODELOS.leve };
  } catch { return { ativo: false, modelo: MODELOS.leve }; }
}
export function salvarConfig(c: ConfigAparelho): void {
  try { localStorage.setItem(CHAVE, JSON.stringify(c)); } catch { /* modo privado: só nesta visita */ }
}

/** O aparelho aguenta? Precisa de WebGPU e (quando o navegador informa) 4 GB de memória. */
export async function suporte(nav: Partial<Navigator> & { gpu?: { requestAdapter: () => Promise<unknown> }; deviceMemory?: number } = navigator as never): Promise<{ ok: boolean; motivo?: string }> {
  if (!nav || !nav.gpu) return { ok: false, motivo: "Este navegador não tem WebGPU. Use o Chrome ou Edge atualizado." };
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory < 4) return { ok: false, motivo: "Este aparelho tem pouca memória (menos de 4 GB)." };
  try { return (await nav.gpu.requestAdapter()) ? { ok: true } : { ok: false, motivo: "A placa de vídeo não liberou o WebGPU." }; }
  catch { return { ok: false, motivo: "A placa de vídeo não liberou o WebGPU." }; }
}

/** Pergunta que o modelo pequeno dá conta: curta, sem código, sem anexos, sem pesquisa nem "pensar". */
export function perguntaSimples(texto: string, modo?: string): boolean {
  const t = (texto || "").trim();
  if (!t || t.length > MAX_CARACTERES) return false;
  if (modo && modo !== "rapido") return false;
  if (/```|\[anexo|https?:\/\//i.test(t)) return false;
  return true;
}

let motor: Motor | null = null;
let carregando: Promise<Motor> | null = null;
let modeloAtual = "";
export const pronto = () => !!motor;

/** Baixa e liga o modelo (só quando o dono liga a opção). onProgresso recebe 0 a 100. */
export function carregar(modelo: string, onProgresso?: (pct: number, texto: string) => void): Promise<Motor> {
  if (motor && modeloAtual === modelo) return Promise.resolve(motor);
  if (carregando && modeloAtual === modelo) return carregando;
  modeloAtual = modelo; motor = null;
  carregando = (async () => {
    const lib = await import(/* @vite-ignore */ WEBLLM_URL);
    const m = await lib.CreateMLCEngine(modelo, { initProgressCallback: (r: { progress?: number; text?: string }) => onProgresso?.(Math.round((r.progress || 0) * 100), r.text || "") });
    motor = m as Motor;
    return motor;
  })();
  carregando.catch(() => { carregando = null; modeloAtual = ""; });
  return carregando;
}

/** Responde no aparelho ou devolve null (aí vai para a nuvem). Nunca joga erro. */
export async function responderNoAparelho(texto: string, modo?: string, m: Motor | null = motor): Promise<string | null> {
  if (!m || !perguntaSimples(texto, modo)) return null;
  try {
    const r = await Promise.race([
      m.chat.completions.create({ messages: [{ role: "system", content: "Você é o Cortex da Kernex. Responda em português do Brasil, curto e claro." }, { role: "user", content: texto }], max_tokens: 400 }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("demorou")), LIMITE_MS)),
    ]);
    const s = (r && r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content || "").trim();
    return s || null;
  } catch { return null; }
}
