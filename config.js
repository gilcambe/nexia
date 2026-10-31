// config.js - Configurações do Cortex e preferências de IA local

export const verificarSuporteWebGPU = async () => {
  if (typeof navigator === 'undefined') {
    return { suportado: false, motivo: 'Ambiente sem navegador' };
  }
  const hasGpu = 'gpu' in navigator && navigator.gpu !== undefined;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (!hasGpu) {
    return { suportado: false, motivo: 'WebGPU não suportada neste navegador' };
  }
  if (memory !== undefined && memory < 4) {
    return { suportado: false, motivo: 'Memória insuficiente (mínimo recomendado: 4 GB)' };
  }
  try {
    const adapter = await (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu?.requestAdapter();
    if (!adapter) {
      return { suportado: false, motivo: 'Adaptador WebGPU não encontrado' };
    }
  } catch {
    return { suportado: false, motivo: 'Falha ao solicitar adaptador WebGPU' };
  }
  return { suportado: true };
};

export const configManager = {
  async getIAState() {
    try {
      const val = localStorage.getItem('cortex_ia_local');
      return val === 'true';
    } catch {
      return false;
    }
  },
  async setIAState(ativo: boolean) {
    try {
      localStorage.setItem('cortex_ia_local', String(ativo));
    } catch {}
  }
};
