// ia-local.js - Configurações e suporte à IA local (WebGPU, offline, 1 GB)
// Padrão: desligado. Verifica navigator.gpu e memória, bloqueia se não suportado e avisa sobre download (~1 GB) com recomendação de Wi-Fi.

window.IaLocalConfig = (function() {
  const STORAGE_KEY = 'cortex_ia_local_config';

  function carregarPrefs() {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY);
      if (salvo) return JSON.parse(salvo);
    } catch (e) {
      console.warn('Erro ao carregar preferência de IA local:', e);
    }
    return { ativo: false };
  }

  function salvarPrefs(prefs) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (e) {
      console.warn('Erro ao salvar preferência de IA local:', e);
    }
  }

  async function verificarSuporteWebGPU() {
    if (!navigator.gpu) {
      return { suportado: false, motivo: 'O navegador não possui suporte ao WebGPU (navigator.gpu indisponível).' };
    }
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        return { suportado: false, motivo: 'Nenhum adaptador WebGPU compatível foi encontrado neste dispositivo.' };
      }
    } catch (err) {
      return { suportado: false, motivo: 'Erro ao solicitar adaptador WebGPU: ' + (err.message || err) };
    }

    // Verificar memória estimada (se disponível na API de Device Memory)
    if (navigator.deviceMemory && navigator.deviceMemory < 4) {
      return { suportado: false, motivo: `Memória RAM detectada (${navigator.deviceMemory} GB) abaixo do recomendado (mínimo 4 GB).` };
    }

    return { suportado: true };
  }

  return {
    obter: carregarPrefs,
    salvar: salvarPrefs,
    verificarSuporte: verificarSuporteWebGPU
  };
})();
