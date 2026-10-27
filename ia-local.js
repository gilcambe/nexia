/**
 * ia-local.js
 * Gerencia a configuração da IA local (localStorage), checa suporte a WebGPU,
 * faz o import dinâmico do WebLLM (@mlc-ai/web-llm via CDN jsdelivr) com os modelos
 * Qwen2.5-1.5B-Instruct-q4f16_1-MLC e Qwen2.5-0.5B-Instruct-q4f16_1-MLC,
 * com callbacks de progresso de download e inferência local com timeout de 20s.
 * 
 * Segurança: 
 * - Validação de integridade (hash SHA-256) do WebLLM do CDN antes de executar
 * - Modo estritamente offline quando o switch está ativo (sem fallback para nuvem)
 * - localStorage armazena apenas preferência de UI, não secrets
 */

const LOCAL_STORAGE_KEY = 'nexia_ia_local_config';

const MODELOS_SUPORTADOS = {
  GRANDE: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
  PEQUENO: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC'
};

const WEBLLM_CDN_URL = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.46/+esm';

let engineInstancia = null;
let modeloCarregado = null;

/**
 * Obtém as configurações salvas da IA local no localStorage.
 * @returns {Object} Configuração da IA local.
 */
export function obterConfig() {
  try {
    if (typeof localStorage === 'undefined') return { ativo: false, modelo: MODELOS_SUPORTADOS.PEQUENO };
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return { ativo: false, modelo: MODELOS_SUPORTADOS.PEQUENO };
    }
    const parsed = JSON.parse(raw);
    return {
      ativo: Boolean(parsed.ativo),
      modelo: parsed.modelo || MODELOS_SUPORTADOS.PEQUENO
    };
  } catch {
    return { ativo: false, modelo: MODELOS_SUPORTADOS.PEQUENO };
  }
}

/**
 * Salva as configurações da IA local no localStorage.
 * @param {Object} novaConfig - { ativo?: boolean, modelo?: string }
 * @returns {Object} Configuração atualizada.
 */
export function salvarConfig(novaConfig = {}) {
  const atual = obterConfig();
  const proxima = {
    ...atual,
    ...novaConfig
  };

  // Garante que o modelo salvo seja válido
  if (!Object.values(MODELOS_SUPORTADOS).includes(proxima.modelo)) {
    proxima.modelo = MODELOS_SUPORTADOS.PEQUENO;
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(proxima));
    }
  } catch (err) {
    console.warn('[ia-local] Não foi possível salvar configuração no localStorage:', err);
  }

  return proxima;
}

/**
 * Limpa as configurações salvas no localStorage.
 * 
 * Nota de segurança: localStorage armazena apenas preferência de UI (ativo/desativado),
 * não contém dados sensíveis ou secrets. Limpa ao desinstalar ou resetar configurações.
 */
export function limparConfig() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  } catch (err) {
    console.warn('[ia-local] Erro ao limpar localStorage:', err);
  }
}

/**
 * Verifica se o dispositivo/navegador possui suporte adequado a WebGPU e memória.
 * @returns {Promise<{suportado: boolean, motivo?: string, memoriaGb?: number}>}
 */
export async function verificarSuporteWebGPU() {
  if (typeof navigator === 'undefined') {
    return { suportado: false, motivo: 'Navegador não detectado (SSR ou ambiente Node).' };
  }

  if (!navigator.gpu) {
    return { suportado: false, motivo: 'Navegador não possui suporte a WebGPU (navigator.gpu indisponível).' };
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return { suportado: false, motivo: 'Dispositivo/GPU não disponibilizou um adaptador WebGPU.' };
    }
  } catch (err) {
    return { suportado: false, motivo: `Erro ao solicitar adaptador WebGPU: ${err?.message || err}` };
  }

  const memoriaGb = typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : 4;

  return {
    suportado: true,
    memoriaGb
  };
}

/**
 * Carrega dinamicamente a biblioteca WebLLM do CDN com validação de integridade.
 * @returns {Promise<Object>} Módulo do WebLLM.
 */
export async function carregarWebLLM() {
  try {
    // Validação de integridade (SHA-256) do WebLLM do CDN
    const response = await fetch(WEBLLM_CDN_URL, {
      headers: { 'Cache-Control': 'no-cache' }
    });

    if (!response.ok) {
      throw new Error(`Falha ao buscar WebLLM: ${response.status} ${response.statusText}`);
    }

    const content = await response.text();

    // Calcula hash SHA-256 real do conteúdo baixado
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const actualHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    const expectedHash = import.meta.env.VITE_WEBLLM_SHA256;

    if (!expectedHash) {
      throw new Error('VITE_WEBLLM_SHA256 não configurada. Não é permitido carregar WebLLM do CDN sem validação de integridade.');
    }

    if (actualHash !== expectedHash) {
      throw new Error('Hash do WebLLM inválido! O arquivo do CDN foi alterado ou corrompido.');
    }

    const module = await import(/* @vite-ignore */ WEBLLM_CDN_URL);
    return module;
  } catch (err) {
    throw new Error(`Falha ao carregar biblioteca WebLLM via CDN: ${err?.message || err}`);
  }
}

/**
 * Inicializa a Engine do WebLLM com o modelo desejado e callbacks de progresso.
 * @param {string} [nomeModelo] Nome do modelo WebLLM
 * @param {Function} [onProgress] Callback de progresso (report: { text: string, progress: number })
 * @returns {Promise<Object>} Instância do CreateMLCEngine
 */
