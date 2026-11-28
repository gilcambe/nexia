import React from 'react';
import DailySpendCard from './DailySpendCard';

const Dashboard = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 gap-6">
        <DailySpendCard />
      </div>
    </div>
  );
};

export default Dashboard;
