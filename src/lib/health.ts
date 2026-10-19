import { getDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const COLLECTION = 'health/samples';

// --- tipos ---------------------------------------------------------------

export interface RouteStats {
  count: number;
  errors: number;
  avgTime: number;
}

export interface HealthMetrics {
  cpu: number;
  mem: number;
  responseTime: number;
  errorRate: number;
  routes: Record<string, RouteStats>;
}

export interface HealthSample {
  timestamp: string;
  metrics: HealthMetrics;
}

export interface HealthDashboardData {
  samples: HealthSample[];
  responseIncreases: Array<{ timestamp: string; magnitude: number }>;
  avgResponseTimeByRoute: Record<string, number>;
  errorCountByRoute: Record<string, number>;
}

// --- helpers -------------------------------------------------------------

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

function last30Days(): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push(isoDay(d));
  }
  return days;
}

function aggregateRoutes(routes: Record<string, RouteStats>): {
  avgResponseTimeByRoute: Record<string, number>;
  errorCountByRoute: Record<string, number>;
} {
  const avgResponseTimeByRoute: Record<string, number> = {};
  const errorCountByRoute: Record<string, number> = {};
  for (const [route, stats] of Object.entries(routes)) {
    avgResponseTimeByRoute[route] = stats.avgTime;
    errorCountByRoute[route] = stats.errors;
  }
  return { avgResponseTimeByRoute, errorCountByRoute };
}

// --- API pública ---------------------------------------------------------

/**
 * Consulta o Firestore para obter as amostras dos últimos 30 dias
 * (caminho health/samples, índice por dia).
 * 
 * @returns Promise<HealthSample[]> Array de amostras ordenadas por timestamp
 */
export async function getHealthSamples(): Promise<HealthSample[]> {
  const days = last30Days();
  const samples: HealthSample[] = [];
  
  for (const day of days) {
    try {
      const snap = await getDoc(doc(db, `${COLLECTION}/${day}`));
      if (snap.exists()) {
        const data = snap.data() as HealthSample;
        // Validar formato do dado
        if (data && data.timestamp && data.metrics) {
          samples.push(data);
        }
      }
    } catch (error) {
      console.error(`Erro ao ler amostra do dia ${day}:`, error);
    }
  }
  
  return samples.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/**
 * Armazena uma nova amostra de saúde no Firestore.
 * 
 * @param sample Amostra de saúde com timestamp e métricas
 * @returns Promise<void>
 */
export async function storeHealthSample(sample: HealthSample): Promise<void> {
  // Validar formato do sample
  if (!sample || !sample.timestamp || !sample.metrics) {
    throw new Error('Formato inválido de amostra: timestamp e metrics são obrigatórios');
  }
  
  if (typeof sample.timestamp !== 'string' || !sample.timestamp.startsWith('2')) {
    throw new Error('Timestamp deve ser uma string ISO válida');
  }
  
  if (typeof sample.metrics.cpu !== 'number' || 
      typeof sample.metrics.mem !== 'number' || 
      typeof sample.metrics.responseTime !== 'number' || 
      typeof sample.metrics.errorRate !== 'number') {
    throw new Error('Todas as métricas devem ser números');
  }
  
  const day = isoDay(new Date(sample.timestamp));
  
  try {
    await setDoc(doc(db, `${COLLECTION}/${day}`), sample);
  } catch (error) {
    console.error('Erro ao armazenar amostra de saúde:', error);
    throw new Error('Falha ao armazenar amostra de saúde no Firestore');
  }
}

/**
 * Retorna dados aglomerados para o painel:
 * - array de amostras (últimos 30 dias)
 * - métricas de queda (drops)
 * - tempo de resposta médio por rota
 * - contagem de erros por rota
 * 
 * @returns Promise<HealthDashboardData> Dados consolidados para o dashboard
 */
export async function getHealthDashboardData(): Promise<HealthDashboardData> {
  const samples = await getHealthSamples();

  const responseIncreases: Array<{ timestamp: string; magnitude: number }> = [];
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const curr = samples[i];
    const magnitude = curr.metrics.responseTime - prev.metrics.responseTime;
    if (magnitude > 0) {
      responseIncreases.push({ timestamp: curr.timestamp, magnitude });
    }
  }

  const aggregated = samples.reduce(
    (acc, s) => {
      for (const [route, stats] of Object.entries(s.metrics.routes)) {
        if (!acc.avgResponseTimeByRoute[route]) {
          acc.avgResponseTimeByRoute[route] = [];
          acc.errorCountByRoute[route] = 0;
        }
        acc.avgResponseTimeByRoute[route].push(stats.avgTime);
        acc.errorCountByRoute[route] += stats.errors;
      }
      return acc;
    },
    {
      avgResponseTimeByRoute: {} as Record<string, number[]>,
      errorCountByRoute: {} as Record<string, number>,
    }
  );

  const avgResponseTimeByRoute: Record<string, number> = {};
  for (const [route, times] of Object.entries(aggregated.avgResponseTimeByRoute)) {
    avgResponseTimeByRoute[route] =
      times.reduce((a, b) => a + b, 0) / times.length;
  }

  return {
    samples,
    responseIncreases,
    avgResponseTimeByRoute,
    errorCountByRoute: aggregated.errorCountByRoute,
  };
}
