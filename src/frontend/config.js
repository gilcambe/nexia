// src/frontend/config.js

// Configurações globais do frontend do Cortex.
// Mantido mínimo: exporta apenas constantes de ambiente.
export const API_URL = import.meta.env.VITE_API_URL || '/api';
export const APP_NAME = 'Cortex';
export default { API_URL, APP_NAME };

// Função para obter configuração da IA local do armazenamento local
export const obterConfig = () => {
  if (typeof window === 'undefined') {
    return { ativo: false };
  }
  
  try {
    const configStr = localStorage.getItem('iaLocalConfig');
    if (configStr) {
      return JSON.parse(configStr);
    }
  } catch (err) {
    console.error('Erro ao obter configuração da IA local:', err);
  }
  
  return { ativo: false }; // Padrão desligado
};

// Função para verificar suporte WebGPU
export const verificarSuporteWebGPU = async () => {
  if (typeof window === 'undefined') {
    return { suportado: false, motivo: 'Ambiente sem suporte a navegador' };
  }
  
  try {
    // Verificar se navigator.gpu existe
    if (!navigator.gpu) {
      return { suportado: false, motivo: 'WebGPU não suportado por este navegador' };
    }
    
    // Tentar obter adaptador
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return { suportado: false, motivo: 'Nenhum adaptador GPU disponível' };
    }
    
    // Verificar memória disponível (mínimo 1 GB)
    const memoryMB = adapter.limits?.maxStorageBufferBindingSize ? 
      adapter.limits.maxStorageBufferBindingSize / (1024 * 1024) : 0;
    
    if (memoryMB < 1024) { // Menos de 1 GB
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

// Função para salvar configuração da IA local
export const salvarConfig = (config) => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem('iaLocalConfig', JSON.stringify(config));
  } catch (err) {
    console.error('Erro ao salvar configuração da IA local:', err);
    throw new Error('Falha ao salvar configuração');
  }
};

// Função para mostrar aviso de bloqueio (alerta simples)
export const mostrarAvisoBloqueio = (motivo) => {
  alert(`WebGPU não suportado: ${motivo || 'Erro ao verificar suporte'}.

Para usar IA local, use um navegador com WebGPU (Chrome 113+, Edge 113+, Firefox Nightly).`);
};

// Função para mostrar aviso de download (alerta simples)
export const mostrarAvisoDownload = () => {
  alert(`IA Local (Grátis, Offline)

Ao ativar, o Cortex vai baixar os modelos (~1 GB) para o seu navegador.

⚠️ Recomendado usar Wi-Fi para evitar consumo de dados.

Os modelos ficam salvos no armazenamento local do navegador e funcionam offline.`);
};

// Função para obter configuração da IA local (wrapper compatível com código existente)
export const getIAAtiva = () => {
  return obterConfig().ativo;
};

// Função para salvar configuração da IA local (wrapper compatível)
export const setIAAtiva = (ativo) => {
  try {
    salvarConfig({ ativo });
    return true;
  } catch (err) {
    console.error('Erro ao salvar configuração da IA local:', err);
    return false;
  }
};

// Função para mostrar aviso quando desativado
export const mostrarAvisoDesativado = () => {
  console.log('IA Local desativada. Os modelos locais não serão usados.');
};