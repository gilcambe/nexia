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
 * Renderiza o bloco de configurações da IA local com o switch e avisos.
 * @param {HTMLElement|string} containerElement Elemento ou ID do container onde injetar o switch
 */
export async function renderizarConfiguracaoIALocal(containerElement) {
  const container = typeof containerElement === 'string' 
    ? document.getElementById(containerElement) 
    : containerElement;

  if (!container) return;

  const config = obterConfig();
  const suporte = await verificarSuporteWebGPU();

  container.innerHTML = `
    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 18px; margin: 12px 0; font-family: inherit;">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
        <div>
          <h4 style="font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
            <i class="ri-cpu-line" style="color: #00e5ff;"></i> IA no meu aparelho (grátis, offline)
          </h4>
          <p style="font-size: 12px; color: rgba(255,255,255,0.7); line-height: 1.4; margin: 0;">
            Execute modelos de IA diretamente no seu dispositivo usando WebGPU, sem enviar dados para a nuvem.
          </p>
        </div>
        <label style="position: relative; display: inline-block; width: 50px; height: 26px; flex-shrink: 0; cursor: ${suporte.suportado ? 'pointer' : 'not-allowed'};">
          <input type="checkbox" id="chk-ia-local" ${config.ativo ? 'checked' : ''} ${!suporte.suportado ? 'disabled' : ''} style="opacity: 0; width: 0; height: 0;">
          <span style="position: absolute; cursor: ${suporte.suportado ? 'pointer' : 'not-allowed'}; inset: 0; background-color: ${suporte.suportado ? (config.ativo ? '#00e5ff' : 'rgba(255,255,255,0.2)') : 'rgba(255,255,255,0.1)'}; transition: .3s; border-radius: 34px;" id="slider-ia-local"></span>
          <span style="position: absolute; content: ''; height: 20px; width: 20px; left: ${config.ativo && suporte.suportado ? '26px' : '3px'}; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%;" id="knob-ia-local"></span>
        </label>
      </div>

      <div id="aviso-suporte-ia" style="margin-top: 12px; font-size: 12px; display: ${suporte.suportado ? 'none' : 'block'}; background: rgba(255,61,113,0.15); border: 1px solid rgba(255,61,113,0.3); border-radius: 8px; padding: 10px; color: #ff3d71;">
        <strong>⚠️ Aparelho não compatível:</strong> ${suporte.motivo || 'WebGPU não suportado neste navegador ou dispositivo.'}
      </div>

      <div id="aviso-download-ia" style="margin-top: 12px; font-size: 12px; display: none; background: rgba(255,170,0,0.15); border: 1px solid rgba(255,170,0,0.3); border-radius: 8px; padding: 10px; color: #ffaa00;">
        <strong>📥 Aviso de Download (~1 GB):</strong> Ao ativar a IA local, será feito o download de um modelo de aproximadamente 1 GB. Recomendamos o uso de conexão Wi-Fi para evitar custos de dados móveis.
      </div>
    </div>
  `;

  const chk = container.querySelector('#chk-ia-local');
  const slider = container.querySelector('#slider-ia-local');
  const knob = container.querySelector('#knob-ia-local');
  const avisoDownload = container.querySelector('#aviso-download-ia');

  if (chk && suporte.suportado) {
    chk.addEventListener('change', async (e) => {
      const ativado = e.target.checked;
      
      if (ativado) {
        avisoDownload.style.display = 'block';
        slider.style.backgroundColor = '#00e5ff';
        knob.style.left = '26px';
        salvarConfig({ ativo: true });
      } else {
        avisoDownload.style.display = 'none';
        slider.style.backgroundColor = 'rgba(255,255,255,0.2)';
        knob.style.left = '3px';
        salvarConfig({ ativo: false });
      }
    });
  } else if (chk && !suporte.suportado) {
    chk.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof window.nexiaToast === 'function') {
        window.nexiaToast('A IA local está bloqueada pois seu navegador não suporta WebGPU.', 'err');
      } else {
        alert('A IA local está bloqueada pois seu navegador não suporta WebGPU.');
      }
    });
  }
}

export { MODELOS_SUPORTADOS, WEBLLM_CDN_URL, renderizarConfiguracaoIALocal };
