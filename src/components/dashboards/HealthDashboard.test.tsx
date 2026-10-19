import React from 'react';
import { render, screen } from '@testing-library/react';
import HealthDashboard from './HealthDashboard';

// Fixture de dados para teste
const mockHealthData = {
  timelineData: [
    { date: '2024-01-01', responseTime: 150, errorRate: 0.5 },
    { date: '2024-01-02', responseTime: 200, errorRate: 0.8 },
    { date: '2024-01-03', responseTime: 800, errorRate: 0.2 },
    { date: '2024-01-04', responseTime: 1200, errorRate: 1.5 },
    { date: '2024-01-05', responseTime: 180, errorRate: 0.3 },
  ],
  downtimeData: [
    { date: '2024-01-04', hour: '14:00', responseTime: 1200, errorRate: 1.5 },
    { date: '2024-01-04', hour: '15:00', responseTime: 1100, errorRate: 1.2 },
    { date: '2024-01-04', hour: '16:00', responseTime: 1050, errorRate: 1.1 },
  ],
  routeErrors: [
    { route: '/api/users', errorCount: 15 },
    { route: '/api/products', errorCount: 8 },
    { route: '/api/orders', errorCount: 5 },
  ],
};

describe('HealthDashboard', () => {
  it('deve renderizar os rótulos das tabelas corretamente', () => {
    render(<HealthDashboard data={mockHealthData} />);

    // Verificar rótulos das seções
    expect(screen.getByText('Linha do Tempo de Resposta (Últimos 30 dias)')).toBeInTheDocument();
    expect(screen.getByText('Quedas do Sistema')).toBeInTheDocument();
    expect(screen.getByText('Erros por Rota')).toBeInTheDocument();

    // Verificar rótulos das tabelas de quedas
    expect(screen.getByText(/Tempo de Resposta \(ms\)/)).toBeInTheDocument();
    expect(screen.getByText(/Taxa de Erros \(\%\)/)).toBeInTheDocument();

    // Verificar rótulos das tabelas de erros por rota
    expect(screen.getByText('Rota')).toBeInTheDocument();
    expect(screen.getByText('Quantidade de Erros')).toBeInTheDocument();
  });

  it('deve renderizar a tabela de quedas quando houver dados', () => {
    render(<HealthDashboard data={mockHealthData} />);

    // Verificar que os dados aparecem na tabela de quedas
    expect(screen.getByText('2024-01-04')).toBeInTheDocument();
    expect(screen.getByText('14:00')).toBeInTheDocument();
    expect(screen.getByText('1200')).toBeInTheDocument();
    expect(screen.getByText('1.5')).toBeInTheDocument();
  });

  it('deve renderizar a tabela de erros por rota quando houver dados', () => {
    render(<HealthDashboard data={mockHealthData} />);

    // Verificar que os dados aparecem na tabela de erros por rota
    expect(screen.getByText('/api/users')).toBeInTheDocument();
    expect(screen.getByText('/api/products')).toBeInTheDocument();
    expect(screen.getByText('/api/orders')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('deve renderizar mensagem de nenhum erro quando não houver dados', () => {
    const emptyData = {
      timelineData: [],
      downtimeData: [],
      routeErrors: [],
    };

    render(<HealthDashboard data={emptyData} />);

    expect(screen.getByText(/Nenhuma queda detectada no período/)).toBeInTheDocument();
    expect(screen.getByText(/Nenhum erro acumulado no período/)).toBeInTheDocument();
  });
});