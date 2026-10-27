/**
 * config.js
 * Gerenciamento de configurações do Cortex, incluindo o switch para "IA no meu aparelho (grátis, offline)".
 * Verifica suporte a WebGPU e memória, bloqueia se não suportado e exibe aviso de download de ~1 GB com Wi-Fi.
 */

import { obterConfig, salvarConfig, verificarSuporteWebGPU } from './ia-local.js';

/**
 * Inicializa a UI de configurações do Cortex e os event listeners do switch de IA local.
 */
export async function inicializarConfiguracoesCortex() {
  const container = document.getElementById('cortex-config-container') || document.body;

  // Verifica se o elemento de configuração já existe, senão injeta
  let configEl = document.getElementById('cortex-ia-local-config');
  if (!configEl) {
    configEl = document.createElement('div');
    configEl.id = 'cortex-ia-local-config';
    configEl.className = 'card p-6 my-4 bg-var(--bg2) border border-var(--brd) rounded-xl';
    configEl.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-bold text-base text-var(--text) flex items-center gap-2">
            <span>💻</span> IA no meu aparelho (grátis, offline)
          </h3>
          <p class="text-xs text-var(--text3) mt-1">
            Execute modelos de linguagem diretamente no seu navegador usando WebGPU. 
            Requer placa de vídeo compatível e download de ~1 GB. Recomendado uso de Wi-Fi.
          </p>
        </div>
        <div class="flex items-center gap-3">
          <span id="ia-local-status-text" class="text-xs text-var(--text3)">Desativado</span>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" id="switch-ia-local" class="sr-only peer" aria-label="IA no meu aparelho (grátis, offline)">
            <div class="w-11 h-6 bg-var(--brd2) peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-var(--gold)"></div>
          </label>
        </div>
      </div>
      <div id="ia-local-aviso-box" class="mt-4 hidden p-3 rounded-lg bg-var(--obg) border border-var(--obrd) text-xs text-var(--orange)">
        ⚠ <strong>Aviso de Download:</strong> Ativar a IA local fará o download de aproximadamente <strong>1 GB</strong> de dados do modelo. Recomendamos o uso de conexão Wi-Fi para evitar o consumo de dados móveis.
      </div>
      <div id="ia-local-erro-box" class="mt-4 hidden p-3 rounded-lg bg-var(--rbg) border border-var(--rbrd) text-xs text-var(--red)">
        ❌ <strong id="ia-local-erro-titulo">Dispositivo Incompatível:</strong> <span id="ia-local-erro-msg">Seu navegador ou placa de vídeo não suporta WebGPU.</span>
      </div>
    `;
    container.appendChild(configEl);
  }

  const switchEl = document.getElementById('switch-ia-local');
  const statusText = document.getElementById('ia-local-status-text');
  const avisoBox = document.getElementById('ia-local-aviso-box');
  const erroBox = document.getElementById('ia-local-erro-box');
  const erroMsg = document.getElementById('ia-local-erro-msg');

  if (!switchEl) return;

  // Carrega estado inicial (padrão é desligado/false)
  const configAtual = obterConfig();
  switchEl.checked = Boolean(configAtual.ativo);
  if (switchEl.checked) {
    if (statusText) statusText.textContent = 'Ativado';
    if (avisoBox) avisoBox.classList.remove('hidden');
  } else {
    if (statusText) statusText.textContent = 'Desativado';
  }

  // Event listener para alteração do switch
  switchEl.addEventListener('change', async (e) => {
    const ativar = e.target.checked;

    if (ativar) {
      // Verifica suporte a WebGPU e memória antes de permitir ativar
      const suporte = await verificarSuporteWebGPU();

      if (!suporte.suportado) {
        // Bloqueia ativação e exibe aviso de bloqueio
        switchEl.checked = false;
        if (statusText) statusText.textContent = 'Desativado';
        if (erroMsg) {
          erroMsg.textContent = suporte.motivo || 'Seu navegador ou dispositivo não possui suporte adequado a WebGPU.';
        }
        if (erroBox) erroBox.classList.remove('hidden');
        if (avisoBox) avisoBox.classList.add('hidden');
        return;
      }

      // Suportado: oculta erro, exibe aviso de download de ~1 GB com recomendação de Wi-Fi
      if (erroBox) erroBox.classList.add('hidden');
      if (avisoBox) avisoBox.classList.remove('hidden');
      if (statusText) statusText.textContent = 'Ativado';

      salvarConfig({ ativo: true });
    } else {
      // Desativando
      if (avisoBox) avisoBox.classList.add('hidden');
      if (erroBox) erroBox.classList.add('hidden');
      if (statusText) statusText.textContent = 'Desativado';

      salvarConfig({ ativo: false });
    }
  });
}

// Auto-executa se estiver no browser e o DOM estiver pronto
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      inicializarConfiguracoesCortex().catch(console.error);
    });
  } else {
    inicializarConfiguracoesCortex().catch(console.error);
  }
}
