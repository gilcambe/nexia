import React, { useState, useEffect } from 'react';
import { obterConfig, salvarConfig, verificarSuporteWebGPU, MODELOS_SUPORTADOS } from './ia-local';

export default function ConfigLocalAI() {
  const [config, setConfig] = useState(() => obterConfig());
  const [verificando, setVerificando] = useState(false);
  const [modalAvisoDownload, setModalAvisoDownload] = useState(false);
  const [modalIncompativel, setModalIncompativel] = useState<{ aberto: boolean; motivo: string }>({ aberto: false, motivo: '' });
  const [suporteWebGPU, setSuporteWebGPU] = useState<{ suportado: boolean; motivo?: string } | null>(null);

  useEffect(() => {
    const atual = obterConfig();
    setConfig(atual);

    // Verifica suporte a WebGPU ao montar o componente
    verificarSuporteWebGPU().then(setSuporteWebGPU);
  }, []);

  const handleToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const novoAtivo = e.target.checked;

    if (novoAtivo) {
      setVerificando(true);
      try {
        const suporte = await verificarSuporteWebGPU();
        if (!suporte.suportado) {
          setModalIncompativel({
            aberto: true,
            motivo: suporte.motivo || 'Seu navegador ou dispositivo não possui suporte completo a WebGPU ou memória recomendada.'
          });
          setVerificando(false);
          return;
        }

        // Se suportado, exibe aviso de download de ~1 GB com recomendação de Wi-Fi
        setModalAvisoDownload(true);
      } catch (err: any) {
        setModalIncompativel({
          aberto: true,
          motivo: err?.message || 'Erro ao verificar suporte a WebGPU.'
        });
      } finally {
        setVerificando(false);
      }
    } else {
      const atualizado = salvarConfig({ ativo: false });
      setConfig(atualizado);
    }
  };

  const confirmarDownloadEAtivar = () => {
    const atualizado = salvarConfig({ ativo: true });
    setConfig(atualizado);
    setModalAvisoDownload(false);
  };

  const cancelarDownload = () => {
    setModalAvisoDownload(false);
  };

  const mudarModelo = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const modelo = e.target.value;
    const atualizado = salvarConfig({ modelo });
    setConfig(atualizado);
  };

  return (
    <div className="bg-[var(--cx-card,#111408)] border border-[var(--cx-line,rgba(201,168,76,0.18))] rounded-xl p-6 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-[var(--cx-text,#F8F4ED)] flex items-center gap-2">
            <span>⚡</span> IA no meu aparelho (grátis, offline)
          </h3>
          <p className="text-sm text-[var(--cx-mut,rgba(248,244,237,0.72))] mt-1">
            Execute modelos de linguagem diretamente no seu navegador usando WebGPU, sem enviar seus dados para a nuvem.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {verificando && (
            <span className="text-xs text-[var(--cx-ac,#C9A84C)] animate-pulse">Verificando GPU...</span>
          )}
          <span className="text-sm text-[var(--cx-mut,rgba(248,244,237,0.72))]">
            {config.ativo ? 'Ativado' : 'Desativado'}
          </span>
          <label className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={config.ativo}
              onChange={handleToggle}
              disabled={verificando || (suporteWebGPU && !suporteWebGPU.suportado)}
              className="sr-only peer"
              aria-label="IA no meu aparelho (grátis, offline)"
              data-testid="switch-ia-local"
            />
            <span className={`inline-block h-6 w-11 rounded-full transition-colors ${config.ativo ? 'bg-[var(--cx-ac,#C9A84C)]' : 'bg-[var(--cx-line,rgba(201,168,76,0.18))]'} peer-focus:outline-none`} />
            <span
              className={`absolute left-1 top-1 h-4 w-4 transform rounded-full bg-white transition-transform ${config.ativo ? 'translate-x-6' : 'translate-x-0'}`}
            />
          </label>
        </div>
      </div>

      {config.ativo && (
        <div className="mt-4 pt-4 border-t border-[var(--cx-line,rgba(201,168,76,0.18))] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <label htmlFor="select-modelo-ia" className="block text-xs font-semibold text-[var(--cx-mut,rgba(248,244,237,0.72))] uppercase tracking-wider mb-1">
              Modelo Local WebLLM
            </label>
            <select
              id="select-modelo-ia"
              value={config.modelo}
              onChange={mudarModelo}
              className="px-3 py-2 bg-[var(--bg3,#0E1220)] border border-[var(--cx-line,rgba(201,168,76,0.18))] rounded-lg text-sm text-[var(--cx-text,#F8F4ED)] focus:border-[var(--cx-ac,#C9A84C)]"
            >
              <option value={MODELOS_SUPORTADOS.PEQUENO}>Qwen2.5-0.5B (Mais leve, ~350MB)</option>
              <option value={MODELOS_SUPORTADOS.GRANDE}>Qwen2.5-1.5B (Melhor qualidade, ~1GB)</option>
            </select>
          </div>
          <div className="text-xs text-[var(--cx-mut,rgba(248,244,237,0.72))]">
            🟢 Modo estritamente offline ativo. Sem custos de API.
          </div>
        </div>
      )}

      {/* Modal de Aviso de Download */}
      {modalAvisoDownload && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-[var(--cx-card,#111408)] border border-[var(--cx-ac,#C9A84C)] rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h4 className="text-lg font-bold text-[var(--cx-text,#F8F4ED)] mb-2 flex items-center gap-2">
              <span>📥</span> Download de Modelo IA (~1 GB)
            </h4>
            <p className="text-sm text-[var(--cx-mut,rgba(248,244,237,0.72))] mb-4 leading-relaxed">
              Para rodar a IA diretamente no seu aparelho, é necessário baixar os pesos do modelo (cerca de <strong>1 GB</strong>). Recomendamos fortemente o uso de uma rede <strong>Wi-Fi</strong> estável para evitar o consumo de dados móveis.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={cancelarDownload}
                className="px-4 py-2 text-sm border border-[var(--cx-line,rgba(201,168,76,0.18))] rounded-lg hover:border-[var(--cx-ac,#C9A84C)] text-[var(--cx-text,#F8F4ED)] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarDownloadEAtivar}
                className="px-4 py-2 text-sm bg-[var(--cx-ac,#C9A84C)] text-black font-semibold rounded-lg hover:opacity-90 transition-opacity"
              >
                Baixar e Ativar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Incompatibilidade (WebGPU / Memória) */}
      {modalIncompativel.aberto && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-[var(--cx-card,#111408)] border border-red-500/50 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h4 className="text-lg font-bold text-red-400 mb-2 flex items-center gap-2">
              <span>⚠️</span> WebGPU não suportado
            </h4>
            <p className="text-sm text-[var(--cx-mut,rgba(248,244,237,0.72))] mb-4 leading-relaxed">
              Não foi possível ativar a IA no seu aparelho. {modalIncompativel.motivo}
            </p>
            <div className="text-xs text-[var(--cx-mut,rgba(248,244,237,0.72))] mb-4 bg-black/20 p-3 rounded-lg">
              Certifique-se de usar um navegador moderno (como Google Chrome ou Microsoft Edge atualizados) com suporte a WebGPU habilitado nas configurações de hardware.
            </div>
            <div className="flex justify-end">
                              <button
                type="button"
                onClick={() => setModalIncompativel({ aberto: false, motivo: '' })}
                className="px-4 py-2 text-sm bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors font-semibold"
                aria-label="Fechar aviso de incompatibilidade WebGPU"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
