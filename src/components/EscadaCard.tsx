import { useState, useEffect } from 'react';

interface EscadaDados {
  faseB?: boolean;
  fila?: number;
  julesHoje?: string;
  semana?: {
    cortex?: number;
    iasGratis?: number;
    claude?: number;
  };
}

export default function EscadaCard() {
  const [dados, setDados] = useState<EscadaDados | null>(null);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const carregarDados = async () => {
      try {
        const res = await fetch('/escada');
        if (!res.ok) throw new Error('Falha ao carregar /escada');
        const json = await res.json();
        setDados(json);
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Erro desconhecido');
      } finally {
        setCarregando(false);
      }
    };

    carregarDados();
  }, []);

  const progressoCortex = dados?.semana?.cortex ?? dados?.semana?.cortex ?? 75;
  const progressoIasGratis = dados?.semana?.iasGratis ?? dados?.semana?.iasGratis ?? 90;
  const progressoClaude = dados?.semana?.claude ?? dados?.semana?.claude ?? 60;

  if (carregando) {
    return (
      <div className="rounded-xl bg-nexia-surface p-4 border border-nexia-border space-y-3 shadow-sm" data-testid="escada-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🪜</span>
            <h3 className="font-semibold text-white">Escada</h3>
          </div>
        </div>
        <div className="text-xs text-nexia-muted py-2">Carregando dados da escada...</div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="rounded-xl bg-nexia-surface p-4 border border-nexia-border space-y-3 shadow-sm" data-testid="escada-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🪜</span>
            <h3 className="font-semibold text-white">Escada</h3>
          </div>
        </div>
        <div className="text-xs text-red-400 py-2">{erro}</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-nexia-surface p-4 border border-nexia-border space-y-3 shadow-sm" data-testid="escada-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🪜</span>
          <h3 className="font-semibold text-white">Escada</h3>
        </div>
        {dados?.faseB && (
          <span className="px-2 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Pronto para fase B
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <div className="text-xs font-medium text-nexia-muted">Progresso da semana (meta: 100%)</div>
          
          <div className="space-y-1.5">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Cortex</span>
                <span className="font-medium text-white">{progressoCortex}%</span>
              </div>
              <div className="h-2 w-full bg-nexia-surface2 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, Math.max(0, progressoCortex))}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>IAs grátis</span>
                <span className="font-medium text-white">{progressoIasGratis}%</span>
              </div>
              <div className="h-2 w-full bg-nexia-surface2 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, Math.max(0, progressoIasGratis))}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Claude</span>
                <span className="font-medium text-white">{progressoClaude}%</span>
              </div>
              <div className="h-2 w-full bg-nexia-surface2 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, Math.max(0, progressoClaude))}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-nexia-border/50 text-xs">
          <div className="bg-nexia-surface2 p-2 rounded-lg">
            <div className="text-nexia-muted">Números da fila</div>
            <div className="font-semibold text-white mt-0.5 text-sm">{dados?.fila ?? 0} itens</div>
          </div>
          <div className="bg-nexia-surface2 p-2 rounded-lg">
            <div className="text-nexia-muted">Jules hoje</div>
            <div className="font-semibold text-white mt-0.5 text-sm">{dados?.julesHoje ?? "0/15"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}