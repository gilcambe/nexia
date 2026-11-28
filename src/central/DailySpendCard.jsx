import React from 'react';
import { getUsage } from './index';
import { utilBarColor } from './utilBarColor';

/**
 * Percentual de uso do limite gratuito de um provedor.
 * Aceita pct/percent/percentual direto ou calcula used/limit.
 */
function percentual(provider) {
  const direto = provider?.pct ?? provider?.percent ?? provider?.percentual;
  if (direto !== undefined && direto !== null && direto !== '') return Number(direto) || 0;
  const used = Number(provider?.used ?? provider?.usage ?? provider?.requests ?? 0) || 0;
  // Limite gratuito real da matriz (dados da matriz), que vem em /api/usage (parte 2).
  const limit = Number(provider?.limit ?? provider?.freeLimit ?? provider?.free_limit ?? provider?.max ?? 0) || 0;
  if (limit > 0) return (used / limit) * 100;
  // Sem limite informado pela matriz, não inventa: mostra 0 e o card explica.
  return 0;
}

/**
 * Componente DailySpendCard - Exibe o uso de cada provedor de IA.
 * Cores: >70% amarelo, >90% vermelho.
 */
const DailySpendCard = () => {
  const [usageData, setUsageData] = React.useState([]);
  const [status, setStatus] = React.useState('loading');

  React.useEffect(() => {
    let cancelado = false;
    const fetchUsage = async () => {
      try {
        const list = await getUsage();
        if (cancelado) return;
        if (!Array.isArray(list)) {
          console.error('getUsage nao devolveu lista de provedores.');
          setStatus('error');
          return;
        }
        setUsageData(list);
        setStatus('ready');
      } catch {
        if (cancelado) return;
        console.error('Erro ao carregar uso das IAs.');
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
          Não foi possível carregar o uso das IAs. Confira seu acesso e tente atualizar a página.
        </p>
      </div>
    );
  }

  if (!Array.isArray(usageData) || usageData.length === 0) {
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
      <p className="text-slate-500 text-xs mb-3">
        Limite grátis da matriz: amarelo acima de 70%, vermelho acima de 90%. Provedor sem limite informado fica em 0%.
      </p>
      <div className="space-y-3">
        {usageData.map((provider, index) => {
          const pct = percentual(provider);
          const nome = provider.name || provider.provider || provider.model || 'Provedor';
          const isTest = provider.is_test === true || provider.mode === 'test';
          return (
          <div key={`${nome}-${index}`} className="space-y-1">
            <div className="flex justify-between items-start gap-2 text-sm">
              <span className="text-slate-700 font-medium break-words">
                {nome}
              </span>
              <span className="flex flex-wrap justify-end items-center gap-1 shrink-0 text-right">
                <span className="text-slate-500">{Math.round(pct)}% do limite grátis</span>
                {isTest && (
                  <span className="text-sky-700 bg-sky-50 border border-sky-200 text-xs font-semibold px-2 py-0.5 rounded-full">Modo de teste</span>
                )}
                {pct > 90 && (
                  <span className="text-red-600 text-xs font-semibold">Acima de 90%</span>
                )}
                {pct > 70 && pct <= 90 && (
                  <span className="text-amber-600 text-xs font-semibold">Acima de 70%</span>
                )}
              </span>
            </div>
            <div
              title={`${Math.round(pct)}% do limite grátis`}
              className="relative h-3 rounded-full bg-slate-100 overflow-hidden mt-1"
              data-provider={nome}
              data-percent={Math.round(pct)}
              role="progressbar"
              aria-label={`Uso de ${nome}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(pct)}
              aria-valuetext={`${Math.round(pct)}% do limite grátis`}
            >
              <div
                aria-hidden="true"
                className={`h-full rounded-full transition-all duration-300 ${utilBarColor(pct)}`}
                style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
              ></div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
};

export default DailySpendCard;
