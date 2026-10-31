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
  const [localIAEnabled, setLocalIAEnabled] = useState(false);
  const [webGpuSupported, setWebGpuSupported] = useState(true);
  const [showDownloadWarning, setShowDownloadWarning] = useState(false);

  useEffect(() => {
    async function checkSupport() {
      try {
        const gpu = (navigator as Navigator & { gpu?: unknown }).gpu;
        const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
        if (!gpu || (memory && memory < 4)) {
          setWebGpuSupported(false);
        }
      } catch {
        setWebGpuSupported(false);
      }
    }
    checkSupport();
  }, []);

  const handleToggleLocalIA = () => {
    if (!webGpuSupported) return;
    if (localIAEnabled) {
      setLocalIAEnabled(false);
    } else {
      setShowDownloadWarning(true);
    }
  };

  const handleConfirmDownload = () => {
    setLocalIAEnabled(true);
    setShowDownloadWarning(false);
  };

  const handleCancelDownload = () => {
    setShowDownloadWarning(false);
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

      {/* Seção IA no meu aparelho */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">IA Local</h2>
        <div className="bg-[var(--cx-card)] border border-[var(--cx-line)] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium">IA no meu aparelho (grátis, offline)</h3>
              <p className="text-sm text-[var(--cx-mut)] mt-1">
                Execute o Cortex diretamente no seu dispositivo para respostas mais rápidas e privacidade total.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--cx-mut)]">
                {localIAEnabled ? 'Ativado' : 'Desativado'}
              </span>
              <button
                onClick={handleToggleLocalIA}
                disabled={!webGpuSupported}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${localIAEnabled ? 'bg-[var(--cx-ac)]' : 'bg-[var(--cx-line)]'} ${!webGpuSupported ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                data-testid="local-ia-toggle"
                role="switch"
                aria-checked={localIAEnabled}
                aria-label="IA no meu aparelho"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localIAEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
          </div>

          {!webGpuSupported && (
            <div className="text-xs text-red-400 mt-2" data-testid="webgpu-blocked-warning">
              <p>⚠️ Seu navegador não suporta WebGPU ou não tem memória suficiente. Funcionalidade bloqueada.</p>
            </div>
          )}

          {showDownloadWarning && !localIAEnabled && (
            <div className="text-xs text-yellow-400 mt-3 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20" data-testid="download-warning">
              <p className="font-medium mb-1">⬇️ Aviso de Download (~1 GB)</p>
              <p>Para ativar a IA local, será feito o download de um modelo de aproximadamente 1 GB. Recomendamos o uso de uma conexão Wi-Fi estável.</p>
              <div className="flex justify-end gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleCancelDownload}
                  className="px-3 py-1 text-xs border border-[var(--cx-line)] rounded-lg hover:border-[var(--cx-ac)] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDownload}
                  className="px-3 py-1 text-xs bg-[var(--cx-ac)] text-black font-semibold rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Confirmar Download
                </button>
              </div>
            </div>
          )}
        </div>
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
            <li>A funcionalidade de IA local processa dados diretamente no seu aparelho, sem envio para a nuvem.</li>
            <li>Seus fatos são armazenados de forma segura e usados apenas para melhorar as interações com o Cortex.</li>
            <li>Você tem controle total sobre seus dados através desta página.</li>
            <li>A exclusão de fatos é irreversível e segue os princípios da LGPD.</li>
            <li>Os dados são processados no Brasil, conforme legislação vigente.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
