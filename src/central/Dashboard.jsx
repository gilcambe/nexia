import React from 'react';
import DailySpendCard from './DailySpendCard';

// Utilitário para cores da barra - cores baseadas em percentual de uso
const getBarColor = (percent) => {
  if (percent > 90) return 'red';
  if (percent > 70) return 'yellow';
  return 'green';
};
import { useEffect, useState } from 'react';

const Dashboard = () => {
  return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <DailySpendCard />
        {/* Outros cards do dashboard */}
        <DailySpendCard />
      </div>
  );
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <DailySpendCard />
      {/* Outros cards do dashboard */}
      {/* Outros cards do dashboard */}
    </div>
  );
};

export default Dashboard;