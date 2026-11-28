import React from 'react';
import DailySpendCard from './DailySpendCard';

const Dashboard = () => {
  return (
    <div className="p-6 space-y-6">
      {/* Card "Gasto de hoje": uma barra por provedor de IA, com a cor do limite grátis (utilBarColor). */}
      <section aria-label="Gasto de hoje por provedor de IA">
        <DailySpendCard />
      </section>
    </div>
  );
};

export default Dashboard;
