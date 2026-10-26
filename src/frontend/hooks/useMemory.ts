import { useState, useEffect } from 'react';
import { memoryClient, MemoryItem, UserProfile } from '../api/memoryClient';

export const useMemory = () => {
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile>({ rememberMe: false });

  // Carrega os dados iniciais
  const loadMemory = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [items, userProfile] = await Promise.all([
        memoryClient.getMemoryItems(),
        memoryClient.getUserProfile()
      ]);
      
      setMemoryItems(items);
      setProfile(userProfile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  // Exclui um item individual
  const deleteItem = async (id: string) => {
    try {
      await memoryClient.deleteMemoryItem(id);
      setMemoryItems(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir item');
    }
  };

  // Exclui todos os itens
  const deleteAllItems = async () => {
    if (!confirm('Tem certeza que deseja apagar todos os seus dados de memória? Esta ação não pode ser desfeita.')) {
      return;
    }
    
    try {
      await memoryClient.deleteAllMemoryItems();
      setMemoryItems([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao apagar todos os itens');
      throw err; // Re-throw to allow caller to handle
    }
  };

  // Atualiza a opção "lembrar de mim"
  const toggleRememberMe = async (enabled: boolean) => {
    try {
      await memoryClient.updateRememberMe(enabled);
      setProfile(prev => ({ ...prev, rememberMe: enabled }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar preferência');
    }
  };

  // Carrega dados quando o componente é montado
  useEffect(() => {
    loadMemory();
  }, []);

  return {
    memoryItems,
    loading,
    error,
    profile,
    loadMemory,
    deleteItem,
    deleteAllItems,
    toggleRememberMe,
  };
};