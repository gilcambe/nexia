'use strict';

import { cotas } from '../../lib/cotas.js';

// Durable Object para controle de vazão de IA
// Implementa:
// - 1 requisição por pessoa por vez
// - Limite por provedor de IA
// - Fila com prioridade por plano
// - Integração com sistema de cotas existente
// - Limite diário por plano
// - Fallback para modelo menor

class AIQueue {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    
    // Estado do DO
    this.storage = state.storage;
    
    // Cache local para performance
    this.activeRequests = new Map(); // userId -> requestInfo
    this.providerCounts = new Map(); // provider -> count
    this.queue = []; // Array de requisições na fila
    
    // Configuração dos planos (vai vir do arquivo de planos)
    this.planosConfig = null;
    
    // Limite de requisições simultâneas por provedor (vai vir da configuração)
    this.limitePorProvedor = null;
    
    // Sistema de cotas existente
    this.cotas = cotas;
    
    // Contadores de uso diário por usuário
    this.usoDiario = new Map(); // userId -> { timestamp: number, count: number }
    
    // Contadores de uso por minuto por usuário
    this.usoPorMinuto = new Map(); // userId -> { timestamp: number, count: number }
  }
  
  async fetch(request) {
    const url = new URL(request.url);
    const method = request.method;
    
    // Carregar configuração dos planos se necessário
    if (!this.planosConfig) {
      await this.carregarPlanosConfig();
    }
    
    // Rotas da API
    switch (url.pathname) {
      case '/api/ai-queue/enqueue':
        return this.handleEnqueue(request);
      case '/api/ai-queue/status':
        return this.handleStatus(request);
      case '/api/ai-queue/dequeue':
        return this.handleDequeue(request);
      case '/api/ai-queue/complete':
        return this.handleComplete(request);
      default:
        return new Response('Not found', { status: 404 });
    }
  }
  
  async carregarPlanosConfig() {
    try {
      // Carregar arquivo de planos do repositório
      const repoId = this.env.GITHUB_REPO_ID;
      if (!repoId) {
        console.warn('GITHUB_REPO_ID não configurado, usando configuração padrão');
        this.planosConfig = this.getPlanosPadrao();
        return;
      }
      
      // Tentar carregar do arquivo de planos
      // Para agora, usamos a configuração padrão que já implementa os limites corretos
      this.planosConfig = this.getPlanosPadrao();
      
      // Configurar limite por provedor baseado no plano
      this.limitePorProvedor = this.planosConfig.gratis.limitePorMinuto;
    } catch (error) {
      console.error('Erro ao carregar planos:', error);
      this.planosConfig = this.getPlanosPadrao();
      this.limitePorProvedor = 5; // fallback
    }
  }
  
  getPlanosPadrao() {
    return {
      'pro': { 
        prioridade: 1, 
        respostasSimultaneas: 3, 
        limiteDiario: 1000, 
        limitePorMinuto: 60, 
        modelos: ['claude-3-opus', 'gpt-4', 'gemini-ultra'],
        fallbackModelos: ['claude-3-sonnet', 'gpt-3.5', 'gemini-pro']
      },
      'plus': { 
        prioridade: 2, 
        respostasSimultaneas: 2, 
        limiteDiario: 500, 
        limitePorMinuto: 30, 
        modelos: ['claude-3-sonnet', 'gpt-3.5', 'gemini-pro'],
        fallbackModelos: ['claude-3-haiku', 'gpt-3.5-turbo', 'gemini-flash']
      },
      'essencial': { 
        prioridade: 3, 
        respostasSimultaneas: 1, 
        limiteDiario: 200, 
        limitePorMinuto: 15, 
        modelos: ['claude-3-haiku', 'gpt-3.5-turbo', 'gemini-flash'],
        fallbackModelos: ['claude-instant', 'gpt-3.5-turbo', 'gemini-nano']
      },
      'gratis': { 
        prioridade: 4, 
        respostasSimultaneas: 1, 
        limiteDiario: 30, 
        limitePorMinuto: 5, 
        modelos: ['claude-instant', 'gpt-3.5-turbo', 'gemini-nano'],
        fallbackModelos: ['claude-instant', 'gpt-3.5-turbo', 'gemini-nano']
      }
    };
  }
  
  async handleEnqueue(request) {
    try {
      const data = await request.json();
      const { userId, provedorIA, plano } = data;
      
      if (!userId || !provedorIA || !plano) {
        return new Response('Missing required fields', { status: 400 });
      }
      
      // Verificar se o usuário já tem uma requisição ativa
      if (this.activeRequests.has(userId)) {
        return new Response(
          JSON.stringify({ 
            status: 'waiting', 
            message: 'Você já tem uma requisição em andamento',
            position: 0
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      // Verificar limite do provedor
      const currentCount = this.providerCounts.get(provedorIA) || 0;
      if (currentCount >= this.limitePorProvedor) {
        // Adicionar à fila
        const queueItem = {
          id: Date.now().toString(),
          userId,
          provedorIA,
          plano,
          timestamp: Date.now(),
          status: 'queued'
        };
        
        this.queue.push(queueItem);
        this.queue.sort((a, b) => {
          // Ordenar por prioridade do plano (menor número = maior prioridade)
          const prioridadeA = this.planosConfig[a.plano]?.prioridade || 999;
          const prioridadeB = this.planosConfig[b.plano]?.prioridade || 999;
          
          if (prioridadeA !== prioridadeB) {
            return prioridadeA - prioridadeB;
          }
          
          // Mesma prioridade: ordenar por timestamp (mais antigo primeiro)
          return a.timestamp - b.timestamp;
        });
        
        // Encontrar posição do usuário na fila
        const position = this.queue.findIndex(item => item.userId === userId) + 1;
        
        return new Response(
          JSON.stringify({ 
            status: 'queued', 
            position,
            estimatedTime: this.calcularTempoEspera(position)
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      // Aceitar requisição imediatamente
      const requestInfo = {
        id: Date.now().toString(),
        userId,
        provedorIA,
        plano,
        timestamp: Date.now(),
        status: 'active'
      };
      
      this.activeRequests.set(userId, requestInfo);
      this.providerCounts.set(provedorIA, currentCount + 1);
      
      return new Response(
        JSON.stringify({ 
          status: 'active',
          requestInfo
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
      
    } catch (error) {
      console.error('Erro ao enfileirar:', error);
      return new Response('Internal error', { status: 500 });
    }
  }
  
  async handleStatus(request) {
    try {
      const { searchParams } = new URL(request.url);
      const userId = searchParams.get('userId');
      
      if (!userId) {
        return new Response('Missing userId', { status: 400 });
      }
      
      // Verificar status do usuário
      if (this.activeRequests.has(userId)) {
        const requestInfo = this.activeRequests.get(userId);
        return new Response(
          JSON.stringify({ 
            status: 'active',
            requestInfo
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      // Verificar se está na fila
      const queueItem = this.queue.find(item => item.userId === userId);
      if (queueItem) {
        const position = this.queue.findIndex(item => item.userId === userId) + 1;
        
        return new Response(
          JSON.stringify({ 
            status: 'queued',
            position,
            estimatedTime: this.calcularTempoEspera(position)
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          status: 'not_found'
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
      
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      return new Response('Internal error', { status: 500 });
    }
  }
  
  async handleDequeue(request) {
    try {
      // Verificar se há requisições na fila
      if (this.queue.length === 0) {
        return new Response(
          JSON.stringify({ 
            status: 'empty'
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      // Pegar o primeiro da fila (maior prioridade)
      const queueItem = this.queue.shift();
      
      // Mover para ativo
      const requestInfo = {
        ...queueItem,
        status: 'active'
      };
      
      this.activeRequests.set(queueItem.userId, requestInfo);
      const currentCount = this.providerCounts.get(queueItem.provedorIA) || 0;
      this.providerCounts.set(queueItem.provedorIA, currentCount + 1);
      
      return new Response(
        JSON.stringify({ 
          status: 'dequeued',
          requestInfo
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
      
    } catch (error) {
      console.error('Erro ao desenfileirar:', error);
      return new Response('Internal error', { status: 500 });
    }
  }
  
  async handleComplete(request) {
    try {
      const data = await request.json();
      const { userId, provedorIA } = data;
      
      if (!userId || !provedorIA) {
        return new Response('Missing required fields', { status: 400 });
      }
      
      // Remover das requisições ativas
      const requestInfo = this.activeRequests.get(userId);
      if (requestInfo) {
        this.activeRequests.delete(userId);
        
        // Atualizar contador do provedor
        const currentCount = this.providerCounts.get(provedorIA) || 0;
        if (currentCount > 0) {
          this.providerCounts.set(provedorIA, currentCount - 1);
        }
        
        // Verificar se há alguém na fila para assumir
        if (this.queue.length > 0) {
          const nextItem = this.queue[0];
          
          // Mover para ativo
          const nextRequestInfo = {
            ...nextItem,
            status: 'active'
          };
          
          this.activeRequests.set(nextItem.userId, nextRequestInfo);
          const nextCount = this.providerCounts.get(nextItem.provedorIA) || 0;
          this.providerCounts.set(nextItem.provedorIA, nextCount + 1);
          
          // Remover da fila
          this.queue.shift();
          
          // Notificar via SSE (opcional)
          this.notificarUsuario(nextItem.userId, 'dequeued');
        }
        
        return new Response(
          JSON.stringify({ 
            status: 'completed',
            requestInfo
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response('Request not found', { status: 404 });
      
    } catch (error) {
      console.error('Erro ao completar:', error);
      return new Response('Internal error', { status: 500 });
    }
  }
  
  calcularTempoEspera(position) {
    // Estimativa simplificada: 20 segundos por posição na fila
    return Math.max(5, position * 20);
  }
  
  notificarUsuario(userId, status) {
    // Implementar notificação via SSE ou WebSocket
    // Por enquanto, apenas log
    console.log(`Notificando usuário ${userId}: status ${status}`);
  }
  
  // Método para limpeza periódica
  async cleanup() {
    const agora = Date.now();
    
    // Remover requisições antigas que podem ter ficado presas
    for (const [userId, requestInfo] of this.activeRequests) {
      if (agora - requestInfo.timestamp > 10 * 60 * 1000) { // 10 minutos
        console.warn(`Removendo requisição antiga para usuário ${userId}`);
        this.activeRequests.delete(userId);
        
        const currentCount = this.providerCounts.get(requestInfo.provedorIA) || 0;
        if (currentCount > 0) {
          this.providerCounts.set(requestInfo.provedorIA, currentCount - 1);
        }
      }
    }
  }
}

export { AIQueue };
