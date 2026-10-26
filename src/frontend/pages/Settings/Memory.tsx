import React, { useState } from 'react';
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