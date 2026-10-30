// src/config.ts

// Simula um armazenamento local (localStorage) para persistência das configurações.
// Em um app real, isso poderia ser integrado ao backend ou a um sistema de armazenamento mais robusto.
const CONFIG_KEY = 'nexia_ia_local_config';

interface IaLocalConfig {
  ativo: boolean;
}

export const obterConfig = (): IaLocalConfig => {
  const storedConfig = localStorage.getItem(CONFIG_KEY);
  if (storedConfig) {
    try {
      const config = JSON.parse(storedConfig) as IaLocalConfig;
      // Validação básica para garantir que o campo 'ativo' exista
      if (typeof config.ativo === 'boolean') {
        return config;
      }
    } catch (e) {
      console.error("Erro ao parsear config de IA local:", e);
    }
  }
  // Retorna o padrão se não houver config salva ou se houver erro no parse
  return { ativo: false };
};

export const salvarConfig = (config: Partial<IaLocalConfig>): void => {
  const currentConfig = obterConfig();
  const newConfig = { ...currentConfig, ...config };
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(newConfig));
  } catch (e) {
    console.error("Erro ao salvar config de IA local:", e);
  }
};

interface SuporteWebGPUResult {
  suportado: boolean;
  motivo?: string;
  memoriaAproximadaGB?: number;
}

export const verificarSuporteWebGPU = async (): Promise<SuporteWebGPUResult> => {
  if (!('gpu' in navigator)) {
    return { suportado: false, motivo: 'WebGPU não é suportado pelo seu navegador.' };
  }

  try {
    // Tenta obter um adaptador e dispositivo
    await navigator.gpu.requestAdapter();
    // Se chegou aqui, WebGPU é suportado
    // Para simular a verificação de memória, podemos retornar um valor fixo ou tentar uma estimativa (mais complexo)
    // O pedido menciona ~1 GB, então vamos retornar isso como informação
    return { suportado: true, memoriaAproximadaGB: 1 };
  } catch (e) {
    console.error("Erro ao verificar WebGPU:", e);
    return { suportado: false, motivo: 'Falha ao inicializar WebGPU.' };
  }
};

// Esta função pode ser usada para configurar o switch na UI,
// mas a lógica de habilitação/desabilitação e avisos ficará no componente.
export const configurarSwitchIALocal = (
  setIaLocalAtivo: (ativo: boolean) => void,
  setBloqueado: (bloqueado: boolean) => void,
  setMotivoBloqueio: (motivo: string) => void,
  setMostrarAvisoDownload: (mostrar: boolean) => void
) => {
  (async () => {
    try {
      const config = obterConfig();
      setIaLocalAtivo(config.ativo);

      const suporte = await verificarSuporteWebGPU();
      if (!suporte.suportado) {
        setBloqueado(true);
        setMotivoBloqueio(suporte.motivo || 'Não suportado');
      } else {
        setBloqueado(false);
        setMotivoBloqueio('');
      }
    } catch (err) {
      setBloqueado(true);
      setMotivoBloqueio(err instanceof Error ? err.message : 'Erro desconhecido');
    }
  })();
};
