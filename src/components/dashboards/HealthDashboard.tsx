import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { HealthDashboardData } from '../../lib/health';

interface HealthDashboardProps {
  data: HealthDashboardData;
}

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HealthDashboard({ data }: HealthDashboardProps) {
  const { samples, errorCountByRoute } = data;

  // (a) Dados para gráfico de linha: responseTime dos últimos 30 dias
  const chartData = samples.map((sample) => ({
    timestamp: formatTimestamp(sample.timestamp),
    responseTime: sample.metrics.responseTime,
    fullTimestamp: sample.timestamp,
  }));

  // (b) Quedas: errorRate > 1% (0.01) ou responseTime > 1000ms
  const drops = samples.filter(
    (sample) => sample.metrics.errorRate > 0.01 || sample.metrics.responseTime > 1000
  );

  // (c) Erros por rota acumulados
  const routeErrors = Object.entries(errorCountByRoute).map(([route, count]) => ({
    route,
    count,
  }));

  return (
    <div className="p-6 space-y-8" data-testid="health-dashboard">
      {/* Gráfico de linha de resposta */}
      <section aria-labelledby="response-time-title" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 id="response-time-title" className="text-xl font-semibold mb-4">
          Tempo de Resposta (últimos 30 dias)
        </h2>
        <div className="h-80" role="img" aria-label="Gráfico de linha do tempo de resposta">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>n              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} interval="preserveStartEnd" />
              <YAxis />
              <Tooltip
                formatter={(value: number) => [value, 'ms']}
                labelFormatter={(label: string) => label}
              />
              <Line
                type="monotone"
                dataKey="responseTime"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Tabela de quedas */}
        <section aria-labelledby="drops-title" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 id="drops-title" className="text-xl font-semibold mb-4">Quedas</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left" role="table">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 font-medium">Timestamp</th>
                  <th className="pb-2 font-medium">Response Time (ms)</th>
                  <th className="pb-2 font-medium">Error Rate (%)</th>
                </tr>
              </thead>
              <tbody>
                {drops.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-gray-500">
                      Nenhuma queda detectada
                    </td>
                  </tr>
                ) : (
                  drops.map((sample, index) => (
                    <tr key={index} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2">{formatTimestamp(sample.timestamp)}</td>
                      <td className="py-2">{sample.metrics.responseTime}</td>
                      <td className="py-2">{(sample.metrics.errorRate * 100).toFixed(2)}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Tabela de erros por rota */}
        <section aria-labelledby="route-errors-title" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 id="route-errors-title" className="text-xl font-semibold mb-4">Erros por Rota</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left" role="table">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 font-medium">Rota</th>
                  <th className="pb-2 font-medium">Erros Acumulados</th>
                </tr>
              </thead>
              <tbody>
                {routeErrors.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-4 text-center text-gray-500">
                      Nenhum erro registrado
                    </td>
                  </tr>
                ) : (
                  routeErrors.map((item, index) => (
                    <tr key={index} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="py-2 font-mono text-sm">{item.route}</td>
                      <td className="py-2">{item.count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
