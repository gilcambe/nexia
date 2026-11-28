import React from 'react';
import DailySpendCard from './DailySpendCard';

const Dashboard = () => {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Visão geral</h1>
      <p className="text-slate-500 text-sm">Acompanhe o uso diário de cada provedor de IA e o limite grátis.</p>

      <DailySpendCard />
    </div>
  );
};

export default Dashboard;
