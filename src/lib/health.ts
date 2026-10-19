import { doc, getDoc, setDoc } from 'firebase/firestore';
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

/**
 * Lê uma amostra específica do Firestore para um dia específico.
 */
async function readDay(day: string): Promise<HealthSample | null> {
  const docRef = doc(db, COLLECTION, day);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as HealthSample;
  }
  return null;
}

/**
 * Escreve uma amostra específica no Firestore para um dia específico.
 */
async function writeDay(day: string, sample: HealthSample): Promise<void> {
  const docRef = doc(db, COLLECTION, day);
  await setDoc(docRef, sample);
}

// --- API pública ---------------------------------------------------------

/**
 * Consulta o Firestore para obter as amostras dos últimos 30 dias
 * (caminho health/samples, índice por dia).
 */
export async function getHealthSamples(): Promise<HealthSample[]> {
  const days = last30Days();
  const samples: HealthSample[] = [];
  for (const day of days) {
    const sample = await readDay(day);
    if (sample) samples.push(sample);
  }
  return samples.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/**
 * Armazena uma nova amostra de saúde no Firestore.
 */
export async function storeHealthSample(sample: HealthSample): Promise<void> {
  const day = isoDay(new Date(sample.timestamp));
  await writeDay(day, sample);
}

/**
 * Retorna dados aglomerados para o painel:
 * - array de amostras (últimos 30 dias)
 * - métricas de queda (drops)
 * - tempo de resposta médio por rota
 * - contagem de erros por rota
 */
export async function getHealthDashboardData(): Promise<HealthDashboardData> {
  const samples = await getHealthSamples();

  const drops: Array<{ timestamp: string; magnitude: number }> = [];
  const responseTimeThreshold = 100; // Limiar mínimo de 100ms para considerar uma queda
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const curr = samples[i];
    const magnitude = curr.metrics.responseTime - prev.metrics.responseTime;
    if (magnitude > responseTimeThreshold) {
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
