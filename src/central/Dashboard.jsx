import React from 'react';
import DailySpendCard from './DailySpendCard';

const Dashboard = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <DailySpendCard />
      {/* Outros cards do dashboard */}
    </div>
  );
};

export default Dashboard;