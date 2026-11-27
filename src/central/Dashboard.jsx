import React from 'react';
import DailySpendCard from './DailySpendCard';
import { utilBarColor } from './utilBarColor';

const Dashboard = () => {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className="inline-block h-2 w-6 rounded-full bg-indigo-500"></span>
        <span>até 70%</span>
        <span className="inline-block h-2 w-6 rounded-full bg-amber-500"></span>
        <span>acima de 70%</span>
        <span className="inline-block h-2 w-6 rounded-full bg-red-500"></span>
        <span>acima de 90%</span>
      </div>
      <DailySpendCard />
    </div>
  );
};

export default Dashboard;
