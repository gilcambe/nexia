// src/frontend/config.js

// Lógica de configuração da IA local (única fonte de verdade)
const CONFIG_KEY = 'nexia_ia_local_config';

export const obterConfig = () => {
  const storedConfig = localStorage.getItem(CONFIG_KEY);
  if (storedConfig) {
    try {
      const config = JSON.parse(storedConfig);
      if (typeof config.ativo === 'boolean') {
        return config;
      }
    } catch (e) {
      console.error('Erro ao parsear config de IA local:', e);
    }
  }
  return { ativo: false };
};

export const salvarConfig = (config) => {
  const currentConfig = obterConfig();
  const newConfig = { ...currentConfig, ...config };
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(newConfig));
  } catch (e) {
    console.error('Erro ao salvar config de IA local:', e);
  }
};

export const verificarSuporteWebGPU = async () => {
  if (typeof window === 'undefined') {
    return { suportado: false, motivo: 'Ambiente sem suporte a navegador' };
  }

  try {
    if (!navigator.gpu) {
      return { suportado: false, motivo: 'WebGPU não suportado por este navegador' };
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return { suportado: false, motivo: 'Nenhum adaptador GPU disponível' };
    }

    const memoryMB = adapter.limits?.maxStorageBufferBindingSize ?
      adapter.limits.maxStorageBufferBindingSize / (1024 * 1024) : 0;

    if (memoryMB < 1024) {
      return { suportado: false, motivo: 'Memória GPU insuficiente (mínimo 1 GB necessário)' };
    }

    return { suportado: true };
  } catch (err) {
    return {
      suportado: false,
      motivo: err instanceof Error ? err.message : 'Erro ao verificar suporte WebGPU'
    };
  }
};