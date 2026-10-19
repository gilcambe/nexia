import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface HealthDataPoint {
  date: string;
  responseTime: number;
  errorRate: number;
}

interface ErrorDataPoint {
  date: string;
  hour: string;
  responseTime: number;
  errorRate: number;
}

interface RouteErrorData {
  route: string;
  errorCount: number;
}

interface HealthDashboardProps {
  data: {
    timelineData: HealthDataPoint[];
    downtimeData: ErrorDataPoint[];
    routeErrors: RouteErrorData[];
  };
}

const HealthDashboard: React.FC<HealthDashboardProps> = ({ data }) => {
  const { timelineData, downtimeData, routeErrors } = data;

  return (
    <div className="health-dashboard p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Dashboard de Saúde do Sistema</h2>
      
      {/* Gráfico de linha do tempo de resposta */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-4 text-gray-700">Linha do Tempo de Resposta (Últimos 30 dias)</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={timelineData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                yAxisId="left" 
                orientation="left" 
                stroke="#8884d8"
                label={{ value: 'Tempo de Resposta (ms)', angle: -90, position: 'insideLeft' }}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                stroke="#ff7300"
                label={{ value: 'Taxa de Erros (%)', angle: 90, position: 'insideRight' }}
              />
              <Tooltip 
                formatter={(value, name) => [value, name === 'responseTime' ? 'Tempo de Resposta (ms)' : 'Taxa de Erros (%)']}
                labelFormatter={(label) => `Data: ${label}`}
              />
              <Legend />
              <Line 
                yAxisId="left" 
                type="monotone" 
                dataKey="responseTime" 
                stroke="#8884d8" 
                name="Tempo de Resposta" 
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line 
                yAxisId="right" 
                type="monotone" 
                dataKey="errorRate" 
                stroke="#ff7300" 
                name="Taxa de Erros" 
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Tabela de quedas */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-4 text-gray-700">Quedas do Sistema</h3>
        <p className="text-sm text-gray-600 mb-4">Horas em que errorRate &gt; 1% ou responseTime &gt; 1000ms</p>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hora</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tempo de Resposta (ms)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Taxa de Erros (%)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {downtimeData.length > 0 ? (
                downtimeData.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.hour}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.responseTime}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.errorRate}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                    Nenhuma queda detectada no período
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Tabela de erros por rota */}
      <div>
        <h3 className="text-xl font-semibold mb-4 text-gray-700">Erros por Rota</h3>
        <p className="text-sm text-gray-600 mb-4">Erros acumulados no período</p>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rota</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantidade de Erros</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {routeErrors.length > 0 ? (
                routeErrors.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.route}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.errorCount}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="px-6 py-4 text-center text-sm text-gray-500">
                    Nenhum erro acumulado no período
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HealthDashboard;