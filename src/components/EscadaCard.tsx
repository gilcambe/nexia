import { useEffect, useState } from "react";
import { apiPath } from "@/config/env";
import { Cartao, Sinal } from "../pages/central/ui";

export interface EscadaData {
  faseB: boolean;
  fila: number;
  julesHoje: string;
  semana: {
    cortex: number;
    iasGratis: number;
    claude: number;
  };
}

export default function EscadaCard() {
  const [dados, setDados] = useState<EscadaData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const buscarDados = async () => {
      try {
        const resp = await fetch(apiPath("/escada"));
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        setDados(json);
      } catch (e) {
        setErro((e as Error).message);
      } finally {
        setCarregando(false);
      }
    };
    buscarDados();
  }, []);

  if (carregando) {
    return (
      <Cartao titulo="🪜 Escada" icone="lista" resumo="Carregando...">
        <div className="space-y-3">
          <div className="h-2 bg-nexia-surface2 rounded animate-pulse" />
          <div className="h-2 bg-nexia-surface2 rounded animate-pulse" />
          <div className="h-2 bg-nexia-surface2 rounded animate-pulse" />
        </div>
      </Cartao>
    );
  }

  if (erro || !dados) {
    return (
      <Cartao titulo="🪜 Escada" icone="alerta" resumo="Erro ao carregar">
        <p className="text-sm text-nexia-muted">Não foi possível buscar os dados da escada.</p>
      </Cartao>
    );
  }

  const { faseB, fila, julesHoje, semana } = dados;

  return (
    <Cartao titulo="🪜 Escada" icone="lista">
      <div className="space-y-4">
        {/* Barras de progresso da semana */}
        <div className="space-y-3">
          <ProgressBar label="Cortex" value={semana.cortex} cor="cyan" />
          <ProgressBar label="IAs grátis" value={semana.iasGratis} cor="verde" />
          <ProgressBar label="Claude" value={semana.claude} cor="roxo" />
        </div>

        {/* Números da fila e Jules */}
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl bg-nexia-surface2 p-3">
            <p className="text-2xl font-bold text-white">{fila}</p>
            <p className="text-xs text-nexia-muted">na fila</p>
          </div>
          <div className="rounded-xl bg-nexia-surface2 p-3">
            <p className="text-2xl font-bold text-white">{julesHoje}</p>
            <p className="text-xs text-nexia-muted">Jules hoje</p>
          </div>
        </div>

        {/* Selo verde quando faseB for true */}
        {faseB && (
          <Sinal cor="verde" className="inline-flex items-center gap-1 text-sm font-medium" style={{ fontSize: "0.875rem" }}>
            Pronto para fase B
          </Sinal>
        )}
      </div>
    </Cartao>
  );
}

function ProgressBar({ label, value, cor }: { label: string; value: number; cor: "cyan" | "verde" | "roxo" }) {
  const CORES = {
    cyan: "bg-nexia-cyan",
    verde: "bg-emerald-400",
    roxo: "bg-purple-500",
  };
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-medium">
        <span>{label}</span>
        <span className="text-nexia-muted">{value}%</span>
      </div>
      <div className="h-2 bg-nexia-surface2 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%` }}
        >
          <span className={`${CORES[cor]} h-full block rounded-full`} />
        </div>
      </div>
    </div>
  );
}
