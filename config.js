// Configurações do Cortex

// Interface para configuração da IA local
export interface IALocalConfig {
  ativo: boolean;
}


// Função para obter configuração da IA local do armazenamento local
export const obterConfig = (): IALocalConfig => {
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
  
  return { ativo: false };
};

// Função para verificar suporte WebGPU
export const verificarSuporteWebGPU = async (): Promise<{ suportado: boolean; motivo?: string }> => {
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
export const salvarConfig = (config: IALocalConfig) => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem('iaLocalConfig', JSON.stringify(config));
  } catch (err) {
    console.error('Erro ao salvar configuração da IA local:', err);
    throw new Error('Falha ao salvar configuração');
  }
};

// Funções para gerenciar o estado da IA local
export const getIAAtiva = (): boolean => {
  return obterConfig().ativo;
};

export const setIAAtiva = async (ativo: boolean): Promise<{ success: boolean; error?: string; avisoDownload?: boolean }> => {
  try {
    if (ativo) {
      const suporte = await verificarSuporteWebGPU();
      if (!suporte.suportado) {
        return { 
          success: false, 
          error: `Seu navegador ou dispositivo não suporta IA no aparelho (WebGPU/Memória insuficiente). Motivo: ${suporte.motivo || 'WebGPU indisponível'}` 
        };
      }
      return { 
        success: true, 
        avisoDownload: true 
      };
    }
    const config = obterConfig();
    config.ativo = false;
    salvarConfig(config);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Erro ao alterar configuração' };
  }
};

// Funções para mostrar avisos
export const mostrarAvisoBloqueio = (motivo: string) => {
  alert(`⚠️ Bloqueado: ${motivo}`);
};

export const mostrarAvisoDownload = () => {
  alert('📥 Download necessário\n\nPara ativar a IA local, será necessário baixar aproximadamente 1GB de dados do modelo.\nRecomendamos realizar este download em uma rede Wi-Fi para evitar cobranças de dados móveis.');
};

export const mostrarAvisoDesativado = () => {
  alert('✅ IA local desativada');
};
