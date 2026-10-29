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

/**
 * Cria e renderiza o switch de IA local na página.
 * @param {HTMLElement} container - Elemento HTML onde o switch será inserido
 * @param {Function} onChange - Callback chamado quando o switch é alterado
 */
export function renderizarSwitchIaLocal(container, onChange) {
  if (!container) return;
  
  // Verifica suporte a WebGPU
  verificarSuporteWebGPU().then(suporte => {
    const switchContainer = document.createElement('div');
    switchContainer.className = 'ia-local-switch-container';
    switchContainer.style.cssText = `
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 16px;
      margin: 16px 0;
    `;
    
    const switchLabel = document.createElement('label');
    switchLabel.className = 'ia-local-switch-label';
    switchLabel.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      user-select: none;
    `;
    
    const switchTitle = document.createElement('div');
    switchTitle.innerHTML = `
      <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">IA no meu aparelho</div>
      <div style="font-size: 12px; color: rgba(255, 255, 255, 0.7);">Grátis, offline e sem conexão com a nuvem</div>
    `;
    
    const switchWrapper = document.createElement('div');
    switchWrapper.className = 'switch-wrapper';
    switchWrapper.style.cssText = `
      position: relative;
      width: 48px;
      height: 24px;
      background: ${suporte.suportado ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 107, 107, 0.2)'};
      border-radius: 12px;
      transition: background 0.3s;
    `;
    
    const switchSlider = document.createElement('div');
    switchSlider.className = 'switch-slider';
    switchSlider.style.cssText = `
      position: absolute;
      top: 2px;
      left: ${suporte.suportado ? '2px' : 'calc(100% - 22px)'};
      width: 20px;
      height: 20px;
      background: ${suporte.suportado ? '#fff' : '#ff6b6b'};
      border-radius: 50%;
      transition: transform 0.3s;
    `;
    
    const switchInput = document.createElement('input');
    switchInput.type = 'checkbox';
    switchInput.className = 'ia-local-switch';
    switchInput.disabled = !suporte.suportado;
    switchInput.checked = obterConfig().ativo;
    switchInput.style.cssText = `
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
    `;
    
    switchWrapper.appendChild(switchSlider);
    switchLabel.appendChild(switchTitle);
    switchLabel.appendChild(switchWrapper);
    switchContainer.appendChild(switchLabel);
    switchContainer.appendChild(switchInput);
    
    // Adiciona aviso se não suportado
    if (!suporte.suportado) {
      const aviso = document.createElement('div');
      aviso.className = 'ia-local-aviso';
      aviso.style.cssText = `
        margin-top: 8px;
        padding: 8px 12px;
        background: rgba(255, 107, 107, 0.1);
        border: 1px solid rgba(255, 107, 107, 0.3);
        border-radius: 8px;
        font-size: 12px;
        color: #ff6b6b;
      `;
      aviso.textContent = `❌ Bloqueado: ${suporte.motivo}`;
      switchContainer.appendChild(aviso);
    }
    
    // Adiciona container de aviso de download
    const avisoDownload = document.createElement('div');
    avisoDownload.className = 'ia-local-aviso-download';
    avisoDownload.style.cssText = `
      margin-top: 8px;
      padding: 12px;
      background: rgba(230, 162, 60, 0.1);
      border: 1px solid rgba(230, 162, 60, 0.3);
      border-radius: 8px;
      font-size: 12px;
      color: #e6a23c;
      display: none;
    `;
    avisoDownload.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 4px;">⚠ Download necessário</div>
      <div style="margin-bottom: 8px;">Será baixado aproximadamente 1 GB de dados para o modelo de IA local. Recomendado Wi-Fi.</div>
      <button id="btn-confirmar-download" style="
        background: #e6a23c;
        color: #000;
        border: none;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      ">Confirmar download</button>
    `;
    switchContainer.appendChild(avisoDownload);
    
    container.appendChild(switchContainer);
    
    // Event listener para o switch
    switchInput.addEventListener('change', (e) => {
      if (!suporte.suportado) return;
      
      const ativo = e.target.checked;
      
      if (ativo) {
        // Mostra aviso de download
        avisoDownload.style.display = 'block';
      } else {
        // Esconde aviso e desativa
        avisoDownload.style.display = 'none';
        salvarConfig({ ativo: false });
        if (onChange) onChange(false);
      }
    });
    
    // Event listener para botão de confirmação
    const btnConfirmar = avisoDownload.querySelector('#btn-confirmar-download');
    if (btnConfirmar) {
      btnConfirmar.addEventListener('click', () => {
        salvarConfig({ ativo: true });
        avisoDownload.style.display = 'none';
        if (onChange) onChange(true);
      });
    }
  });
}

export { MODELOS_SUPORTADOS, WEBLLM_CDN_URL };
