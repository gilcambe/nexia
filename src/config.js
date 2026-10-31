// src/config.js
// Tela de Configuracoes do Cortex — preferencias do usuario.
// Inclui o switch 'IA no meu aparelho (grátis, offline)' com verificacao de WebGPU,
// aviso de bloqueio quando nao suportado e aviso de download (~1 GB, Wi-Fi) ao ativar.
import {
  obterConfig,
  salvarConfig,
  verificarSuporteWebGPU,
  renderizarConfiguracaoIALocal,
} from './ia-local.js';

/**
 * Renderiza a tela de Configuracoes do Cortex no container informado.
 * @param {string|HTMLElement} containerOuSeletor - Container ou seletor CSS onde montar a tela.
 */
export async function renderizarConfiguracoesCortex(containerOuSeletor) {
  const container =
    typeof containerOuSeletor === 'string'
      ? document.querySelector(containerOuSeletor)
      : containerOuSeletor;

  if (!container) return;

  const config = obterConfig();
  const suporte = await verificarSuporteWebGPU();

  const bloqueadoHtml = !suporte.suportado
    ? `
      <div class="cfg-aviso bloqueado" role="alert" aria-live="polite">
        <strong>Bloqueado:</strong> seu navegador ou dispositivo nao suporta WebGPU.
        ${suporte.motivo || ''}
      </div>
    `
    : '';

  const estadoInicial = config.ativo ? 'checked' : '';
  const desabilitado = !suporte.suportado ? 'disabled' : '';
  const corSlider = !suporte.suportado ? '#444' : '#ccc';

  container.innerHTML = `
    <div class="cfg-tela">
      <h2 class="cfg-titulo">Configuracoes do Cortex</h2>

      <section class="cfg-bloco">
        <h3 class="cfg-sub">IA no meu aparelho</h3>
        <p class="cfg-ajuda">Execute modelos de IA diretamente no seu navegador, sem usar a nuvem.</p>

        <div class="check-linha" style="margin-top:12px">
          <label class="switch" style="display:inline-flex;align-items:center;gap:10px;cursor:${!suporte.suportado ? 'not-allowed' : 'pointer'};">
            <input
              type="checkbox"
              id="ia-local-switch"
              ${estadoInicial}
              ${desabilitado}
              style="opacity:0;width:0;height:0;"
              aria-label="IA no meu aparelho (grátis, offline)"
              aria-checked="${config.ativo}"
              title="${!suporte.suportado ? 'Nao suportado por este navegador' : ''}"
            />
            <span
              class="slider"
              style="position:relative;display:inline-block;width:50px;height:26px;background-color:${corSlider};border-radius:34px;transition:.4s;flex-shrink:0;"
            ></span>
            <span style="font-size:14px;font-weight:600;">IA no meu aparelho (grátis, offline)</span>
          </label>
        </div>

        ${bloqueadoHtml}

        <div id="ia-local-status-msg" style="margin-top:12px;font-size:13px;">
          ${!suporte.suportado
            ? `
              <div style="padding:10px;border-radius:8px;background:rgba(255,107,107,0.15);color:#ff6b6b;border:1px solid rgba(255,107,107,0.3);">
                <strong>Bloqueado:</strong> IA local nao pode ser ativada sem suporte a WebGPU.
              </div>
            `
            : config.ativo
              ? `
                <div style="padding:10px;border-radius:8px;background:rgba(42,122,78,0.2);color:#2A7A4E;border:1px solid rgba(42,122,78,0.3);">
                  <strong>Ativo:</strong> IA local pronta para uso no aparelho.
                </div>
              `
              : `
                <div style="color:var(--suave,#aaa);">Desativado. O modelo (~1 GB) sera baixado ao ativar.</div>
              `}
        </div>
      </section>
    </div>
  `;

  const inputSwitch = container.querySelector('#ia-local-switch');
  const statusMsg = container.querySelector('#ia-local-status-msg');

  if (inputSwitch && suporte.suportado) {
    inputSwitch.addEventListener('change', async (e) => {
      const ativando = e.target.checked;

      if (ativando) {
        const confirmar = window.confirm(
          'Ativar a IA no aparelho?\n\n' +
          'Sera feito o download de aproximadamente 1 GB de dados do modelo de IA.\n' +
          'Recomendamos fortemente o uso de conexao Wi-Fi.'
        );

        if (!confirmar) {
          e.target.checked = false;
          inputSwitch.setAttribute('aria-checked', 'false');
          return;
        }

        salvarConfig({ ativo: true });
        inputSwitch.setAttribute('aria-checked', 'true');

        if (statusMsg) {
          statusMsg.innerHTML = `
            <div style="padding:10px;border-radius:8px;background:rgba(230,162,60,0.15);color:#e6a23c;border:1px solid rgba(230,162,60,0.3);">
              <strong>Baixando modelo (~1 GB)...</strong> Certifique-se de estar no Wi-Fi. Inicializando IA local...
            </div>
          `;
        }

        try {
          const { inicializarEngine } = await import('./ia-local.js');
          await inicializarEngine(null, (prog) => {
            if (statusMsg) {
              const porcentagem = Math.round((prog?.progress || 0) * 100);
              statusMsg.innerHTML = `
                <div style="padding:10px;border-radius:8px;background:rgba(230,162,60,0.15);color:#e6a23c;border:1px solid rgba(230,162,60,0.3);">
                  <strong>Baixando modelo (~1 GB):</strong> ${prog?.text || `${porcentagem}%`}${porcentagem ? ` (${porcentagem}%)` : ''}
                </div>
              `;
            }
          });

          if (statusMsg) {
            statusMsg.innerHTML = `
              <div style="padding:10px;border-radius:8px;background:rgba(42,122,78,0.2);color:#2A7A4E;border:1px solid rgba(42,122,78,0.3);">
                <strong>Sucesso!</strong> IA local ativada e modelo carregado no aparelho.
              </div>
            `;
          }
        } catch (err) {
          salvarConfig({ ativo: false });
          inputSwitch.checked = false;
          inputSwitch.setAttribute('aria-checked', 'false');
          if (statusMsg) {
            statusMsg.innerHTML = `
              <div style="padding:10px;border-radius:8px;background:rgba(255,107,107,0.15);color:#ff6b6b;border:1px solid rgba(255,107,107,0.3);">
                <strong>Erro ao carregar modelo:</strong> ${err?.message || err}
              </div>
            `;
          }
        }
      } else {
        salvarConfig({ ativo: false });
        inputSwitch.setAttribute('aria-checked', 'false');
        if (statusMsg) {
          statusMsg.innerHTML = `
            <div style="color:var(--suave,#aaa);">Desativado. O modelo (~1 GB) sera baixado ao ativar.</div>
          `;
        }
      }
    });
  }
}

export { obterConfig, salvarConfig, verificarSuporteWebGPU };
