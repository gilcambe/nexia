// src/frontend/config.js

// Configurações globais do frontend do Cortex.
// Mantido mínimo: exporta apenas constantes de ambiente.
// src/frontend/config.js

export const API_URL = import.meta.env.VITE_API_URL || '/api';
export const APP_NAME = 'Cortex';

let iaAtiva = false;

export const getIAAtiva = () => iaAtiva;

export const setIAAtiva = (valor) => {
  iaAtiva = valor;
  return true;
};

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
    const adapter = await (navigator as Navigator & { gpu: { requestAdapter: () => Promise<unknown> } }).gpu.requestAdapter();
    if (!adapter) {
      return { suportado: false, motivo: 'Adaptador WebGPU não encontrado' };
    }
  } catch {
    return { suportado: false, motivo: 'Falha ao solicitar adaptador WebGPU' };
  }
  return { suportado: true };
};

export const mostrarAvisoBloqueio = (motivo) => {
  console.warn('Aviso de bloqueio IA local:', motivo);
};

export const mostrarAvisoDownload = () => {
  console.log('Aviso: Baixando modelos (~1 GB). Recomendado uso de Wi-Fi.');
};

export const mostrarAvisoDesativado = () => {
  console.log('IA local desativada.');
};

export default {
  API_URL,
  APP_NAME,
  getIAAtiva,
  setIAAtiva,
  verificarSuporteWebGPU,
  mostrarAvisoBloqueio,
  mostrarAvisoDownload,
  mostrarAvisoDesativado
};
