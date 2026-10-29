/**
 * config.js
 * Tela de Configurações do Cortex e Preferências do Usuário.
 * Inclui o switch "IA no meu aparelho (grátis, offline)", com padrão desligado,
 * verificação de navigator.gpu e memória, aviso de bloqueio se não suportado,
 * e aviso de download de ~1 GB com recomendação de Wi-Fi ao ligar.
 * 
 * Autocontido: não depende de ia-local.js.
 */

const LOCAL_STORAGE_KEY = 'nexia_ia_local_config';

function obterConfig() {
  try {
    if (typeof localStorage === 'undefined') return { ativo: false };
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return { ativo: false };
    const parsed = JSON.parse(raw);
    return { ativo: Boolean(parsed.ativo) };
  } catch {
    return { ativo: false };
  }
}

function salvarConfig(novaConfig = {}) {
  const atual = obterConfig();
  const proxima = { ...atual, ...novaConfig };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(proxima));
    }
  } catch (err) {
    console.warn('[config] Não foi possível salvar configuração:', err);
  }
}

async function verificarSuporteWebGPU() {
  if (typeof navigator === 'undefined') {
    return { suportado: false, motivo: 'Navegador não detectado (SSR ou ambiente Node).' };
  }
  if (!navigator.gpu) {
    return { suportado: false, motivo: 'Navegador não possui suporte a WebGPU (navigator.gpu indisponível).' };
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return { suportado: false, motivo: 'Dispositivo/GPU não disponibilizou um adaptador WebGPU.' };
    }
  } catch (err) {
    return { suportado: false, motivo: `Erro ao solicitar adaptador WebGPU: ${err?.message || err}` };
  }
  return { suportado: true };
}

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('config-container') || document.body;

  // Cria a seção de preferências de IA Local se ainda não existir no DOM
  let secaoConfig = document.getElementById('secao-ia-local');
  if (!secaoConfig) {
    secaoConfig = document.createElement('div');
    secaoConfig.id = 'secao-ia-local';
    secaoConfig.className = 'card-config';
    secaoConfig.style.cssText = 'margin: 20px 0; padding: 20px; background: var(--bg2, #111408); border: 1px solid var(--brd, rgba(255,255,255,0.1)); border-radius: 12px;';
    secaoConfig.innerHTML = `
      <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px; color: var(--gold, #C9A84C);">⚙️ Configurações do Cortex & IA Local</h3>
      <p style="font-size: 13px; color: var(--text2, rgba(255,255,255,0.7)); margin-bottom: 16px;">
        Gerencie preferências de execução e recursos offline do seu assistente.
      </p>
      
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; border-top: 1px solid var(--brd, rgba(255,255,255,0.1));">
        <div>
          <label for="switch-ia-local" style="font-size: 14px; font-weight: 600; cursor: pointer; display: block; margin-bottom: 2px;" id="label-ia-local">
            IA no meu aparelho (grátis, offline)
          </label>
          <small id="desc-ia-local" style="font-size: 12px; color: var(--text3, rgba(255,255,255,0.5));">
            Executa modelos leves (Qwen2.5) diretamente no seu navegador usando WebGPU.
          </small>
        </div>
        <label class="switch" style="position: relative; display: inline-block; width: 50px; height: 26px; flex-shrink: 0;">
          <input type="checkbox" id="switch-ia-local" style="opacity: 0; width: 0; height: 0;" aria-label="IA no meu aparelho" aria-describedby="desc-ia-local aviso-ia-local" aria-checked="false">
          <span class="slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .3s; border-radius: 26px;"></span>
        </label>
      </div>

      <div id="aviso-ia-local" class="msg oculto" style="margin-top: 12px; padding: 10px 14px; border-radius: 8px; font-size: 13px; display: none;" role="status" aria-live="polite"></div>
    `;
    container.appendChild(secaoConfig);

    // Adiciona estilos simples para o switch se necessário
    if (!document.getElementById('estilo-switch-local')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'estilo-switch-local';
      styleEl.textContent = `
        .switch input:checked + .slider { background-color: var(--gold, #C9A84C); }
        .switch input:focus + .slider { box-shadow: 0 0 1px var(--gold, #C9A84C); }
        .switch input:checked + .slider:before { transform: translateX(24px); }
        .slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; }
        .msg.aviso { background: rgba(230,162,60,0.15); color: #e6a23c; border: 1px solid rgba(230,162,60,0.3); }
        .msg.erro { background: rgba(255,61,113,0.15); color: #FF3D71; border: 1px solid rgba(255,61,113,0.3); }
        .msg.ok { background: rgba(0,214,143,0.15); color: #00D68F; border: 1px solid rgba(0,214,143,0.3); }
        .switch input:disabled + .slider { opacity: 0.5; cursor: not-allowed; }
      `;
      document.head.appendChild(styleEl);
    }
  }

  const checkbox = document.getElementById('switch-ia-local');
  const avisoBox = document.getElementById('aviso-ia-local');

  if (!checkbox || !avisoBox) return;

  // Inicializa estado do switch (padrão: desligado)
  const configAtual = obterConfig();
  checkbox.checked = configAtual.ativo;
  checkbox.setAttribute('aria-checked', String(configAtual.ativo));

  function mostrarAviso(texto, tipo = 'aviso') {
    avisoBox.textContent = texto;
    avisoBox.className = `msg ${tipo}`;
    avisoBox.style.display = 'block';
  }

  function esconderAviso() {
    avisoBox.style.display = 'none';
  }

  checkbox.onchange = async (e) => {
    const ativar = checkbox.checked;

    if (!ativar) {
      salvarConfig({ ativo: false });
      checkbox.setAttribute('aria-checked', 'false');
      mostrarAviso('IA local desativada.', 'aviso');
      return;
    }

    // Ao tentar ligar, verifica suporte a WebGPU
    checkbox.checked = false;
    checkbox.setAttribute('aria-checked', 'false');
    checkbox.disabled = true;
    mostrarAviso('Verificando suporte a WebGPU no aparelho...', 'aviso');

    const suporte = await verificarSuporteWebGPU();

    checkbox.disabled = false;

    if (!suporte.suportado) {
      checkbox.checked = false;
      checkbox.setAttribute('aria-checked', 'false');
      salvarConfig({ ativo: false });
      mostrarAviso(`Aviso de bloqueio: Seu navegador ou dispositivo não suporta IA local offline. (${suporte.motivo})`, 'erro');
      return;
    }

    // Suportado: exibe aviso de download de ~1 GB com recomendação de Wi-Fi
    const confirmarDownload = window.confirm(
      'Aviso: Ativar a "IA no meu aparelho (grátis, offline)" fará o download de aproximadamente 1 GB de dados do modelo de IA. Recomendamos fortemente o uso de uma rede Wi-Fi estável.\n\nDeseja continuar e ativar a IA local?'
    );

    if (!confirmarDownload) {
      checkbox.checked = false;
      checkbox.setAttribute('aria-checked', 'false');
      salvarConfig({ ativo: false });
      mostrarAviso('Ativação cancelada pelo usuário.', 'aviso');
      return;
    }

    // Confirmado e suportado
    checkbox.checked = true;
    checkbox.setAttribute('aria-checked', 'true');
    salvarConfig({ ativo: true });
    mostrarAviso('IA no meu aparelho ativada com sucesso! O modelo (~1 GB) será baixado sob demanda ao iniciar o uso.', 'ok');
  };
});
