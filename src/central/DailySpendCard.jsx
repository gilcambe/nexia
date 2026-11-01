import React from 'react';
import { getUsage } from './api';
import { utilBarColor } from './utilBarColor';

const DailySpendCard = () => {
  const [usageData, setUsageData] = React.useState([]);

  React.useEffect(() => {
    const fetchUsage = async () => {
      const data = await getUsage();
      setUsageData(data);
    };
    fetchUsage();
  }, []);

  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.06)] p-5">
      <h2 className="font-semibold text-slate-900 mb-4">Gasto de hoje</h2>
      <div className="space-y-3">
        {usageData.map((provider, index) => (
          <div key={index} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-slate-700">{provider.name}</span>
              <span className="text-slate-500">{Math.round(provider.pct)}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${utilBarColor(provider.pct)}`}
                style={{ width: `${Math.max(2, Math.min(100, provider.pct))}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DailySpendCard;