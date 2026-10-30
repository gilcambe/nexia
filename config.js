/**
 * config.js
 * Configurações da IA local (grátis, offline): verificação de WebGPU e memória,
 * leitura e gravação da preferência no localStorage e utilitário de UI para o
 * switch "IA no meu aparelho" nas configurações.
 */

const LOCAL_STORAGE_KEY = 'nexia_ia_local_config';
const MEMORIA_MINIMA_GB = 2;

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

  if (memoriaGb < MEMORIA_MINIMA_GB) {
    return {
      suportado: false,
      motivo: `Memória insuficiente para IA local offline (${memoriaGb} GB, mínimo recomendado: ${MEMORIA_MINIMA_GB} GB).`,
      memoriaGb
    };
  }

  return {
    suportado: true,
    memoriaGb
  };
}

/**
 * Obtém as configurações salvas da IA local no localStorage.
 * @returns {Object} Configuração da IA local.
 */
export function obterConfig() {
  try {
    if (typeof localStorage === 'undefined') return { ativo: false };
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return { ativo: false };
    }
    const parsed = JSON.parse(raw);
    return {
      ativo: Boolean(parsed.ativo)
    };
  } catch {
    return { ativo: false };
  }
}

/**
 * Salva as configurações da IA local no localStorage.
 * @param {Object} novaConfig - { ativo?: boolean }
 * @returns {Object} Configuração atualizada.
 */
export function salvarConfig(novaConfig = {}) {
  const atual = obterConfig();
  const proxima = {
    ...atual,
    ...novaConfig
  };

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(proxima));
    }
  } catch (err) {
    console.warn('[config] Não foi possível salvar configuração no localStorage:', err);
  }

  return proxima;
}

/**
 * Função utilitária de UI para gerenciar o switch de IA no meu aparelho (grátis, offline)
 * nas configurações. Verifica suporte a WebGPU e memória, exibe aviso de bloqueio se não
 * suportado, e exibe aviso de download de ~1 GB com recomendação de Wi-Fi ao ligar.
 * Tudo usando elementos de UI integrados (sem window.confirm nativo).
 * 
 * @param {HTMLInputElement} checkboxElement O elemento input do switch
 * @param {HTMLElement} [containerAvisoElement] Elemento opcional para exibir mensagens/avisos
 * @returns {Promise<boolean>} Retorna o novo estado ativo do switch
 */
export function criarSwitchIALocal(container) {
  const containerAviso = container || document.createElement('div');
  containerAviso.className = 'cx-ia-local-aviso';
  containerAviso.style.display = 'none';

  const wrapper = document.createElement('label');
  wrapper.className = 'cx-ia-local-switch';
  wrapper.style.display = 'flex';
  wrapper.style.alignItems = 'center';
  wrapper.style.gap = '0.75rem';
  wrapper.style.cursor = 'pointer';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = 'ia-local-switch';
  input.checked = false;
  input.disabled = false;
  input.setAttribute('data-testid', 'cx-ia-local');

  const texto = document.createElement('span');
  texto.textContent = 'IA no meu aparelho (grátis, offline)';

  wrapper.appendChild(input);
  wrapper.appendChild(texto);
  containerAviso.appendChild(wrapper);

  return { input, containerAviso, wrapper };
}

export async function configurarSwitchIALocal(checkboxElement, containerAvisoElement) {
  if (!checkboxElement) return false;

  const configAtual = obterConfig();
  checkboxElement.checked = configAtual.ativo;
  checkboxElement.disabled = false;

  // Verifica suporte a WebGPU e memória; se não suportado, bloqueia o switch
  const suporte = await verificarSuporteWebGPU();
  if (!suporte.suportado) {
    checkboxElement.disabled = true;
    if (containerAvisoElement) {
      containerAvisoElement.style.display = 'block';
      containerAvisoElement.textContent = `Bloqueado: ${suporte.motivo}`;
    }
    return configAtual.ativo;
  }

  const memoriaGb = typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : 4;

  const limparAviso = () => {
    if (!containerAvisoElement) return;
    containerAvisoElement.textContent = '';
    containerAvisoElement.style.display = 'none';
  };

  const mostrarAviso = (texto, tipo = 'aviso') => {
    if (!containerAvisoElement) return;
    containerAvisoElement.textContent = texto;
    containerAvisoElement.style.display = 'block';
  };

  const mostrarAvisoDownload = (onConfirmar, onCancelar) => {
    if (!containerAvisoElement) return;
    containerAvisoElement.style.display = 'block';
    containerAvisoElement.textContent = '';

    const titulo = document.createElement('div');
    titulo.textContent = '⚠ Download necessário';

    const texto = document.createElement('p');
    texto.textContent = 'Será baixado aproximadamente 1 GB de dados para o modelo de IA local. Recomendado usar Wi-Fi.';

    const botoes = document.createElement('div');

    const btnConfirmar = document.createElement('button');
    btnConfirmar.id = 'ia-local-confirmar-download';
    btnConfirmar.textContent = 'Confirmar download';
    btnConfirmar.onclick = () => { limparAviso(); onConfirmar(); };

    const btnCancelar = document.createElement('button');
    btnCancelar.id = 'ia-local-cancelar-download';
    btnCancelar.textContent = 'Cancelar';
    btnCancelar.onclick = () => { limparAviso(); onCancelar(); };

    botoes.appendChild(btnConfirmar);
    botoes.appendChild(btnCancelar);

    containerAvisoElement.appendChild(titulo);
    containerAvisoElement.appendChild(texto);
    containerAvisoElement.appendChild(botoes);
  };

  checkboxElement.onchange = async (e) => {
    const ativar = checkboxElement.checked;

    if (!ativar) {
      limparAviso();
      salvarConfig({ ativo: false });
      return;
    }

    // Ao tentar ligar, verifica suporte a WebGPU e memória
    checkboxElement.checked = false; // reverte temporariamente até confirmar suporte
    limparAviso();
    mostrarAviso('Verificando suporte a WebGPU no aparelho...', 'aviso');

    const suporte = await verificarSuporteWebGPU();

    if (!suporte.suportado) {
      checkboxElement.checked = false;
      salvarConfig({ ativo: false });
      mostrarAviso(`Bloqueado: ${suporte.motivo}`, 'erro');
      return;
    }

    // Suportado: exibe aviso de download de ~1 GB com recomendação de Wi-Fi
    mostrarAvisoDownload(
      () => {
        // Confirmado e suportado
        checkboxElement.checked = true;
        salvarConfig({ ativo: true });
        mostrarAviso('IA no meu aparelho ativada com sucesso! O modelo (~1 GB) será baixado sob demanda ao iniciar o uso.', 'ok');
      },
      () => {
        // Cancelado pelo usuário
        checkboxElement.checked = false;
        salvarConfig({ ativo: false });
        mostrarAviso('Ativação cancelada pelo usuário.', 'aviso');
      }
    );
  };

  return configAtual.ativo;
}