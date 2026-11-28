import React from 'react';
import DailySpendCard from './DailySpendCard';

const Dashboard = () => {
  return (
    <div className="p-6 space-y-6">
      {/* Card "Gasto de hoje": uma barra por provedor de IA, com a cor do limite grátis (utilBarColor). */}
      <section aria-label="Gasto de hoje por provedor de IA">
        <DailySpendCard />
      </section>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>
    </div>
  );
};

export default Dashboard;
