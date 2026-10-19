import { getDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const COLLECTION = 'health/samples';

// --- Interface de abstração para storage --------------------------------

export interface StorageAdapter {
  getSample(day: string): Promise<HealthSample | null>;
  storeSample(day: string, sample: HealthSample): Promise<void>;
}

export class FirestoreStorageAdapter implements StorageAdapter {
  async getSample(day: string): Promise<HealthSample | null> {
    try {
      const snap = await getDoc(doc(db, `${COLLECTION}/${day}`));
      if (snap.exists()) {
        const data = snap.data() as HealthSample;
        if (data && data.timestamp && data.metrics) {
          return data;
        }
      }
      return null;
    } catch (error) {
      console.error(`Erro ao ler amostra do dia ${day}:`, error);
      return null;
    }
  }

  async storeSample(day: string, sample: HealthSample): Promise<void> {
    try {
      await setDoc(doc(db, `${COLLECTION}/${day}`), sample);
    } catch (error) {
      console.error('Erro ao armazenar amostra de saúde:', error);
      throw new Error('Falha ao armazenar amostra de saúde no Firestore');
    }
  }
}

// Instância padrão usando Firestore
const storageAdapter = new FirestoreStorageAdapter();

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
  drops: Array<{ timestamp: string; magnitude: number }>;
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
 * Consulta o storage para obter as amostras dos últimos 30 dias
 * (caminho health/samples, índice por dia).
 * 
 * @returns Promise<HealthSample[]> Array de amostras ordenadas por timestamp
 */
export async function getHealthSamples(): Promise<HealthSample[]> {
  const days = last30Days();
  const samples: HealthSample[] = [];
  
  for (const day of days) {
    const sample = await storageAdapter.getSample(day);
    if (sample) {
      samples.push(sample);
    }
  }
  
  return samples.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/**
 * Armazena uma nova amostra de saúde no storage.
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
  
  await storageAdapter.storeSample(day, sample);
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

  const drops: Array<{ timestamp: string; magnitude: number }> = [];
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const curr = samples[i];
    const magnitude = curr.metrics.responseTime - prev.metrics.responseTime;
    if (magnitude > 0) {
      drops.push({ timestamp: curr.timestamp, magnitude });
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
    drops,
    avgResponseTimeByRoute,
    errorCountByRoute: aggregated.errorCountByRoute,
  };
}
