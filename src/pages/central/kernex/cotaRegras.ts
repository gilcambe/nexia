/**
 * Regras puras para o painel de cota da Kernex.
 */

export interface UsoTokens {
  pedidos?: number;
  tokens?: number;
  totalPedidos?: number;
  totalTokens?: number;
}

export interface PlacarCota {
  limitePedidos?: number;
  limiteTokens?: number;
  statusCota?: string;
  horaRetorno?: string;
  [key: string]: any;
}

export interface PainelCotaResultado {
  status: 'verde' | 'amarelo' | 'vermelho' | 'cinza';
  cor: string;
  horaRetorno: string | null;
  pedidos: number;
  tokens: number;
  limitePedidos: number;
  limiteTokens: number;
  mensagem: string;
}

/**
 * Função pura montarPainelCota(uso, placar, agora)
 * Recebe os dados de uso de tokens, o placar de cota e a data/hora atual,
 * devolvendo a estrutura pronta para a UI (status, cor, hora de retorno, contagem de pedidos e tokens).
 */
export function montarPainelCota(
  uso: UsoTokens | null | undefined,
  placar: PlacarCota | null | undefined,
  agora?: Date | string | number
): PainelCotaResultado {
  const pedidos = uso?.pedidos ?? uso?.totalPedidos ?? 0;
  const tokens = uso?.tokens ?? uso?.totalTokens ?? 0;

  const limitePedidos = placar?.limitePedidos ?? 1000;
  const limiteTokens = placar?.limiteTokens ?? 50000;

  let status: 'verde' | 'amarelo' | 'vermelho' | 'cinza' = 'verde';
  let cor = '#22c55e'; // verde
  let horaRetorno: string | null = placar?.horaRetorno ?? null;
  let mensagem = 'Cota normal';

  if (!uso && !placar) {
    status = 'cinza';
    cor = '#9ca3af';
    mensagem = 'Sem dados de cota';
  } else {
    const rawStatus = (placar?.statusCota || '').toLowerCase();
    
    if (rawStatus === 'vermelho' || rawStatus === 'esgotado' || (limitePedidos > 0 && pedidos >= limitePedidos)) {
      status = 'vermelho';
      cor = '#ef4444';
      mensagem = 'Cota esgotada';
    } else if (rawStatus === 'amarelo' || rawStatus === 'alerta' || (limitePedidos > 0 && pedidos >= limitePedidos * 0.8)) {
      status = 'amarelo';
      cor = '#f59e0b';
      mensagem = 'Cota próxima do limite';
      if (!horaRetorno && agora) {
        const dataAtual = new Date(agora);
        dataAtual.setHours(dataAtual.getHours() + 1);
        horaRetorno = dataAtual.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    } else {
      status = 'verde';
      cor = '#22c55e';
      mensagem = 'Operando normalmente';
    }
  }

  return {
    status,
    cor,
    horaRetorno,
    pedidos,
    tokens,
    limitePedidos,
    limiteTokens,
    mensagem
  };
}
