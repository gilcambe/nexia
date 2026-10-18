import React, { useEffect, useState } from 'react';
import { monitorService } from '../services/monitor';

export function CentralAlertas() {
  const [failures, setFailures] = useState<Record<string, number>>({});

  useEffect(() => {
    const interval = setInterval(() => {
      setFailures({ ...monitorService.getFailures() });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-200 dark:border-gray-800">
      <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">Central de Alertas de Queda</h2>
      {Object.keys(failures).length === 0 ? (
        <p className="text-green-600 dark:text-green-400">Todos os sistemas operando normalmente (24h monitorados).</p>
      ) : (
        <ul className="space-y-2">
          {Object.entries(failures).map(([name, count]) => (
            <li key={name} className="p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded border border-red-200 dark:border-red-800 flex justify-between items-center">
              <span><strong>{name}</strong> falhou {count} vez(es) seguidas.</span>
              <span className="text-xs uppercase px-2 py-1 bg-red-200 dark:bg-red-900 rounded">Alerta Ativo</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
