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
 * Renderiza ou atualiza o switch e os avisos de IA local na tela de configurações.
 * Verifica suporte a WebGPU, exibe aviso de bloqueio se não suportado,
 * e exibe aviso de download de ~1 GB com recomendação de Wi-Fi ao ligar.
 * @param {string|HTMLElement} containerOuSeletor - Container onde inserir o controle ou seletor CSS
 */
export async function renderizarConfiguracaoIALocal(containerOuSeletor) {
  const container = typeof containerOuSeletor === 'string' 
    ? document.querySelector(containerOuSeletor) 
    : containerOuSeletor;

  if (!container) return;

  const config = obterConfig();
  const suporte = await verificarSuporteWebGPU();

  container.innerHTML = `
    <div class="ia-local-config-box" style="padding: 16px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); margin: 12px 0;">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
        <div>
          <h4 style="font-size: 15px; font-weight: 700; margin-bottom: 4px;">IA no meu aparelho (grátis, offline)</h4>
          <p style="font-size: 13px; color: var(--suave, #aaa);">Execute modelos de IA diretamente no seu navegador com WebGPU.</p>
        </div>
        <label class="switch" style="position: relative; display: inline-block; width: 50px; height: 26px; flex-shrink: 0;">
          <input type="checkbox" id="ia-local-switch" ${config.ativo ? 'checked' : ''} ${!suporte.suportado ? 'disabled' : ''} style="opacity: 0; width: 0; height: 0;">
          <span class="slider" style="cursor: pointer; position: absolute; inset: 0; background-color: ${!suporte.suportado ? '#444' : '#ccc'}; transition: .4s; border-radius: 34px;"></span>
        </label>
      </div>

      <div id="ia-local-status-msg" style="margin-top: 12px; font-size: 13px;">
        ${!suporte.suportado 
          ? `<div style="padding: 10px; border-radius: 8px; background: rgba(255,107,107,0.15); color: #ff6b6b; border: 1px solid rgba(255,107,107,0.3);">
               <strong>Bloqueado:</strong> Seu navegador ou dispositivo não suporta WebGPU (${suporte.motivo}). A IA local não pode ser ativada.
             </div>`
          : config.ativo
            ? `<div style="padding: 10px; border-radius: 8px; background: rgba(42,122,78,0.2); color: #2A7A4E; border: 1px solid rgba(42,122,78,0.3);">
                 <strong>Ativo:</strong> IA local pronta para uso no aparelho.
               </div>`
            : `<div style="color: var(--suave, #aaa);">Desativado. O modelo (~1 GB) será baixado ao ativar.</div>`
        }
      </div>
    </div>
  `;

  const inputSwitch = container.querySelector('#ia-local-switch');
  const statusMsg = container.querySelector('#ia-local-status-msg');

  if (inputSwitch && suporte.suportado) {
    inputSwitch.addEventListener('change', async (e) => {
      const ativando = e.target.checked;

      if (ativando) {
        // Exibe aviso de download de ~1 GB com recomendação de Wi-Fi ao ligar
        const confirmar = window.confirm('Ativar a IA no aparelho?\n\nSerá feito o download de aproximadamente 1 GB de dados do modelo de IA.\nRecomendamos fortemente o uso de conexão Wi-Fi.');
        
        if (!confirmar) {
          e.target.checked = false;
          return;
        }

        salvarConfig({ ativo: true });
        if (statusMsg) {
          statusMsg.innerHTML = `
            <div style="padding: 10px; border-radius: 8px; background: rgba(230,162,60,0.15); color: #e6a23c; border: 1px solid rgba(230,162,60,0.3);">
              <strong>Baixando modelo (~1 GB)...</strong> Certifique-se de estar no Wi-Fi. Inicializando IA local...
            </div>
          `;
        }

        try {
          await inicializarEngine(null, (prog) => {
            if (statusMsg) {
              const porcentagem = Math.round((prog?.progress || 0) * 100);
              statusMsg.innerHTML = `
                <div style="padding: 10px; border-radius: 8px; background: rgba(230,162,60,0.15); color: #e6a23c; border: 1px solid rgba(230,162,60,0.3);">
                  <strong>Baixando modelo (~1 GB):</strong> ${prog?.text || `${porcentagem}%`}${porcentagem ? ` (${porcentagem}%)` : ''}
                </div>
              `;
            }
          });

          if (statusMsg) {
            statusMsg.innerHTML = `
              <div style="padding: 10px; border-radius: 8px; background: rgba(42,122,78,0.2); color: #2A7A4E; border: 1px solid rgba(42,122,78,0.3);">
                <strong>Sucesso!</strong> IA local ativada e modelo carregado no aparelho.
              </div>
            `;
          }
        } catch (err) {
          salvarConfig({ ativo: false });
          e.target.checked = false;
          if (statusMsg) {
            statusMsg.innerHTML = `
              <div style="padding: 10px; border-radius: 8px; background: rgba(255,107,107,0.15); color: #ff6b6b; border: 1px solid rgba(255,107,107,0.3);">
                <strong>Erro ao carregar modelo:</strong> ${err?.message || err}
              </div>
            `;
          }
        }
      } else {
        salvarConfig({ ativo: false });
        if (statusMsg) {
          statusMsg.innerHTML = `
            <div style="color: var(--suave, #aaa);">Desativado. O modelo (~1 GB) será baixado ao ativar.</div>
          `;
        }
      }
    });
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

  // Bloqueia se a memória for insuficiente para rodar o modelo local (~1 GB + overhead WebGPU)
  if (typeof navigator.deviceMemory === 'number' && memoriaGb < 4) {
    return { suportado: false, motivo: `Memória insuficiente para IA local: ${memoriaGb} GB (mínimo recomendado: 4 GB).`, memoriaGb };
  }

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

export { MODELOS_SUPORTADOS, WEBLLM_CDN_URL };
