import React from 'react';
import DailySpendCard from './DailySpendCard';

const Dashboard = () => {
  return (
    <div className="p-6 space-y-6">
      {/* Exibe o uso de IAs por provedor */}
      <DailySpendCard />
    </div>
  );
};

export default Dashboard;
