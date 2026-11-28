import React from 'react';
import { api } from '../services/api';
import { utilBarColor } from './utilBarColor';

/**
 * Percentual de uso do limite gratuito de um provedor.
 * Aceita pct/percent/percentual direto ou calcula used/limit.
 */
function percentual(provider) {
  const direto = provider?.pct ?? provider?.percent ?? provider?.percentual;
  if (direto !== undefined && direto !== null && direto !== '') return Number(direto) || 0;
  const used = Number(provider?.used ?? provider?.usage ?? provider?.requests ?? 0) || 0;
  const limit = Number(provider?.limit ?? provider?.freeLimit ?? 0) || 0;
  if (limit > 0) return (used / limit) * 100;
  return 0;
}

/**
 * Componente DailySpendCard - Exibe o uso de cada provedor de IA.
 * Cores: >70% amarelo, >90% vermelho.
 */
const DailySpendCard = () => {
  const [usageData, setUsageData] = React.useState([]);
  const [status, setStatus] = React.useState('loading');
  const [httpStatus, setHttpStatus] = React.useState(null);

  React.useEffect(() => {
    let cancelado = false;
    const fetchUsage = async () => {
      try {
        const res = await api.usage();
        if (cancelado) return;
        const data = res?.data ?? {};
        const list = Array.isArray(data)
          ? data
          : (data?.providers ?? data?.usage ?? data?.items ?? null);
        if (res?.error || !Array.isArray(list)) {
          console.error('Resposta inesperada de /api/usage:', res?.status, res?.error ?? data);
          setHttpStatus(res?.status);
          setStatus('error');
          return;
        }
        setUsageData(list);
        setStatus('ready');
      } catch (err) {
        if (cancelado) return;
        console.error('Erro ao carregar uso das IAs:', err);
        setStatus('error');
      }
    };
    fetchUsage();
    // Atualiza o gasto do dia quando a aba volta a ficar visível.
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') fetchUsage();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      cancelado = true;
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, []);

  if (status === 'loading') {
    return (
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.06)] p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Gasto de hoje</h2>
        <p className="text-slate-500 text-sm">Carregando uso das IAs...</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.06)] p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Gasto de hoje</h2>
        <p className="text-red-600 text-sm">
          Não foi possível carregar o uso das IAs{httpStatus ? ` (HTTP ${httpStatus})` : ''}. Confira seu acesso e tente atualizar a página.
        </p>
      </div>
    );
  }

  if (!usageData || usageData.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.06)] p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Gasto de hoje</h2>
        <p className="text-slate-500 text-sm">Nenhum provedor com uso hoje.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.06)] p-5">
      <h2 className="font-semibold text-slate-900 mb-4">Gasto de hoje</h2>
      <p className="text-slate-500 text-xs mb-3">Limite grátis: amarelo acima de 70%, vermelho acima de 90%.</p>
      <div className="space-y-3">
        {usageData.map((provider, index) => (
          <div key={index} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-slate-700 font-medium">
                {provider.name || provider.provider || provider.model || 'Provedor'}
              </span>
              <span className="text-slate-500">{Math.round(percentual(provider))}% do limite grátis</span>
              {percentual(provider) > 90 && (
                <span className="text-red-600 text-xs font-semibold">Acima de 90%</span>
              )}
              {percentual(provider) > 70 && percentual(provider) <= 90 && (
                <span className="text-amber-600 text-xs font-semibold">Acima de 70%</span>
              )}
            </div>
            <div
              className="relative h-3 rounded-full bg-slate-100 overflow-hidden mt-1"
              data-provider={provider.name || provider.provider || provider.model || 'Provedor'}
              data-percent={Math.round(percentual(provider))}
              role="progressbar"
              aria-label={`Uso de ${provider.name || provider.provider || provider.model || 'Provedor'}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(percentual(provider))}
              aria-valuetext={`${Math.round(percentual(provider))}% do limite grátis`}
            >
              <div
                aria-hidden="true"
                className={`h-full rounded-full transition-all duration-300 ${utilBarColor(percentual(provider))}`}
                style={{ width: `${Math.max(2, Math.min(100, percentual(provider)))}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DailySpendCard;
