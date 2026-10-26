# Plano de Venda do NEXIA Audit - Controle de Vazão do Serviço de IA

Este documento define os planos e limites para o controle de vazão do serviço de IA do NEXIA Audit.

## Estrutura de Planos

| Plano | Prioridade | Respostas Simultâneas | Limite Diário | Limite Por Minuto | Modelos Disponíveis |
|-------|------------|------------------------|---------------|------------------|---------------------|
| Pro | 1 | 3 | 1000 | 60 | Claude 3 Opus, GPT-4, Gemini Ultra |
| Plus | 2 | 2 | 500 | 30 | Claude 3 Sonnet, GPT-3.5, Gemini Pro |
| Essencial | 3 | 1 | 200 | 15 | Claude 3 Haiku, GPT-3.5-turbo, Gemini Flash |
| Grátis | 4 | 1 | 30 | 5 | Claude Instant, GPT-3.5-turbo, Gemini Nano |

## Configuração de Limites

```javascript
const PLANOS = {
  pro: {
    prioridade: 1,
    respostasSimultaneas: 3,
    limiteDiario: 1000,
    limitePorMinuto: 60,
    modelos: ['claude-3-opus', 'gpt-4', 'gemini-ultra']
  },
  plus: {
    prioridade: 2,
    respostasSimultaneas: 2,
    limiteDiario: 500,
    limitePorMinuto: 30,
    modelos: ['claude-3-sonnet', 'gpt-3.5', 'gemini-pro']
  },
  essencial: {
    prioridade: 3,
    respostasSimultaneas: 1,
    limiteDiario: 200,
    limitePorMinuto: 15,
    modelos: ['claude-3-haiku', 'gpt-3.5-turbo', 'gemini-flash']
  },
  gratis: {
    prioridade: 4,
    respostasSimultaneas: 1,
    limiteDiario: 30,
    limitePorMinuto: 5,
    modelos: ['claude-instant', 'gpt-3.5-turbo', 'gemini-nano']
  }
};

// Mapeamento de plano para usuário (ex: a partir de token ou sessão)
function getPlanoUsuario(usuario) {
  // Implementar lógica para identificar o plano do usuário
  // Pode vir do token, sessão, banco de dados, etc.
  return usuario.plano || 'gratis';
}

// Verifica se o usuário tem acesso a um modelo específico
function temAcessoModelo(usuario, modelo) {
  const plano = getPlanoUsuario(usuario);
  return PLANOS[plano].modelos.includes(modelo);
}

// Verifica se o usuário atingiu o limite diário
function atingiuLimiteDiario(usuario) {
  const plano = getPlanoUsuario(usuario);
  // Implementar verificação do uso diário
  return usuario.usoDiario >= PLANOS[plano].limiteDiario;
}

// Verifica se o usuário atingiu o limite por minuto
function atingiuLimitePorMinuto(usuario) {
  const plano = getPlanoUsuario(usuario);
  // Implementar verificação do uso por minuto
  return usuario.usoPorMinuto >= PLANOS[plano].limitePorMinuto;
}
```

## Controle de Vazão

O controle de vazão será implementado usando Durable Objects com SQLite (plano grátis da Cloudflare) para:

1. **Gerenciar filas de espera** quando todos os provedores de IA estão no limite
2. **Controlar respostas simultâneas** por usuário
3. **Implementar limite diário e por minuto** por plano
4. **Priorizar usuários** por plano (Pro > Plus > Essencial > Grátis)
5. **Notificar em tempo real** usando SSE (Server-Sent Events)

## Fluxo de Processamento

1. Usário faz requisição de resposta
2. Sistema verifica:
   - Se o usuário tem respostas simultâneas disponíveis
   - Se o usuário atingiu o limite diário
   - Se o usuário atingiu o limite por minuto
   - Se há capacidade nos provedores de IA
3. Se tudo OK, processa imediatamente
4. Se não, coloca na fila com prioridade por plano
5. Envia notificação SSE com posição na fila
6. Quando chegar na frente, processa e notifica via SSE

## Integração com Sistema Existente

O sistema deve integrar-se com:
- `lib/cotas.js` para medição de uso
- Sistema de autenticação existente
- Handlers de IA existentes

## Testes

Devem ser implementados testes unitários para:
- Ordem da fila
- Limite por pessoa
- Prioridade por plano
- Teste de carga com 200 pessoas
