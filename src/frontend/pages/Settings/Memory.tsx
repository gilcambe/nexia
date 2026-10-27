import React, { useState, useEffect } from 'react';
import { useMemory } from '../../api/memoryClient';
import { MemoryItem as MemoryItemType } from '../../api/memoryClient';
import { MemoryItem as MemoryItemComponent } from '../../components/MemoryItem';
import { obterConfig, salvarConfig, verificarSuporteWebGPU, inicializarEngine } from '../../../ia-local';

type MemoryItemProps = MemoryItemType & {
  onDelete: (id: string) => void;
};

export default function MemorySettings() {
  const { 
    memoryItems, 
    loading, 
    error, 
    profile, 
    deleteItem, 
    deleteAllItems, 
    toggleRememberMe,
    loadMemory
  } = useMemory();

  const [isDeletingAll, setIsDeletingAll] = useState(false);

  /* IA no meu aparelho (grátis, offline) */
  const configIaLocal = obterConfig();
  const [iaLocalAtivo, setIaLocalAtivo] = useState(configIaLocal.ativo);
  const [bloqueado, setBloqueado] = useState(false);
  const [motivoBloqueio, setMotivoBloqueio] = useState('');
  const [baixando, setBaixando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [confirmandoDownload, setConfirmandoDownload] = useState(false);
  const [erroIaLocal, setErroIaLocal] = useState('');

  useEffect(() => {
    const cfg = obterConfig();
    setIaLocalAtivo(cfg.ativo);
  }, []);

  const handleToggleIaLocal = async (querLigar: boolean) => {
    if (!querLigar) {
      salvarConfig({ ativo: false });
      setIaLocalAtivo(false);
      setBaixando(false);
      setConfirmandoDownload(false);
      setErroIaLocal('');
      return;
    }

    const suporte = await verificarSuporteWebGPU();
    if (!suporte.suportado) {
      setBloqueado(true);
      setMotivoBloqueio(suporte.motivo || 'WebGPU não suportado neste dispositivo.');
      setIaLocalAtivo(false);
      return;
    }

    setBloqueado(false);
    setMotivoBloqueio('');
    setConfirmandoDownload(true);
  };

  const handleConfirmarDownload = async () => {
    setBaixando(true);
    setConfirmandoDownload(false);
    setErroIaLocal('');
    try {
      const config = obterConfig();
      await inicializarEngine(config.modelo, (report) => {
        setProgresso(Math.round((report.progress || 0) * 100));
      });
      salvarConfig({ ativo: true });
      setIaLocalAtivo(true);
    } catch (err) {
      setErroIaLocal(err?.message || 'Falha ao baixar o modelo de IA.');
      setIaLocalAtivo(false);
    } finally {
      setBaixando(false);
      setProgresso(0);
    }
  };

  const handleCancelarDownload = () => {
    setConfirmandoDownload(false);
    setBloqueado(false);
    setIaLocalAtivo(false);
  };

  const handleDeleteItem = (id: string) => {
    deleteItem(id);
  };

  const handleDeleteAll = async () => {
    setIsDeletingAll(true);
    try {
      await deleteAllItems();
    } catch {
      // deleteAllItems já define o erro via useMemory
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleToggleRememberMe = (enabled: boolean) => {
    toggleRememberMe(enabled);
  };

  const handleReload = () => {
    loadMemory();
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Configurações de Memória</h1>
        <p className="text-[var(--cx-mut)]">
          Gerencie os fatos armazenados pelo Cortex e suas preferências de privacidade.
        </p>
      </div>

      {/* Seção de privacidade */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Privacidade</h2>
        <div className="bg-[var(--cx-card)] border border-[var(--cx-line)] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium">Lembrar de mim</h3>
              <p className="text-sm text-[var(--cx-mut)] mt-1">
                Quando ativado, o Cortex pode usar seus fatos anteriores para melhorar suas respostas.
                Desative para maior privacidade, seguindo a LGPD.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--cx-mut)]">
                {profile.rememberMe ? 'Ativado' : 'Desativado'}
              </span>
              <button
                onClick={() => handleToggleRememberMe(!profile.rememberMe)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${profile.rememberMe ? 'bg-[var(--cx-ac)]' : 'bg-[var(--cx-line)]'}`}
                data-testid="memory-remember-me-toggle"
                role="switch"
                aria-checked={profile.rememberMe}
                aria-label="Lembrar de mim"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${profile.rememberMe ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
          </div>
          <div className="text-xs text-[var(--cx-mut)] mt-4">
            <p>⚠️ Ao desativar, novos fatos não serão armazenados, mas os existentes permanecerão até serem excluídos manualmente.</p>
          </div>
        </div>
      {/* Seção IA no meu aparelho (grátis, offline) */}
      <div className="mb-8">
        <div className="bg-[var(--cx-card)] border border-[var(--cx-line)] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium">IA no meu aparelho (grátis, offline)</h3>
              <p className="text-sm text-[var(--cx-mut)] mt-1">
                Roda a IA localmente no seu navegador, sem enviar dados para a nuvem. Requer navegador com WebGPU.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--cx-mut)]">
                {iaLocalAtivo ? 'Ativado' : 'Desativado'}
              </span>
              <button
                onClick={() => handleToggleIaLocal(!iaLocalAtivo)}
                disabled={bloqueado || baixando}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${iaLocalAtivo ? 'bg-[var(--cx-ac)]' : 'bg-[var(--cx-line)]'} ${(bloqueado || baixando) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                data-testid="settings-ia-local-toggle"
                role="switch"
                aria-checked={iaLocalAtivo}
                aria-label="IA no meu aparelho (grátis, offline)"
                aria-disabled={bloqueado || baixando}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${iaLocalAtivo ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
          </div>

          {bloqueado && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <p className="text-amber-800 text-sm font-medium">⚠️ Bloqueado</p>
              <p className="text-amber-700 text-sm mt-1">{motivoBloqueio}</p>
            </div>
          )}

          {!bloqueado && !iaLocalAtivo && !baixando && !confirmandoDownload && (
            <p className="text-xs text-[var(--cx-mut)] mt-4">
              Padrão: desligado. Ative para usar a IA localmente.
            </p>
          )}

          {confirmandoDownload && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-blue-800 text-sm font-medium">📥 Download do modelo (~1 GB)</p>
              <p className="text-blue-700 text-sm mt-1">
                Recomendamos usar Wi-Fi para evitar consumo da franquia de dados móveis.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleConfirmarDownload}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Iniciar download
                </button>
                <button
                  onClick={handleCancelarDownload}
                  className="px-3 py-1.5 text-sm border border-[var(--cx-line)] rounded hover:bg-[var(--cx-line)] transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {baixando && (
            <div className="bg-[var(--cx-card)] border border-[var(--cx-line)] rounded-lg p-4 mb-4">
              <p className="text-sm text-[var(--cx-mut)] font-medium">Baixando modelo de IA...</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="bg-[var(--cx-ac)] h-2 rounded-full"
                  style={{ width: `${Math.max(progresso, 0)}%` }}
                />
              </div>
              <p className="text-xs text-[var(--cx-mut)] mt-1">{progresso}%</p>
            </div>
          )}

          {erroIaLocal && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm">⚠️ {erroIaLocal}</p>
            </div>
          )}
        </div>
      </div>

      {/* Seção de fatos */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Seus Fatos</h2>
          <div className="flex gap-2">
            <button
              onClick={handleReload}
              className="px-4 py-2 text-sm border border-[var(--cx-line)] rounded-lg hover:border-[var(--cx-ac)] transition-colors"
              data-testid="memory-reload"
            >
              Atualizar
            </button>
            <button
              onClick={handleDeleteAll}
              disabled={isDeletingAll || memoryItems.length === 0}
              className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-40 transition-colors"
              data-testid="memory-delete-all"
            >
              {isDeletingAll ? 'Apagando...' : 'Apagar tudo'}
            </button>
          </div>
        </div>

        {loading && (
          <div className="bg-[var(--cx-card)] border border-[var(--cx-line)] rounded-xl p-6">
            <p className="text-center text-[var(--cx-mut)]">Carregando seus fatos...</p>
          </div>
        )}

        {error && (
          <div className="bg-[var(--cx-card)] border border-[var(--cx-line)] rounded-xl p-6">
            <div className="flex items-center justify-between">
              <p className="text-red-400">Erro ao carregar fatos: {error}</p>
              <button
                onClick={handleReload}
                className="px-3 py-1 text-sm border border-[var(--cx-line)] rounded-lg hover:border-[var(--cx-ac)] transition-colors"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        )}

        {!loading && !error && memoryItems.length === 0 && (
          <div className="bg-[var(--cx-card)] border border-[var(--cx-line)] rounded-xl p-6">
            <p className="text-center text-[var(--cx-mut)]">
              Nenhum fato armazenado. {profile.rememberMe && 'O Cortex continuará armazenando novos fatos enquanto esta opção estiver ativada.'}
            </p>
          </div>
        )}

        {!loading && !error && memoryItems.length > 0 && (
          <div className="space-y-3">
            {memoryItems.map((item) => (
              <MemoryItemComponent
                key={item.id}
                id={item.id}
                content={item.content}
                timestamp={item.timestamp}
                onDelete={handleDeleteItem}
              />
            ))}
          </div>
        )}
      </div>

      {/* Rodapé com informações LGPD */}
      <div className="mt-8 pt-6 border-t border-[var(--cx-line)]">
        <div className="text-sm text-[var(--cx-mut)] space-y-2">
          <p>📋 <strong>Informações de privacidade (LGPD):</strong></p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Seus fatos são armazenados de forma segura e usados apenas para melhorar as interações com o Cortex</li>
            <li>Você tem controle total sobre seus dados através desta página</li>
            <li>A exclusão de fatos é irreversível e segue os princípios da LGPD</li>
            <li>Os dados são processados no Brasil, conforme legislação vigente</li>
          </ul>
        </div>
      </div>
    </div>
  );
}