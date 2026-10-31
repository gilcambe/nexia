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
  const [isLocalIAEnabled, setIsLocalIAEnabled] = useState(false); // Novo estado
  const [isWebGpuSupported, setIsWebGpuSupported] = useState(false); // Novo estado
  const [showDownloadWarning, setShowDownloadWarning] = useState(false); // Novo estado

  // Funções existentes para que o find/replace funcione sem reescrever tudo
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


  useEffect(() => {
    // Verifica suporte a WebGPU e memória
    const checkWebGpuSupport = async () => {
      if ('gpu' in navigator && 'requestAdapter' in (navigator as any).gpu) {
        const adapter = await (navigator as any).gpu.requestAdapter();
        if (adapter) {
          // Exemplo de verificação de memória mínima (ajuste conforme a necessidade real)
          // `deviceMemory` não é padrão WebGPU, mas é uma heurística comum para recursos
          // Para um modelo de ~1GB, talvez 2GB ou 4GB de memória de dispositivo seja um bom mínimo.
          const deviceMemory = (navigator as any).deviceMemory || 0;
          // Considerando que um modelo de 1GB precisa de memória RAM e GPU,
          // um mínimo de 2GB de RAM é um ponto de partida.
          if (deviceMemory >= 2) { 
            setIsWebGpuSupported(true);
          } else {
            console.warn('WebGPU é suportado, mas a memória do dispositivo é insuficiente (< 2GB).');
          }
        } else {
          console.warn('WebGPU não conseguiu obter um adaptador.');
        }
      } else {
        console.warn('WebGPU não é suportado neste navegador.');
      }
    };
    checkWebGpuSupport();
  }, []);

  const handleToggleLocalIA = useCallback(() => {
    if (!isWebGpuSupported) {
      alert('Seu navegador não suporta WebGPU ou não tem memória suficiente para esta funcionalidade. Por favor, atualize seu navegador ou use um dispositivo compatível.');
      return;
    }

    if (!isLocalIAEnabled) { // Tentando ativar
      setShowDownloadWarning(true);
      // O usuário precisará confirmar o download no modal/alerta que será exibido por `showDownloadWarning`
      // Por enquanto, apenas exibimos o aviso. A ativação real acontece após a confirmação.
    } else { // Desativando
      setIsLocalIAEnabled(false);
      setShowDownloadWarning(false);
    }
  }, [isLocalIAEnabled, isWebGpuSupported]);


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
      </div>



      {/* Nova Seção de IA Local */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Inteligência Artificial Local</h2>
        <div className="bg-[var(--cx-card)] border border-[var(--cx-line)] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium">IA no meu aparelho (grátis, offline)</h3>
              <p className="text-sm text-[var(--cx-mut)] mt-1">
                Execute o Cortex diretamente no seu dispositivo para respostas mais rápidas e privacidade total, sem depender da internet. Requer um download inicial.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--cx-mut)]">
                {isLocalIAEnabled ? 'Ativado' : 'Desativado'}
              </span>
              <button
                onClick={handleToggleLocalIA}
                disabled={!isWebGpuSupported}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isLocalIAEnabled ? 'bg-[var(--cx-ac)]' : 'bg-[var(--cx-line)]'} ${!isWebGpuSupported ? 'opacity-40 cursor-not-allowed' : ''}`}
                data-testid="local-ia-toggle"
                role="switch"
                aria-checked={isLocalIAEnabled}
                aria-label="IA no meu aparelho"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isLocalIAEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </div>
          </div>
          {!isWebGpuSupported && (
            <div className="text-xs text-red-400 mt-4">
              <p>⚠️ Seu navegador não suporta WebGPU ou não tem memória suficiente para esta funcionalidade. Atualize seu navegador ou use um dispositivo compatível.</p>
            </div>
          )}
          {showDownloadWarning && !isLocalIAEnabled && (
            <div className="text-xs text-yellow-400 mt-4">
              <p>⬇️ Para ativar, será necessário baixar um modelo de IA de aproximadamente 1 GB. Recomendamos uma conexão Wi-Fi estável.</p>
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => setShowDownloadWarning(false)}
                  className="px-3 py-1 text-sm border border-[var(--cx-line)] rounded-lg hover:border-[var(--cx-ac)] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => { setIsLocalIAEnabled(true); setShowDownloadWarning(false); /* Iniciar download aqui */ }}
                  className="px-3 py-1 text-sm bg-[var(--cx-ac)] text-white rounded-lg hover:bg-[var(--cx-ac-hover)] transition-colors"
                >
                  Confirmar Download
                </button>
              </div>
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