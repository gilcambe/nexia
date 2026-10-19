import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

const COLLECTION = 'health/samples';

// Storage adapter interface para abstração mínima (preparado para D1 no futuro)
export interface StorageAdapter {
  readDay(day: string): Promise<HealthSample | null>;
  writeDay(day: string, sample: HealthSample): Promise<void>;
}

// Implementação Firestore por padrão
class FirestoreStorageAdapter implements StorageAdapter {
  async readDay(day: string): Promise<HealthSample | null> {
    const snap = await getDoc(doc(db, `${COLLECTION}/${day}`));
    if (!snap.exists()) return null;
    return snap.data() as HealthSample;
  }

  async writeDay(day: string, sample: HealthSample): Promise<void> {
    await setDoc(doc(db, `${COLLECTION}/${day}`), sample);
  }
}

const storage: StorageAdapter = new FirestoreStorageAdapter();

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

// --- abstração mínima de storage (Firestore por padrão) -----------------

function storagePath(day: string): string {
  return `${COLLECTION}/${day}`;
}

async function readDay(day: string): Promise<HealthSample | null> {
  const snap = await getDoc(doc(db, storagePath(day)));
  if (!snap.exists()) return null;
  const data = snap.data() as HealthSample;
  return data;
}

async function writeDay(day: string, sample: HealthSample): Promise<void> {
  await setDoc(doc(db, storagePath(day)), sample);
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
    const sample = await readDay(day);
    if (sample) samples.push(sample);
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
  const day = isoDay(new Date(sample.timestamp));
  await writeDay(day, sample);
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
