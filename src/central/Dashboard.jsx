import React from 'react';
import DailySpendCard from './DailySpendCard';

const Dashboard = () => {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Visão geral</h1>

      <DailySpendCard />
    </div>
  );
};

export default Dashboard;
