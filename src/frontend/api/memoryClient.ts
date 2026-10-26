import { useState, useEffect } from 'react';

export interface MemoryItem {
  id: string;
  content: string;
  timestamp: string;
}

export interface UserProfile {
  rememberMe: boolean;
}

const API_BASE_URL = '/api/memory';

export const memoryClient = {
  // Lista todos os fatos do usuário
  async getMemoryItems(): Promise<MemoryItem[]> {
    const response = await fetch(`${API_BASE_URL}/items`);
    if (!response.ok) {
      throw new Error('Falha ao carregar memória');
    }
    return response.json();
  },

  // Exclui um fato individual
  async deleteMemoryItem(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/items/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Falha ao excluir item');
    }
  },

  // Exclui todos os fatos
  async deleteAllMemoryItems(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/items`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Falha ao excluir todos os itens');
    }
  },

  // Atualiza o flag "lembrar de mim"
  async updateRememberMe(enabled: boolean): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rememberMe: enabled }),
    });
    if (!response.ok) {
      throw new Error('Falha ao atualizar preferência');
    }
  },

  // Obtém o perfil do usuário
  async getUserProfile(): Promise<UserProfile> {
    const response = await fetch(`${API_BASE_URL}/profile`);
    if (!response.ok) {
      throw new Error('Falha ao carregar perfil');
    }
    return response.json();
  },
};

// Hook personalizado para gerenciar a memória do usuário
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