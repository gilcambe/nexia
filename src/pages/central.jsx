import React, { useEffect, useState } from 'react';
import { fetchCustos } from '../../api/custos';

const CentralPage = () => {
  const [custos, setCustos] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getCustos = async () => {
      try {
        const data = await fetchCustos();
        setCustos(data);
      } catch (error) {
        console.error('Failed to fetch cost data:', error);
      } finally {
        setLoading(false);
      }
    };

    getCustos();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!custos) {
    return <div>Failed to load cost data</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Painel de Custos</h1>

      {custos.globalCircuitActive && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Alerta: Teto global de custos excedido!
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-2">Custo Total do Mês</h2>
          <p className="text-2xl">R$ {custos.totalCost.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-lg font-semibold mb-2">Custo Médio por Plano</h2>
          <p className="text-2xl">R$ {custos.avgCostPerPlan.toFixed(2)}</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow mb-4">
        <h2 className="text-lg font-semibold mb-2">Top 10 Clientes que Mais Gastam</h2>
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left">Cliente</th>
              <th className="text-right">Custo (R$)</th>
            </tr>
          </thead>
          <tbody>
            {custos.top10Clientes.map((cliente) => (
              <tr key={cliente.id}>
                <td>{cliente.id}</td>
                <td className="text-right">{cliente.cost.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CentralPage;
