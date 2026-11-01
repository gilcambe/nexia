// config.js - Configurações do Cortex e preferências de IA local
import { verificarSuporteWebGPU } from './ia-local.js';
import { salvarConfig, obterConfig } from './ia-local.js';

export const configManager = {
  async getIAState() {
    try {
      const config = obterConfig();
      return config.iaAparelhoAtivo;
    } catch {
      return false;
    }
  },
  async setIAState(ativo) {
    try {
      salvarConfig({ iaAparelhoAtivo: ativo });
    } catch {}
  }
};
/**
 * Renderiza o switch de IA local na tela de configurações
 * @param {string|HTMLElement} containerOuSeletor - Container onde inserir o controle
 */
export async function renderizarIALocal(containerOuSeletor) {
  const container = typeof containerOuSeletor === 'string' 
    ? document.querySelector(containerOuSeletor) 
    : containerOuSeletor;

  if (!container) return;

  const estadoAtual = await configManager.getIAState();
  const suporte = await verificarSuporteWebGPU();

  container.innerHTML = `
    <div class="ia-local-config" style="padding: 16px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); margin: 16px 0;">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
        <div>
          <h4 style="font-size: 16px; font-weight: 700; margin-bottom: 4px;">IA no meu aparelho (grátis, offline)</h4>
          <p style="font-size: 14px; color: rgba(255,255,255,0.7);">Execute modelos de IA diretamente no seu navegador com WebGPU.</p>
        </div>
        <label class="switch" style="position: relative; display: inline-block; width: 50px; height: 26px; flex-shrink: 0;">
          <input type="checkbox" id="ia-local-switch" aria-label="IA no meu aparelho (grátis, offline)" aria-describedby="ia-local-status" ${estadoAtual ? 'checked' : ''} ${!suporte.suportado ? 'disabled' : ''} style="opacity: 0; width: 0; height: 0;">
          <span class="slider" style="position: absolute; cursor: pointer; inset: 0; background-color: ${!suporte.suportado ? '#444' : '#ccc'}; transition: .4s; border-radius: 34px;"></span>
        </label>
      </div>

      <div id="ia-local-status" style="margin-top: 12px; font-size: 14px;">
        ${!suporte.suportado 
          ? `<div style="padding: 12px; border-radius: 8px; background: rgba(255,107,107,0.15); color: #ff6b6b; border: 1px solid rgba(255,107,107,0.3);">
               <strong>Bloqueado:</strong> Seu navegador ou dispositivo não suporta WebGPU (${suporte.motivo}). A IA local não pode ser ativada.
             </div>`
          : estadoAtual
            ? `<div style="padding: 12px; border-radius: 8px; background: rgba(42,122,78,0.2); color: #2A7A4E; border: 1px solid rgba(42,122,78,0.3);">
                 <strong>Ativo:</strong> IA local pronta para uso no aparelho.
               </div>`
            : `<div style="color: rgba(255,255,255,0.7);">Desativado. O modelo (~1 GB) será baixado ao ativar.</div>`
        }
      </div>
    </div>
  `;

  const inputSwitch = container.querySelector('#ia-local-switch');
  const statusDiv = container.querySelector('#ia-local-status');

  if (inputSwitch) {
    if (!suporte.suportado) {
      inputSwitch.addEventListener('click', (e) => {
        e.preventDefault();
        window.alert(`Bloqueado: Seu navegador ou dispositivo não suporta WebGPU (${suporte.motivo}). A IA local não pode ser ativada.`);
      });
    } else {
      inputSwitch.addEventListener('change', async (e) => {
        const ativando = e.target.checked;

        if (ativando) {
          const confirmar = window.confirm('Ativar a IA no aparelho?\n\nSerá feito o download de aproximadamente 1 GB de dados do modelo de IA.\nRecomendamos fortemente o uso de conexão Wi-Fi.');
          
          if (!confirmar) {
            e.target.checked = false;
            return;
          }

          await configManager.setIAState(true);
          if (statusDiv) {
            statusDiv.innerHTML = `
              <div style="padding: 12px; border-radius: 8px; background: rgba(230,162,60,0.15); color: #e6a23c; border: 1px solid rgba(230,162,60,0.3);">
                <strong>Baixando modelo (~1 GB)...</strong> Certifique-se de estar no Wi-Fi. Inicializando IA local...
              </div>
            `;
          }

          try {
            await simularDownload(statusDiv);
            
            if (statusDiv) {
              statusDiv.innerHTML = `
                <div style="padding: 12px; border-radius: 8px; background: rgba(42,122,78,0.2); color: #2A7A4E; border: 1px solid rgba(42,122,78,0.3);">
                  <strong>Sucesso!</strong> IA local ativada e modelo carregado no aparelho.
                </div>
              `;
            }
          } catch (err) {
            await configManager.setIAState(false);
            e.target.checked = false;
            if (statusDiv) {
              statusDiv.innerHTML = `
                <div style="padding: 12px; border-radius: 8px; background: rgba(255,107,107,0.15); color: #ff6b6b; border: 1px solid rgba(255,107,107,0.3);">
                  <strong>Erro ao carregar modelo:</strong> ${err?.message || err}
                </div>
              `;
            }
          }
        } else {
          await configManager.setIAState(false);
          if (statusDiv) {
            statusDiv.innerHTML = `
              <div style="color: rgba(255,255,255,0.7);">Desativado. O modelo (~1 GB) será baixado ao ativar.</div>
            `;
          }
        }
      });
    }
  }
}

/**
 * Simula o download do modelo com progresso
 * @param {HTMLElement} statusDiv - Elemento para exibir status
 */
async function simularDownload(statusDiv) {
  const duracao = 3000; // 3 segundos para simulação
  const passos = 20;
  const intervalo = duracao / passos;
  
  for (let i = 0; i <= passos; i++) {
    const progress = i / passos;
    const porcentagem = Math.round(progress * 100);
    
    if (statusDiv) {
      statusDiv.innerHTML = `
        <div style="padding: 12px; border-radius: 8px; background: rgba(230,162,60,0.15); color: #e6a23c; border: 1px solid rgba(230,162,60,0.3);">
          <strong>Baixando modelo (~1 GB):</strong> ${porcentagem}%
        </div>
      `;
    }
    
    await new Promise(resolve => setTimeout(resolve, intervalo));
  }
}

