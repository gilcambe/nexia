/**
 * config.js
 * Tela de Configurações do Cortex com o switch "IA no meu aparelho (grátis, offline)".
 * Padrão: desligado. Verifica navigator.gpu e memória, exibindo aviso de bloqueio
 * se não suportado, e aviso de download de ~1 GB com recomendação de Wi-Fi ao ligar.
 */

import { obterConfig, salvarConfig, verificarSuporteWebGPU } from './ia-local.js';

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('config-cortex-container') || document.body;

  // Cria a seção de configurações de IA local se ainda não existir
  let secaoConfig = document.getElementById('ia-local-config-section');
  if (!secaoConfig) {
    secaoConfig = document.createElement('div');
    secaoConfig.id = 'ia-local-config-section';
    secaoConfig.style.cssText = 'background: var(--surface, #111408); border: 1px solid var(--linha, rgba(201,168,76,0.18)); border-radius: 12px; padding: 20px; margin: 20px auto; max-width: 800px; color: var(--texto, #F8F4ED); font-family: system-ui, sans-serif;';
    secaoConfig.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
        <div>
          <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
            <span>💻</span> IA no meu aparelho (grátis, offline)
          </h3>
          <p style="font-size: 13px; color: var(--suave, rgba(248,244,237,0.72)); max-width: 480px; line-height: 1.4;">
            Execute modelos de linguagem diretamente no seu navegador usando WebGPU. Funciona totalmente offline e sem custos.
          </p>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span id="ia-status-label" style="font-size: 12px; font-weight: 600; color: var(--suave);">Desligado</span>
          <button
            type="button"
            id="switch-ia-local"
            role="switch"
            aria-checked="false"
            aria-label="IA no meu aparelho (grátis, offline)"
            style="position: relative; display: inline-flex; height: 28px; width: 52px; flex-shrink: 0; cursor: pointer; rounded-full; border: 2px solid transparent; transition: background-color 0.2s ease; border-radius: 9999px; background-color: #374151; padding: 2px;"
          >
            <span
              id="switch-ia-thumb"
              style="pointer-events: none; display: inline-block; height: 20px; width: 20px; transform: translateX(0px); rounded-full; background-color: #ffffff; border-radius: 9999px; transition: transform 0.2s ease, background-color 0.2s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"
            ></span>
          </button>
        </div>
      </div>
      <div id="ia-aviso-container" style="margin-top: 12px; font-size: 12px; display: none; padding: 10px 14px; border-radius: 8px;"></div>
    `;
    container.appendChild(secaoConfig);
  }

  const switchBtn = document.getElementById('switch-ia-local');
  const switchThumb = document.getElementById('switch-ia-thumb');
  const statusLabel = document.getElementById('ia-status-label');
  const avisoContainer = document.getElementById('ia-aviso-container');

  // Carrega estado atual (padrão desligado)
  let configAtual = obterConfig();
  let ativo = Boolean(configAtual.ativo);

  function atualizarVisualSwitch(estaAtivo) {
    if (estaAtivo) {
      switchBtn.style.backgroundColor = 'var(--foco, #C9A84C)';
      switchThumb.style.transform = 'translateX(24px)';
      switchThumb.style.backgroundColor = '#0A0D08';
      statusLabel.textContent = 'Ligado';
      statusLabel.style.color = 'var(--foco, #C9A84C)';
      switchBtn.setAttribute('aria-checked', 'true');
    } else {
      switchBtn.style.backgroundColor = '#374151';
      switchThumb.style.transform = 'translateX(0px)';
      switchThumb.style.backgroundColor = '#ffffff';
      statusLabel.textContent = 'Desligado';
      statusLabel.style.color = 'var(--suave, rgba(248,244,237,0.72))';
      switchBtn.setAttribute('aria-checked', 'false');
    }
  }

  atualizarVisualSwitch(ativo);

  // Validação prévia de suporte WebGPU e memória
  let suporteCache = null;
  try {
    suporteCache = await verificarSuporteWebGPU();
  } catch (err) {
    suporteCache = { suportado: false, motivo: err?.message || 'Erro ao verificar WebGPU' };
  }

  // Se não suportado, exibe aviso de bloqueio imediato
  if (!suporteCache.suportado) {
    avisoContainer.style.display = 'block';
    avisoContainer.style.backgroundColor = 'var(--erro-f, rgba(255,107,107,0.15))';
    avisoContainer.style.border = '1px solid var(--erro, #ff6b6b)';
    avisoContainer.style.color = 'var(--texto, #F8F4ED)';
    avisoContainer.innerHTML = `<strong>⚠️ Recurso indisponível:</strong> ${suporteCache.motivo}. O seu navegador ou dispositivo não atende aos requisitos de WebGPU para rodar IA localmente.`;
    switchBtn.style.opacity = '0.5';
    switchBtn.style.cursor = 'not-allowed';
  }

  switchBtn.addEventListener('click', async () => {
    // Verifica suporte antes de alternar
    if (!suporteCache || !suporteCache.suportado) {
      alert(`Não é possível ativar a IA local: ${suporteCache?.motivo || 'WebGPU não suportado neste navegador.'}`);
      return;
    }

    const proximoEstado = !ativo;

    if (proximoEstado) {
      // Exibe aviso de download de ~1 GB com recomendação de Wi-Fi ao ligar
      const confirmarDownload = window.confirm(
        '⚠️ Aviso de Download (IA no Aparelho):\n\n' +
        'Ativar a IA local fará o download de aproximadamente 1 GB de dados do modelo (Qwen2.5) para o seu navegador.\n\n' +
        'Recomendamos o uso de uma rede Wi-Fi estável.\nDeseja prosseguir com a ativação?'
      );

      if (!confirmarDownload) {
        return;
      }
    }

    ativo = proximoEstado;
    atualizarVisualSwitch(ativo);
    salvarConfig({ ativo });

    if (ativo) {
      avisoContainer.style.display = 'block';
      avisoContainer.style.backgroundColor = 'var(--ok-f, rgba(42,122,78,0.2))';
      avisoContainer.style.border = '1px solid var(--ok, #2A7A4E)';
      avisoContainer.style.color = 'var(--texto, #F8F4ED)';
      avisoContainer.innerHTML = '✅ IA local ativada com sucesso. O modelo será carregado sob demanda na primeira utilização.';
    } else {
      avisoContainer.style.display = 'none';
    }
  });
});
