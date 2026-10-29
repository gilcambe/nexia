/**
 * config.js
 * Configuração da IA local (WebGPU) - implementação mínima
 * Verifica suporte a WebGPU e memória, exibe avisos de download
 */

const LOCAL_STORAGE_KEY = 'nexia_ia_local_config';

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