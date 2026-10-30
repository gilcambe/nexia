import { useState, useEffect } from 'react';

// Função para sanitizar conteúdo HTML e prevenir XSS
const sanitizeContent = (content: string): string => {
  const div = document.createElement('div');
  div.textContent = content;
  return div.innerHTML;
};

export interface MemoryItem {
  id: string;
  content: string;
  timestamp: string;
}

export interface UserProfile {
  rememberMe: boolean;
}

const API_BASE_URL = '/api/memory';

// Função para obter token de autenticação
const getAuthHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` })
  };
};

// NOTA: CSRF tokens agora são gerados pelo backend e enviados via HttpOnly cookies
// O navegador envia automaticamente o cookie com as requisições, sem exposição a XSS
// A proteção real contra rate limiting é implementada no backend, não no frontend

export const memoryClient = {
  // Lista todos os fatos do usuário
  async getMemoryItems(): Promise<MemoryItem[]> {
    const response = await fetch(`${API_BASE_URL}/items`, {
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Não autorizado: Por favor, faça login novamente');
      }
      throw new Error('Falha ao carregar memória');
    }
    
    const items = await response.json();
    // Sanitizar conteúdo para prevenir XSS
    return items.map((item: MemoryItem) => ({
      ...item,
      content: sanitizeContent(item.content)
    }));
  },

  // Exclui um fato individual
  async deleteMemoryItem(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/items/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(), // CSRF token enviado automaticamente via HttpOnly cookie
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Não autorizado: Por favor, faça login novamente');
      }
      if (response.status === 403) {
        throw new Error('Acesso negado: Você não tem permissão para excluir este item');
      }
      throw new Error('Falha ao excluir item');
    }
  },

  // Exclui todos os fatos
  async deleteAllMemoryItems(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/items`, {
      method: 'DELETE',
      headers: getAuthHeaders(), // CSRF token enviado automaticamente via HttpOnly cookie
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Não autorizado: Por favor, faça login novamente');
      }
      if (response.status === 403) {
        throw new Error('Acesso negado: Você não tem permissão para excluir todos os itens');
      }
      throw new Error('Falha ao excluir todos os itens');
    }
  },

  // Atualiza o flag "lembrar de mim"
  // NOTA: O backend deve validar e impor as regras de LGPD para armazenamento de novos fatos
  // quando esta opção estiver desativada, garantindo conformidade total
  async updateRememberMe(enabled: boolean): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/profile`, {
      method: 'PATCH',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rememberMe: enabled }),
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Não autorizado: Por favor, faça login novamente');
      }
      if (response.status === 403) {
        throw new Error('Acesso negado: Você não tem permissão para alterar esta configuração');
      }
      throw new Error('Falha ao atualizar preferência');
    }
  },

  // Obtém o perfil do usuário
  async getUserProfile(): Promise<UserProfile> {
    const response = await fetch(`${API_BASE_URL}/profile`, {
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Não autorizado: Por favor, faça login novamente');
      }
      throw new Error('Falha ao carregar perfil');
    }
    return response.json();
  },
};

// Interface para configuração da IA local
export interface IALocalConfig {
  ativo: boolean;
}

// Função para obter configuração da IA local do armazenamento local
export const obterConfig = (): IALocalConfig => {
  if (typeof window === 'undefined') {
    return { ativo: false };
  }
  
  try {
    const configStr = localStorage.getItem('iaLocalConfig');
    if (configStr) {
      return JSON.parse(configStr);
    }
  } catch (err) {
    console.error('Erro ao obter configuração da IA local:', err);
  }
  
  return { ativo: false };
};

// Função para verificar suporte WebGPU
export const verificarSuporteWebGPU = async (): Promise<{ suportado: boolean; motivo?: string }> => {
  if (typeof window === 'undefined') {
    return { suportado: false, motivo: 'Ambiente sem suporte a navegador' };
  }
  
  try {
    // Verificar se navigator.gpu existe
    if (!navigator.gpu) {
      return { suportado: false, motivo: 'WebGPU não suportado por este navegador' };
    }
    
    // Tentar obter adaptador
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return { suportado: false, motivo: 'Nenhum adaptador GPU disponível' };
    }
    
    // Verificar memória disponível (mínimo 1 GB)
    const memoryMB = adapter.limits?.maxStorageBufferBindingSize ? 
      adapter.limits.maxStorageBufferBindingSize / (1024 * 1024) : 0;
    
    if (memoryMB < 1024) { // Menos de 1 GB
      return { suportado: false, motivo: 'Memória GPU insuficiente (mínimo 1 GB necessário)' };
    }
    
    return { suportado: true };
  } catch (err) {
    return { 
      suportado: false, 
      motivo: err instanceof Error ? err.message : 'Erro ao verificar suporte WebGPU' 
    };
  }
};

// Função para salvar configuração da IA local
export const salvarConfig = (config: IALocalConfig) => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem('iaLocalConfig', JSON.stringify(config));
  } catch (err) {
    console.error('Erro ao salvar configuração da IA local:', err);
    throw new Error('Falha ao salvar configuração');
  }
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