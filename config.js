/**
 * Configurações do Cortex - Tela de Configurações
 *
 * Esta módulo gerencia as preferências do usuário no Cortex,
 * incluindo o switch de IA no meu aparelho (grátis, offline).
 */

// --- Estado Global ---
let config = {
  iaNoAparelho: false // Default desligado
};

// --- Funções de Acesso ---

/**
 * Obtém a configuração atual da IA local
 * @returns {boolean} true se a IA local está ativa
 */
function getIAAtiva() {
  return config.iaNoAparelho;
}

/**
 * Define a configuração da IA local
 * @param {boolean} ativo - true para ativar, false para desativar
 * @returns {boolean} true se a configuração foi salva com sucesso
 */
function setIAAtiva(ativo) {
  try {
    config.iaNoAparelho = ativo;
    salvarNoLocalStorage();
    return true;
  } catch (err) {
    console.error('Erro ao salvar configuração da IA local:', err);
    return false;
  }
}

// --- Verificação de WebGPU e Memória ---

/**
 * Verifica se o navegador suporta WebGPU e tem memória suficiente
 * @returns {Promise<{suportado: boolean, motivo?: string}>}
 */
async function verificarSuporteWebGPU() {
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
    
        // Verificar memória do sistema (mínimo 1 GB)
    const memoriaSistema = typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : 0;

    if (memoriaSistema < 1) { // Menos de 1 GB
      return { suportado: false, motivo: 'Memória do sistema insuficiente (mínimo 1 GB necessário)' };
    }
    
    return { suportado: true };
  } catch (err) {
    return { 
      suportado: false, 
      motivo: err.message || 'Erro ao verificar suporte WebGPU' 
    };
  }
}

/**
 * Verifica se tem conexão Wi-Fi
 * @returns {boolean} true se está conectado a Wi-Fi
 */
function verificarWiFi() {
  if (typeof navigator === 'undefined' || !navigator.connection) {
    return true; // Sem suporte, assume positivo
  }
  
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return conn.type === 'wifi';
}

// --- Avisos e Mensagens ---

/**
 * Mostra aviso de bloqueio por WebGPU/memória
 */
function mostrarAvisoBloqueio(motivo) {
  // Em um ambiente real, isso seria exibido na UI do Cortex
  alert(`⚠️ ${motivo}\n\nA IA no seu aparelho não pode ser ativada porque:\n• Seu navegador não suporta WebGPU\n• Ou sua GPU não tem memória suficiente (mínimo 1 GB)\n\nSeu aparelho continuará usando as IAs grátis do Cortex, que funcionam online.`);
}

/**
 * Mostra aviso de download e recomendação de Wi-Fi
 */
function mostrarAvisoDownload() {
  // Em um ambiente real, isso seria exibido na UI do Cortex
  const estaWiFi = verificarWiFi();
  
  alert(`💾 IA no meu aparelho (grátis, offline)\n\nAo ativar, o Cortex vai baixar os modelos de IA (~1 GB) para funcionar offline no seu aparelho.\n\n${estaWiFi ? '✅ Você está conectado a Wi-Fi.' : '⚠️ Você não está conectado a Wi-Fi.'}\n\nRecomendação: Conecte-se a uma rede Wi-Fi antes de ativar para evitar consumo de dados móveis.`);
}

/**
 * Mostra aviso de desativado
 */
function mostrarAvisoDesativado() {
  // Em um ambiente real, isso seria exibido na UI do Cortex
  alert(`IA no meu aparelho está desativada.\n\nVocê continuará usando as IAs grátis do Cortex que funcionam online.`);
}

// --- Persistência ---

/**
 * Salva a configuração no localStorage
 */
function salvarNoLocalStorage() {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem('iaLocalConfig', JSON.stringify(config));
  } catch (err) {
    console.error('Erro ao salvar configuração no localStorage:', err);
  }
}

/**
 * Carrega a configuração do localStorage
 */
function carregarDoLocalStorage() {
  if (typeof window === 'undefined') return;
  
  try {
    const configStr = localStorage.getItem('iaLocalConfig');
    if (configStr) {
      config = JSON.parse(configStr);
    }
  } catch (err) {
    console.error('Erro ao carregar configuração do localStorage:', err);
  }
}

/**
 * Reseta a configuração para o padrão
 */
function resetarConfiguracao() {
  config = {
    iaNoAparelho: false
  };
  salvarNoLocalStorage();
}

// --- Manipulação do Switch ---

/**
 * Manipula o clique no switch da IA no aparelho
 * @returns {Promise<boolean>} true se a ativação foi bem sucedida
 */
async function handleSwitchIaAparelho() {
  try {
    // Verificar suporte WebGPU
    const suporte = await verificarSuporteWebGPU();
    
    if (!suporte.suportado) {
      mostrarAvisoBloqueio(suporte.motivo);
      return false;
    }
    
    // Mostrar aviso de download
    mostrarAvisoDownload();
    
    // Ativar a IA local
    const sucesso = setIAAtiva(true);
    
    if (sucesso) {
      // Em um ambiente real, aqui iniciaria o download dos modelos
      console.log('IA no aparelho ativada. Download dos modelos iniciado...');
    }
    
    return sucesso;
  } catch (err) {
    console.error('Erro ao ativar IA no aparelho:', err);
    mostrarAvisoBloqueio('Erro ao tentar ativar a IA no aparelho. Tente novamente.');
    return false;
  }
}

/**
 * Manipula o desligamento do switch da IA no aparelho
 */
function handleDesligarIaAparelho() {
  setIAAtiva(false);
  mostrarAvisoDesativado();
}

// --- Inicialização ---

// Carrega a configuração salva quando o módulo é carregado
if (typeof window !== 'undefined') {
  carregarDoLocalStorage();
}

// --- Exports ---

export default {
  getIAAtiva,
  setIAAtiva,
  verificarSuporteWebGPU,
  verificarWiFi,
  mostrarAvisoBloqueio,
  mostrarAvisoDownload,
  mostrarAvisoDesativado,
  resetarConfiguracao
};