export async function inicializarEngine(nomeModelo, onProgress) {
  const config = obterConfig();
  const modelo = nomeModelo || config.modelo || MODELOS_SUPORTADOS.PEQUENO;

  if (engineInstancia && modeloCarregado === modelo) {
    return engineInstancia;
  }

  const suporte = await verificarSuporteWebGPU();
  if (!suporte.suportado) {
    throw new Error(`WebGPU não suportado: ${suporte.motivo}`);
  }

  const webLLM = await carregarWebLLM();

  if (typeof webLLM.CreateMLCEngine !== 'function') {
    throw new Error('Módulo WebLLM carregado não exporta CreateMLCEngine.');
  }

  const initProgressCallback = (report) => {
    if (typeof onProgress === 'function') {
      onProgress(report);
    }
  };

  engineInstancia = await webLLM.CreateMLCEngine(modelo, {
    initProgressCallback
  });
  modeloCarregado = modelo;

  return engineInstancia;
}

/**
 * Executa um prompt na IA local com limite de tempo (timeout 20s).
 * Modo estritamente offline: quando o switch 'IA no meu aparelho' está ativo,
 * não envia prompts para a nuvem mesmo em caso de falha.
 * @param {string} prompt Texto ou mensagem do usuário
 * @param {Object} [opcoes] Opções da inferência
 * @param {number} [opcoes.timeoutMs=20000] Tempo máximo para execução local em ms
 * @param {Function} [opcoes.onProgress] Callback de progresso de download/carregamento
 * @param {string} [opcoes.modelo] Nome do modelo WebLLM
 * @returns {Promise<{resposta: string, origem: 'local', erro?: string}>}
 */
export async function executarPromptLocal(prompt, opcoes = {}) {
  const {
    timeoutMs = 20000,
    onProgress = null,
    modelo = null
  } = opcoes;

  const config = obterConfig();
  if (!config.ativo && !modelo) {
    return {
      resposta: '',
      origem: 'local',
      erro: 'IA local desativada na configuração'
    };
  }

  try {
    const suporte = await verificarSuporteWebGPU();
    if (!suporte.suportado) {
      return {
        resposta: '',
        origem: 'local',
        erro: suporte.motivo
      };
    }

    const execucaoPromise = (async () => {
      const engine = await inicializarEngine(modelo, onProgress);
      const messages = [
        { role: 'user', content: prompt }
      ];
      const reply = await engine.chat.completions.create({
        messages
      });
      return reply?.choices?.[0]?.message?.content || '';
    })();

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Timeout de inferência local excedido (${timeoutMs / 1000}s).`));
      }, timeoutMs);
    });

    const resposta = await Promise.race([execucaoPromise, timeoutPromise]);
    return {
      resposta,
      origem: 'local'
    };

  } catch (err) {
    return {
      resposta: '',
      origem: 'local',
      erro: err?.message || String(err)
    };
  }
}

/**
 * Executa um prompt na IA local com limite de tempo (timeout 20s) e fallback para nuvem.
 * @deprecated Use executarPromptLocal para modo estritamente offline.
 * @param {string} prompt Texto ou mensagem do usuário
 * @param {Object} [opcoes] Opções da inferência
 * @param {number} [opcoes.timeoutMs=20000] Tempo máximo para execução local em ms
 * @param {Function} [opcoes.fallbackNuvem] Função assíncrona de fallback para nuvem
 * @param {Function} [opcoes.onProgress] Callback de progresso de download/carregamento
 * @param {string} [opcoes.modelo] Nome do modelo WebLLM
 * @returns {Promise<{resposta: string, origem: 'local' | 'nuvem', erro?: string}>}
 */
export async function executarPromptComFallback(prompt, opcoes = {}) {
  const {
    timeoutMs = 20000,
    fallbackNuvem = null,
    onProgress = null,
    modelo = null
  } = opcoes;

  const chamarFallback = async (motivoErro) => {
    if (typeof fallbackNuvem === 'function') {
      try {
        const resNuvem = await fallbackNuvem(prompt);
        return {
          resposta: typeof resNuvem === 'string' ? resNuvem : resNuvem?.resposta || '',
          origem: 'nuvem'
        };
      } catch (errNuvem) {
        return {
          resposta: '',
          origem: 'nuvem',
          erro: `Falha no local (${motivoErro}) e falha no fallback de nuvem: ${errNuvem?.message || errNuvem}`
        };
      }
    }
    return {
      resposta: '',
      origem: 'local',
      erro: motivoErro
    };
  };

  const config = obterConfig();
  if (!config.ativo && !modelo) {
    return chamarFallback('IA local desativada na configuração');
  }

  // Modo estritamente offline: se o usuário ativou a opção "IA no meu aparelho",
  // não usar fallback para nuvem, mesmo em caso de falha
  if (config.ativo && !fallbackNuvem) {
    return executarPromptLocal(prompt, { timeoutMs, onProgress, modelo });
  }

  try {
    const suporte = await verificarSuporteWebGPU();
    if (!suporte.suportado) {
      return chamarFallback(suporte.motivo);
    }

    const execucaoPromise = (async () => {
      const engine = await inicializarEngine(modelo, onProgress);
      const messages = [
        { role: 'user', content: prompt }
      ];
      const reply = await engine.chat.completions.create({
        messages
      });
      return reply?.choices?.[0]?.message?.content || '';
    })();

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Timeout de inferência local excedido (${timeoutMs / 1000}s).`));
      }, timeoutMs);
    });

    const resposta = await Promise.race([execucaoPromise, timeoutPromise]);
    return {
      resposta,
      origem: 'local'
    };

  } catch (err) {
    return chamarFallback(err?.message || String(err));
  }
}

export { MODELOS_SUPORTADOS, WEBLLM_CDN_URL };
