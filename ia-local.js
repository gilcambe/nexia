/**
 * ia-local.js
 * Gerencia a configuração da IA local (localStorage), checa suporte a WebGPU,
 * faz o import dinâmico do WebLLM (@mlc-ai/web-llm via CDN jsdelivr) com os modelos
 * Qwen2.5-1.5B-Instruct-q4f16_1-MLC e Qwen2.5-0.5B-Instruct-q4f16_1-MLC,
 * com callbacks de progresso de download e inferência local com timeout de 20s
 * e fallback transparente para a nuvem.
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
 * Carrega dinamicamente a biblioteca WebLLM do CDN.
 * @returns {Promise<Object>} Módulo do WebLLM.
 */
export async function carregarWebLLM() {
  try {
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
 * Executa um prompt na IA local com limite de tempo (timeout 20s) e fallback para nuvem.
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

/**
 * Função utilitária de UI para gerenciar o switch de IA no meu aparelho (grátis, offline)
 * nas configurações. Verifica suporte a WebGPU, exibe aviso de bloqueio se não suportado,
 * e exibe aviso de download de ~1 GB com recomendação de Wi-Fi ao ligar.
 * 
 * @param {HTMLInputElement} checkboxElement O elemento input do switch
 * @param {HTMLElement} [containerAvisoElement] Elemento opcional para exibir mensagens/avisos
 * @returns {Promise<boolean>} Retorna o novo estado ativo do switch
 */
export async function configurarSwitchIALocal(checkboxElement, containerAvisoElement) {
  if (!checkboxElement) return false;

  const configAtual = obterConfig();
  checkboxElement.checked = configAtual.ativo;

  checkboxElement.onchange = async (e) => {
    const ativar = checkboxElement.checked;

    if (!ativar) {
      salvarConfig({ ativo: false });
      if (containerAvisoElement) {
        containerAvisoElement.textContent = 'IA local desativada.';
        containerAvisoElement.className = 'msg aviso';
        containerAvisoElement.style.display = 'block';
      }
      return;
    }

    // Ao tentar ligar, verifica suporte a WebGPU
    checkboxElement.checked = false; // reverte temporariamente até confirmar suporte
    if (containerAvisoElement) {
      containerAvisoElement.textContent = 'Verificando suporte a WebGPU no aparelho...';
      containerAvisoElement.className = 'msg aviso';
      containerAvisoElement.style.display = 'block';
    }

    const suporte = await verificarSuporteWebGPU();

    if (!suporte.suportado) {
      checkboxElement.checked = false;
      salvarConfig({ ativo: false });
      if (containerAvisoElement) {
        containerAvisoElement.textContent = `Aviso de bloqueio: Seu navegador ou dispositivo não suporta IA local offline. (${suporte.motivo})`;
        containerAvisoElement.className = 'msg erro';
        containerAvisoElement.style.display = 'block';
      }
      return;
    }

    // Suportado: exibe aviso de download de ~1 GB com recomendação de Wi-Fi
    const confirmarDownload = window.confirm(
      'Aviso: Ativar a "IA no meu aparelho (grátis, offline)" fará o download de aproximadamente 1 GB de dados do modelo de IA. Recomendamos fortemente o uso de uma rede Wi-Fi estável.\n\nDeseja continuar e ativar a IA local?'
    );

    if (!confirmarDownload) {
      checkboxElement.checked = false;
      salvarConfig({ ativo: false });
      if (containerAvisoElement) {
        containerAvisoElement.textContent = 'Ativação cancelada pelo usuário.';
        containerAvisoElement.className = 'msg aviso';
        containerAvisoElement.style.display = 'block';
      }
      return;
    }

    // Confirmado e suportado
    checkboxElement.checked = true;
    salvarConfig({ ativo: true });
    if (containerAvisoElement) {
      containerAvisoElement.textContent = 'IA no meu aparelho ativada com sucesso! O modelo (~1 GB) será baixado sob demanda ao iniciar o uso.';
      containerAvisoElement.className = 'msg ok';
      containerAvisoElement.style.display = 'block';
    }
  };

  return configAtual.ativo;
}

export { MODELOS_SUPORTADOS, WEBLLM_CDN_URL };
