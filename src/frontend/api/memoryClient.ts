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

