import { db } from '../lib/firebase';

export async function getCustos() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const execucoesRef = db.collection('execucoes');
  const query = execucoesRef
    .where('started_at', '>=', firstDay)
    .where('started_at', '<=', lastDay);

  const snapshot = await query.get();
  const execucoes = snapshot.docs.map(doc => doc.data());

  const totalCost = execucoes.reduce((sum, exec) => sum + (exec.usage?.cost_usd_micros || 0), 0) / 1e6;
  const avgCostPerPlan = totalCost / execucoes.length;

  const clientes = execucoes.reduce((acc, exec) => {
    const clientId = exec.client_id;
    const cost = (exec.usage?.cost_usd_micros || 0) / 1e6;
    if (!acc[clientId]) {
      acc[clientId] = { id: clientId, cost: 0 };
    }
    acc[clientId].cost += cost;
    return acc;
  }, {});

  const top10Clientes = Object.values(clientes)
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 10);

  const globalCircuitActive = totalCost > 1000; // Example threshold

  return {
    totalCost,
    avgCostPerPlan,
    top10Clientes,
    globalCircuitActive,
  };
}
