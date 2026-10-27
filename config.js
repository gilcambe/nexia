/**
 * Configurações da IA local no navegador (WebGPU, WebLLM, etc.)
 */

let configIaLocal = {
  ativo: false,
  modelo: 'Llama-3.8B-Instruct-q4f32_1-MLC'
};

export function obterConfig() {
  try {
    const salvo = localStorage.getItem('cortex_ia_local_config');
    if (salvo) {
      return { ...configIaLocal, ...JSON.parse(salvo) };
    }
  } catch (e) {
    console.error('Erro ao obter config IA local:', e);
  }
  return configIaLocal;
}

export function salvarConfig(novaConfig) {
  try {
    configIaLocal = { ...configIaLocal, ...novaConfig };
    localStorage.setItem('cortex_ia_local_config', JSON.stringify(configIaLocal));
  } catch (e) {
    console.error('Erro ao salvar config IA local:', e);
  }
}

export async function verificarSuporteWebGPU() {
  if (!navigator.gpu) {
    return {
      suportado: false,
      motivo: 'Seu navegador não suporta WebGPU. Use a versão mais recente do Google Chrome, Edge ou Brave.'
    };
  }

  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return {
        suportado: false,
        motivo: 'Nenhum adaptador WebGPU compatível foi encontrado no seu dispositivo.'
      };
    }

    // Estimativa de memória se disponível
    let memoriaGb = 8; // Padrão assumido se deviceMemory não estiver disponível
    if (navigator.deviceMemory) {
      memoriaGb = navigator.deviceMemory;
    }

    return {
      suportado: true,
      memoriaGb
    };
  } catch (e) {
    return {
      suportado: false,
      motivo: 'Erro ao inicializar o adaptador WebGPU: ' + (e?.message || e)
    };
  }
}

export async function inicializarEngine(modelo, onProgress) {
  // Simulação ou chamada real ao WebLLM se integrado
  if (onProgress) {
    onProgress({ progress: 0.1 });
    await new Promise((r) => setTimeout(r, 500));
    onProgress({ progress: 0.5 });
    await new Promise((r) => setTimeout(r, 500));
    onProgress({ progress: 1.0 });
  }
  return true;
}
