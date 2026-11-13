export interface UsoTokens {
  tokens: number;
  pedidos: number;
}

export interface PlacarCota {
  limiteTokens: number;
  limitePedidos: number;
  resetEm?: string | null; // ISO string
}

export interface PainelCota {
  status: 'verde' | 'amarelo' | 'vermelho' | 'cinza';
  cor: string;
  horaRetorno: string | null;
  pedidos: number;
  tokens: number;
  limiteTokens: number;
  limitePedidos: number;
}

export function montarPainelCota(
  uso: UsoTokens,
  placar: PlacarCota,
  agora: Date
): PainelCota {
  const tokens = uso.tokens;
  const pedidos = uso.pedidos;
  const limiteTokens = placar.limiteTokens;
  const limitePedidos = placar.limitePedidos;

  // Se não há limites definidos ou são zero, consideramos cinza (sem cota ativa)
  if (limiteTokens <= 0 && limitePedidos <= 0) {
    return {
      status: 'cinza',
      cor: 'gray',
      horaRetorno: null,
      pedidos,
      tokens,
      limiteTokens,
      limitePedidos,
    };
  }

  // Verificar se excedeu os limites
  const excedeuTokens = limiteTokens > 0 && tokens >= limiteTokens;
  const excedeuPedidos = limitePedidos > 0 && pedidos >= limitePedidos;

  if (excedeuTokens || excedeuPedidos) {
    // Vermelho: cota esgotada
    const horaRetorno = placar.resetEm
      ? new Date(placar.resetEm).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;

    return {
      status: 'vermelho',
      cor: 'red',
      horaRetorno,
      pedidos,
      tokens,
      limiteTokens,
      limitePedidos,
    };
  }

  // Verificar se está perto do limite (amarelo)
  const pctTokens = limiteTokens > 0 ? tokens / limiteTokens : 0;
  const pctPedidos = limitePedidos > 0 ? pedidos / limitePedidos : 0;
  const pctMax = Math.max(pctTokens, pctPedidos);

  if (pctMax >= 0.8) {
    // Amarelo: perto do limite
    const horaRetorno = placar.resetEm
      ? new Date(placar.resetEm).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;

    return {
      status: 'amarelo',
      cor: 'yellow',
      horaRetorno,
      pedidos,
      tokens,
      limiteTokens,
      limitePedidos,
    };
  }

  // Verde: dentro do limite
  return {
    status: 'verde',
    cor: 'green',
    horaRetorno: null,
    pedidos,
    tokens,
    limiteTokens,
    limitePedidos,
  };
}
