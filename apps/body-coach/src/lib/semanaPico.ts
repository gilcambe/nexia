// Semana de pico: os 7 dias antes de um evento (foto, campeonato, praia, casamento).
// Versão segura: sem cortar água, sem diurético, sem jejum. Treino vai diminuindo e o carboidrato
// sobe nos 2 últimos dias para o músculo ficar cheio. Não substitui o nutricionista.

export interface DiaPico { dia: number; data: string; titulo: string; treino: string; carbo_g: number; agua_l: number; dica: string }

const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });

export function planoSemanaPico(evento: Date, pesoKg: number): DiaPico[] {
  const peso = Math.min(200, Math.max(35, pesoKg || 70));
  const agua = Math.round(peso * 0.045 * 10) / 10; // ~45 ml/kg: hidratação normal, nunca cortar
  const carbo = (gkg: number) => Math.round(peso * gkg / 10) * 10;
  const base: Omit<DiaPico, 'data'>[] = [
    { dia: -7, titulo: 'Rotina normal', treino: 'Treino normal (pode ser o de pernas mais pesado da semana).', carbo_g: carbo(3), agua_l: agua, dica: 'Comece a reparar no sal: mantenha o de sempre, sem exagero.' },
    { dia: -6, titulo: 'Rotina normal', treino: 'Treino normal de parte de cima.', carbo_g: carbo(3), agua_l: agua, dica: 'Durma 7 a 9 horas: o corpo desincha dormindo.' },
    { dia: -5, titulo: 'Último treino pesado', treino: 'Último treino pesado. Depois disso, nada de recorde.', carbo_g: carbo(3), agua_l: agua, dica: 'Evite comida nova: nada de restaurante diferente nesta semana.' },
    { dia: -4, titulo: 'Volume menor', treino: 'Treino com metade das séries, carga moderada.', carbo_g: carbo(2.5), agua_l: agua, dica: 'Menos ultraprocessado e menos refrigerante.' },
    { dia: -3, titulo: 'Leve', treino: 'Corpo todo leve: 2 séries por músculo, sem falha. Pode caminhar.', carbo_g: carbo(2.5), agua_l: agua, dica: 'Diminua alimentos que dão gases (feijão, brócolis, repolho) a partir de hoje.' },
    { dia: -2, titulo: 'Carga de carboidrato', treino: 'Descanso ou caminhada leve.', carbo_g: carbo(5), agua_l: agua, dica: 'Carboidrato limpo e de fácil digestão: arroz, batata, tapioca, pão, frutas.' },
    { dia: -1, titulo: 'Carga de carboidrato', treino: 'Descanso. Pode fazer um "pump" leve de 15 min.', carbo_g: carbo(5), agua_l: agua, dica: 'Mantenha a água normal. Jantar cedo e sem exagero de sal.' },
    { dia: 0, titulo: 'Dia do evento', treino: 'Antes da foto: 10-15 min de flexões, elásticos ou halter leve para dar volume.', carbo_g: carbo(2), agua_l: agua, dica: 'Refeição leve 2 h antes (ex.: arroz + frango, ou pão + mel). Beba água normalmente.' },
  ];
  return base.map((b) => { const d = new Date(evento); d.setDate(d.getDate() + b.dia); return { ...b, data: fmt(d) }; });
}

export const AVISO_PICO = 'Plano geral e seguro: sem cortar água, sem diurético e sem jejum. Para competição ou se você tem pressão alta, rim ou diabetes, siga o seu nutricionista.';
