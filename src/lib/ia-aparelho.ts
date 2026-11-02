// #2856 (parte 4 de #2729) / #1823: "IA no meu aparelho" = WebLLM no navegador (WebGPU), grátis e sem gastar cota.
// Desligada por padrão. Liga no Cortex > Perguntar. Só responde perguntas curtas e simples; o resto (e qualquer erro)
// vai para a nuvem como sempre. O modelo baixa uma vez (~400 MB a 1 GB) e fica no cache do navegador.
// Ollama não entra aqui: ele roda no PC do dono, não no aparelho do cliente; o servidor já cai para as IAs grátis.

export const MODELOS = { leve: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC", normal: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC" } as const;
// 0.2.46 não conhecia os modelos Qwen2.5 (o download falhava no celular do dono, 02/11). 0.2.82 conhece os dois.
export const WEBLLM_URL = "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.82/+esm";
// De onde a IA baixa: pesos no Hugging Face, programa (wasm) no GitHub. Conferimos antes para dizer qual site falhou.
export const HOSTS = { pesos: "huggingface.co", programa: "raw.githubusercontent.com" } as const;
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

/** Muitos celulares Android não têm "shader-f16": aí usa a versão q4f32 do mesmo modelo. */
export function modeloParaGpu(modelo: string, temF16: boolean): string {
  return temF16 ? modelo : modelo.replace("q4f16_1", "q4f32_1");
}
let gpuTemF16 = true;

/** Erro do WebLLM em palavras simples, com o detalhe técnico curto no fim. */
export function motivoErro(e: unknown): string {
  const m = String((e as { message?: string })?.message || e || "").slice(0, 160);
  if (/not found|model.*list|appConfig/i.test(m)) return `modelo não encontrado (${m})`;
  if (/não conseguiu abrir|respondeu erro/.test(m)) return m;
  if (/fetch|network|Failed to load|import/i.test(m)) return `falha na internet ao baixar (${m})`;
  if (/quota|storage|cache/i.test(m)) return `sem espaço no navegador para guardar a IA (${m})`;
  if (/device|adapter|gpu|shader|lost/i.test(m)) return `a placa de vídeo recusou (${m})`;
  return m || "erro desconhecido";
}

/** O aparelho aguenta? Precisa de WebGPU e (quando o navegador informa) 4 GB de memória. */
export async function suporte(nav: Partial<Navigator> & { gpu?: { requestAdapter: () => Promise<unknown> }; deviceMemory?: number } = navigator as never): Promise<{ ok: boolean; motivo?: string }> {
  if (!nav || !nav.gpu) return { ok: false, motivo: "Este navegador não tem WebGPU. Use o Chrome ou Edge atualizado." };
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory < 4) return { ok: false, motivo: "Este aparelho tem pouca memória (menos de 4 GB)." };
  try {
    const ad = (await nav.gpu.requestAdapter()) as { features?: { has?: (f: string) => boolean } } | null;
    if (!ad) return { ok: false, motivo: "A placa de vídeo não liberou o WebGPU." };
    gpuTemF16 = !!(ad.features && typeof ad.features.has === "function" && ad.features.has("shader-f16"));
    return { ok: true };
  }
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

type Registro = { model_id: string; model: string; model_lib: string };
type Lib = { CreateMLCEngine: (id: string, o: unknown) => Promise<unknown>; prebuiltAppConfig: { model_list: Registro[] } & Record<string, unknown> };

/** Testa os dois sites antes de baixar. Devolve null se ok, ou o motivo em palavras simples. */
export async function testarSites(r: Registro, f: typeof fetch = fetch): Promise<string | null> {
  const base = r.model.replace(/\/+$/, "");
  try { const x = await f(`${base}/resolve/main/mlc-chat-config.json`, { cache: "no-store" }); if (!x.ok) return `o site ${HOSTS.pesos} respondeu erro ${x.status}`; }
  catch { return `o aparelho não conseguiu abrir ${HOSTS.pesos} (onde fica a IA). Abra huggingface.co no navegador para ver se a internet ou um bloqueador impede`; }
  try { const x = await f(r.model_lib, { method: "HEAD", cache: "no-store" }); if (!x.ok) return `o site ${HOSTS.programa} respondeu erro ${x.status}`; }
  catch { return `o aparelho não conseguiu abrir ${HOSTS.programa}`; }
  return null;
}

/** Baixa e liga o modelo (só quando o dono liga a opção). onProgresso recebe 0 a 100.
 *  1ª tentativa guarda no Cache do navegador; se der "Failed to fetch", tenta de novo guardando no IndexedDB
 *  (alguns Chrome de Android falham no Cache com arquivo grande). */
export function carregar(modelo: string, onProgresso?: (pct: number, texto: string) => void): Promise<Motor> {
  if (motor && modeloAtual === modelo) return Promise.resolve(motor);
  if (carregando && modeloAtual === modelo) return carregando;
  modeloAtual = modelo; motor = null;
  carregando = (async () => {
    const lib = (await import(/* @vite-ignore */ WEBLLM_URL)) as Lib;
    const id = modeloParaGpu(modelo, gpuTemF16);
    const reg = lib.prebuiltAppConfig.model_list.find((x) => x.model_id === id);
    if (!reg) throw new Error(`model ${id} not found in appConfig`);
    const ruim = await testarSites(reg);
    if (ruim) throw new Error(ruim);
    const progresso = (r: { progress?: number; text?: string }) => onProgresso?.(Math.round((r.progress || 0) * 100), r.text || "");
    try {
      motor = (await lib.CreateMLCEngine(id, { initProgressCallback: progresso })) as Motor;
    } catch (e) {
      if (!/fetch|network|cache/i.test(String((e as Error)?.message || e))) throw e;
      motor = (await lib.CreateMLCEngine(id, { initProgressCallback: progresso, appConfig: { ...lib.prebuiltAppConfig, useIndexedDBCache: true } })) as Motor;
    }
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
