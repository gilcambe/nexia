/**
 * config.js
 * Tela de Configurações do Cortex e Preferências de IA Local.
 * Inclui o switch "IA no meu aparelho (grátis, offline)", verificação de WebGPU e memória,
 * bloqueio caso não suportado e aviso de download de ~1 GB com recomendação de Wi-Fi.
 */

import { obterConfig, salvarConfig, verificarSuporteWebGPU } from './ia-local.js';

document.addEventListener('DOMContentLoaded', async () => {
  const toggleLocalIA = document.getElementById('toggle-local-ia');
  const statusLocalIA = document.getElementById('status-local-ia');
  const alertaWebGPU = document.getElementById('alerta-webgpu-bloqueado');
  const alertaDownload = document.getElementById('alerta-download-ia');
  const btnCancelarDownload = document.getElementById('btn-cancelar-download');
  const btnConfirmarDownload = document.getElementById('btn-confirmar-download');

  if (!toggleLocalIA) return;

  // Estado inicial baseado no localStorage e suporte
  const configAtual = obterConfig();
  let suportadoWebGPU = true;

  try {
    const suporte = await verificarSuporteWebGPU();
    suportadoWebGPU = suporte.suportado;
    if (!suportadoWebGPU) {
      toggleLocalIA.disabled = true;
      toggleLocalIA.checked = false;
      if (statusLocalIA) statusLocalIA.textContent = 'Indisponível (Sem suporte a WebGPU)';
      if (alertaWebGPU) {
        alertaWebGPU.classList.remove('hidden');
        alertaWebGPU.textContent = `⚠️ Seu navegador não suporta WebGPU ou não tem memória suficiente: ${suporte.motivo || 'Verificação falhou'}`;
      }
      return;
    }
  } catch (err) {
    console.warn('Erro ao verificar suporte WebGPU:', err);
  }

  // Configura estado inicial do switch
  toggleLocalIA.checked = Boolean(configAtual.ativo);
  if (statusLocalIA) {
    statusLocalIA.textContent = configAtual.ativo ? 'Ativado' : 'Desativado';
  }

  // Manipulador de clique no switch
  toggleLocalIA.addEventListener('change', (e) => {
    const ativando = e.target.checked;

    if (!suportadoWebGPU) {
      e.target.checked = false;
      if (alertaWebGPU) alertaWebGPU.classList.remove('hidden');
      return;
    }

    if (ativando) {
      // Reverte temporariamente até confirmar o download
      toggleLocalIA.checked = false;
      if (alertaDownload) {
        alertaDownload.classList.remove('hidden');
      }
    } else {
      // Desativa diretamente
      salvarConfig({ ativo: false });
      if (statusLocalIA) statusLocalIA.textContent = 'Desativado';
    }
  });

  if (btnCancelarDownload) {
    btnCancelarDownload.addEventListener('click', () => {
      if (alertaDownload) alertaDownload.classList.add('hidden');
      toggleLocalIA.checked = false;
    });
  }

  if (btnConfirmarDownload) {
    btnConfirmarDownload.addEventListener('click', () => {
      if (alertaDownload) alertaDownload.classList.add('hidden');
      toggleLocalIA.checked = true;
      salvarConfig({ ativo: true });
      if (statusLocalIA) statusLocalIA.textContent = 'Ativado';
    });
  }
});
