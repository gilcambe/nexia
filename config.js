// config.js - Tela de Configurações e Preferências do Cortex (IA Local, WebGPU, Download)

import { obterConfig, salvarConfig, verificarSuporteWebGPU } from './ia-local.js';

export function inicializarConfiguracoes() {
  const container = document.getElementById('configuracoes-container');
  if (!container) return;

  const configAtual = obterConfig() || { ativo: false };
  let isLocalIAEnabled = !!configAtual.ativo;
  let isWebGpuSupported = true;
  let showDownloadWarning = false;

  async function verificarSuporte() {
    try {
      const { suportado, motivo } = await verificarSuporteWebGPU();
      isWebGpuSupported = suportado;
      if (!suportado) {
        console.warn('IA Local não suportada:', motivo);
      }
    } catch (err) {
      console.error('Erro ao verificar suporte WebGPU:', err);
      isWebGpuSupported = false;
    }
    render();
  }

  function handleToggleLocalIA() {
    if (!isWebGpuSupported) {
      return; // Bloqueia o clique se não suportado
    }

    if (isLocalIAEnabled) {
      isLocalIAEnabled = false;
      salvarConfig({ ativo: false });
    } else {
      showDownloadWarning = true;
    }
    render();
  }

  function handleConfirmDownload() {
    isLocalIAEnabled = true;
    showDownloadWarning = false;
    salvarConfig({ ativo: true });
    render();
  }

  function handleCancelDownload() {
    showDownloadWarning = false;
    render();
  }

  function render() {
    container.innerHTML = `
      <div class="max-w-3xl mx-auto p-6 space-y-4">
        <h2 class="text-2xl font-semibold">Configurações</h2>
        
        <!-- Seção IA no meu aparelho -->
        <div class="rounded-2xl border border-[var(--cx-line)] bg-[var(--cx-card)] p-4">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="font-medium">IA no meu aparelho (grátis, offline)</h3>
              <p class="text-sm text-[var(--cx-mut)] mt-1">
                Execute o Cortex diretamente no seu dispositivo para respostas mais rápidas e privacidade total.
              </p>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-sm text-[var(--cx-mut)]">
                ${isLocalIAEnabled ? 'Ativado' : 'Desativado'}
              </span>
              <button
                id="local-ia-toggle"
                type="button"
                data-testid="local-ia-toggle"
                role="switch"
                aria-checked="${isLocalIAEnabled}"
                aria-label="IA no meu aparelho"
                class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isLocalIAEnabled ? 'bg-[var(--cx-ac)]' : 'bg-[var(--cx-line)]'} ${!isWebGpuSupported ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}"
                ${!isWebGpuSupported ? 'disabled' : ''}
              >
                <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isLocalIAEnabled ? 'translate-x-6' : 'translate-x-1'}"></span>
              </button>
            </div>
          </div>

          ${!isWebGpuSupported ? `
            <div class="text-xs text-red-400 mt-2" data-testid="webgpu-blocked-warning">
              <p>⚠️ Seu navegador não suporta WebGPU ou não tem memória suficiente. Funcionalidade bloqueada.</p>
            </div>
          ` : ''}

          ${showDownloadWarning && !isLocalIAEnabled ? `
            <div class="text-xs text-yellow-400 mt-2 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20" data-testid="download-warning">
              <p class="font-medium mb-1">⬇️ Aviso de Download (~1 GB)</p>
              <p>Para ativar a IA local, será feito o download de um modelo de aproximadamente 1 GB. Recomendamos o uso de uma conexão Wi-Fi estável.</p>
              <div class="flex justify-end gap-2 mt-3">
                <button
                  id="download-cancel-btn"
                  type="button"
                  class="px-3 py-1 text-xs border border-[var(--cx-line)] rounded-lg hover:border-[var(--cx-ac)] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  id="download-confirm-btn"
                  type="button"
                  class="px-3 py-1 text-xs bg-[var(--cx-ac)] text-black font-semibold rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Confirmar Download
                </button>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    const toggleBtn = document.getElementById('local-ia-toggle');
    if (toggleBtn) {
      toggleBtn.onclick = handleToggleLocalIA;
    }

    const cancelBtn = document.getElementById('download-cancel-btn');
    if (cancelBtn) {
      cancelBtn.onclick = handleCancelDownload;
    }

    const confirmBtn = document.getElementById('download-confirm-btn');
    if (confirmBtn) {
      confirmBtn.onclick = handleConfirmDownload;
    }
  }

  verificarSuporte();
}
