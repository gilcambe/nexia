import { collection, query, where, orderBy, limit, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

// Caminho base no Firestore para amostras de saúde do sistema.
const HEALTH_SAMPLES_PATH = 'health/samples';

// Abstração mínima de banco. Por padrão usa Firestore; preparada para D1 no futuro.
const healthDb = {
  async getCollection(path: string) {
    return collection(db, path);
  },
};

export interface HealthRouteMetric {
  count: number;
  errors: number;
  avgTime: number;
}

export interface HealthMetrics {
  cpu: number;
  mem: number;
  responseTime: number;
  errorRate: number;
  routes: Record<string, HealthRouteMetric>;
}

export interface HealthSample {
  timestamp: string;
  metrics: HealthMetrics;
}

/**
 * Salva uma amostra de saúde no Firestore.
 * Formato do documento: { timestamp: string (ISO), metrics: { ... } }
 */
export async function storeHealthSample(sample: HealthSample): Promise<void> {
  const samplesRef = healthDb.getCollection(HEALTH_SAMPLES_PATH);
  // Usa o próprio timestamp (ISO) como ID do documento para garantir índice por dia/único.
  const date = new Date(sample.timestamp);
  const docId = date.toISOString().split('T')[0]; // Formato YYYY-MM-DD
  const docRef = doc(samplesRef, docId);
  await setDoc(docRef, {
    ...sample,
    createdAt: serverTimestamp(),
  });
}

/**
 * Consulta as 30 últimas amostras de saúde no Firestore (últimos 30 dias).
 * Retorna as amostras ordenadas do mais antigo para o mais recente.
 */
async function getLast30DaysSamples(): Promise<HealthSample[]> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const samplesRef = healthDb.getCollection(HEALTH_SAMPLES_PATH);
  const q = query(
    samplesRef,
    where('timestamp', '>=', thirtyDaysAgo.toISOString()),
    orderBy('timestamp', 'asc'),
    limit(30)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => docSnap.data() as HealthSample);
}

/**
 * Retorna dados aglomerados para o painel de saúde:
 * - array de amostras (últimos 30 dias)
 * - métricas de queda (útil para alertas de degradação)
 * - tempo de resposta médio por rota
 * - contagem de erros por rota
 */
export async function getHealthDashboardData(): Promise<{
  samples: HealthSample[];
  dropMetrics: {
    cpuDrop: number;
    memDrop: number;
    responseTimeIncrease: number;
    errorRateIncrease: number;
  };
  avgResponseTimeByRoute: Record<string, number>;
  errorCountByRoute: Record<string, number>;
}> {
  const samples = await getLast30DaysSamples();

  if (samples.length === 0) {
    return {
      samples: [],
      dropMetrics: { cpuDrop: 0, memDrop: 0, responseTimeIncrease: 0, errorRateIncrease: 0 },
      avgResponseTimeByRoute: {},
      errorCountByRoute: {},
    };
  }

  const first = samples[0];
  const last = samples[samples.length - 1];

  const cpuDrop = Math.max(0, (first.metrics.cpu || 0) - (last.metrics.cpu || 0));
  const memDrop = Math.max(0, (first.metrics.mem || 0) - (last.metrics.mem || 0));
  const responseTimeIncrease = Math.max(0, (last.metrics.responseTime || 0) - (first.metrics.responseTime || 0));
  const errorRateIncrease = Math.max(0, (last.metrics.errorRate || 0) - (first.metrics.errorRate || 0));

  // Agrega métricas por rota a partir de todas as amostras.
  const routeSums: Record<string, { count: number; errors: number; totalTime: number; samples: number }> = {};

  for (const sample of samples) {
    for (const [route, metric] of Object.entries(sample.metrics.routes)) {
      if (!routeSums[route]) {
        routeSums[route] = { count: 0, errors: 0, totalTime: 0, samples: 0 };
      }
      routeSums[route].count += metric.count;
      routeSums[route].errors += metric.errors;
      routeSums[route].totalTime += metric.avgTime * metric.count;
      routeSums[route].samples += 1;
    }
  }

  const avgResponseTimeByRoute: Record<string, number> = {};
  const errorCountByRoute: Record<string, number> = {};

  for (const [route, sums] of Object.entries(routeSums)) {
    avgResponseTimeByRoute[route] = sums.count > 0 ? sums.totalTime / sums.count : 0;
    errorCountByRoute[route] = sums.errors;
  }

  return {
    samples,
    dropMetrics: {
      cpuDrop,
      memDrop,
      responseTimeIncrease,
      errorRateIncrease,
    },
    avgResponseTimeByRoute,
    errorCountByRoute,
  };
}
