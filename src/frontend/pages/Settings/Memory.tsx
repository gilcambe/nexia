import React, { useState, useEffect, useCallback } from 'react';
import { useMemory } from '../../api/memoryClient';
import { MemoryItem as MemoryItemType } from '../../api/memoryClient';
import { MemoryItem as MemoryItemComponent } from '../../components/MemoryItem';

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
  const [offlineAiEnabled, setOfflineAiEnabled] = useState(false);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [offlineErrorModal, setOfflineErrorModal] = useState<string | null>(null);

  const handleOfflineAiToggle = () => {
    if (offlineAiEnabled) {
      setOfflineAiEnabled(false);
      return;
    }

    // Verificar suporte a WebGPU e memória
    const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
    // @ts-ignore
    const deviceMemory = typeof navigator !== 'undefined' && navigator.deviceMemory ? navigator.deviceMemory : 4;

    if (!hasWebGPU || deviceMemory < 4) {
      setOfflineErrorModal(
        !hasWebGPU
          ? 'Seu navegador ou dispositivo não suporta WebGPU, necessário para rodar a IA localmente.'
          : 'Seu dispositivo possui menos de 4 GB de memória RAM, o que pode ser insuficiente para rodar o modelo local (~1 GB).'
      );
      return;
    }

    // Exibir aviso de download de ~1 GB com recomendação de Wi-Fi
    setShowOfflineModal(true);
  };

  const confirmOfflineAi = () => {
    setOfflineAiEnabled(true);
    setShowOfflineModal(false);
  };

  const closeOfflineErrorModal = () => {
    setOfflineErrorModal(null);
  };

  const closeOfflineModal = () => {
    setShowOfflineModal(false);
  };





  const handleReload = useCallback(() => {
    loadMemory();
  }, [loadMemory]);

  const handleToggleRememberMe = useCallback((newValue: boolean) => {
    toggleRememberMe(newValue);
  }, [toggleRememberMe]);

  const handleDeleteAll = useCallback(async () => {
    if (window.confirm('Tem certeza que deseja apagar todos os seus fatos? Esta ação é irreversível.')) {
      setIsDeletingAll(true);
      await deleteAllItems();
      setIsDeletingAll(false);
    }
  }, [deleteAllItems]);

  const handleDeleteItem = useCallback(async (id: string) => {
    if (window.confirm('Tem certeza que deseja apagar este fato?')) {
      await deleteItem(id);
    }
  }, [deleteItem]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Configurações</h1>
        <p className="text-[var(--cx-mut)]">
          Gerencie suas preferências de memória e privacidade.
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
      </div>

      {/* Seção de IA Offline */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">IA no meu aparelho (grátis, offline)</h2>
        <div className="bg-[var(--cx-card)] border border-[var(--cx-line)] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium">Rodar a IA localmente</h3>
              <p className="text-sm text-[var(--cx-mut)] mt-1">
                Execute o modelo localmente no seu navegador. Requer WebGPU e cerca de 4 GB de memória RAM. Modelo ~1 GB.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--cx-mut)]">
                {offlineAiEnabled ? 'Ativado' : 'Desativado'}
              </span>
              <button
                onClick={handleOfflineAiToggle}
                disabled={offlineAiEnabled || !hasWebGPUSupport() || !hasMemorySupport()}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${offlineAiEnabled ? 'bg-[var(--cx-ac)]' : !hasWebGPUSupport() || !hasMemorySupport() ? 'bg-[var(--cx-line)] opacity-50 cursor-not-allowed' : 'bg-[var(--cx-line)]'}`}
                data-testid="offline-ai-toggle"
                role="switch"
                aria-checked={offlineAiEnabled}
                aria-label="IA no meu aparelho"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${offlineAiEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
          </div>
          <div className="text-xs text-[var(--cx-mut)] mt-4">
            <p>⚠️ Ao ativar, será necessário baixar o modelo (~1 GB). Recomendado fazer em Wi-Fi.</p>
          </div>
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

            <li>Seus fatos são armazenados de forma segura e usados apenas para melhorar as interações com o Cortex.</li>
            <li>Você tem controle total sobre seus dados através desta página.</li>
            <li>A exclusão de fatos é irreversível e segue os princípios da LGPD.</li>
            <li>Os dados são processados no Brasil, conforme legislação vigente.</li>
          </ul>
        </div>
      </div>

      {/* Modal de erro para suporte insuficiente */}
      {offlineErrorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--cx-card)] border border-[var(--cx-line)] rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Não é possível ativar a IA offline</h3>
            <p className="text-[var(--cx-text)] mb-6">{offlineErrorModal}</p>
            <div className="flex justify-end">
              <button
                onClick={closeOfflineErrorModal}
                className="px-4 py-2 bg-[var(--cx-ac)] text-white rounded-lg hover:bg-[var(--cx-ac)]/80 transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de aviso de download */}
      {showOfflineModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--cx-card)] border border-[var(--cx-line)] rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Ativar IA offline</h3>
            <p className="text-[var(--cx-text)] mb-4">
              Ao ativar a IA offline, será necessário baixar o modelo local (~1 GB) para seu dispositivo.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800">
                <strong>Recomendação:</strong> Faça o download em uma rede Wi-Fi para evitar o uso excessivo de dados móveis.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={closeOfflineModal}
                className="flex-1 px-4 py-2 border border-[var(--cx-line)] rounded-lg hover:border-[var(--cx-ac)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmOfflineAi}
                className="flex-1 px-4 py-2 bg-[var(--cx-ac)] text-white rounded-lg hover:bg-[var(--cx-ac)]/80 transition-colors"
              >
                Confirmar e Baixar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
