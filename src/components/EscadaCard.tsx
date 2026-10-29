import { useEffect, useState } from 'react';

interface EscadaData {
  semana?: {
    cortex?: number;
    iasGratis?: number;
    claude?: number;
  };
  progresso?: {
    cortex?: number;
    iasGratis?: number;
    claude?: number;
  };
  ias_gratis?: number;
  fila?: number;
  filaSemana?: number;
  julesHoje?: number;
  jules_hoje?: number;
  julesToday?: number;
  faseB?: boolean;
}

const pct = (v: number) => Math.min(100, Math.max(0, v));

export default function EscadaCard() {
  const [cortex, setCortex] = useState(0);
  const [iasGratis, setIasGratis] = useState(0);
  const [claude, setClaude] = useState(0);
  const [fila, setFila] = useState(0);
  const [julesToday, setJulesToday] = useState(0);
  const [faseB, setFaseB] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem('nexia_token') || undefined;
    fetch('/api/escada', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.json())
      .then((data: EscadaData) => {
        setCortex(data.semana?.cortex ?? data.progresso?.cortex ?? 0);
        setIasGratis(
          data.semana?.iasGratis ??
            data.ias_gratis ??
            data.progresso?.iasGratis ??
            0,
        );
        setClaude(data.semana?.claude ?? data.progresso?.claude ?? 0);
        setFila(data.fila ?? data.filaSemana ?? 0);
        setJulesToday(
          data.julesHoje ?? data.jules_hoje ?? data.julesToday ?? 0,
        );
        setFaseB(data.faseB === true);
      })
      .catch((err) => {
        console.error('[EscadaCard] falha ao carregar /api/escada:', err);
        // valores padrão já definidos (0 e false)
      });
  }, []);

  return (
    <section className="escada-card" data-testid="escada-card">
      <header className="escada-header">
        <h2>🪜 Escada</h2>
        <p className="escada-sub" data-testid="escada-sub">
          Acompanhe o avanço do Cortex nesta semana.
        </p>
      </header>

      <div className="barras" data-testid="escada-barras">
        <div className="barra" data-testid="barra-cortex">
          <label className="rotulo" data-testid="rotulo-cortex">
            Cortex
          </label>
          <div className="progresso" data-testid="progresso-cortex">
            <div
              className="preenchido"
              style={{ width: `${pct(cortex)}%` }}
              data-testid="barra-cortex-preenchido"
            ></div>
          </div>
          <span className="valor" data-testid="valor-cortex">
            {cortex}%
          </span>
        </div>

        <div className="barra" data-testid="barra-ias-gratis">
          <label className="rotulo" data-testid="rotulo-ias-gratis">
            IAs grátis
          </label>
          <div className="progresso" data-testid="progresso-ias-gratis">
            <div
              className="preenchido"
              style={{ width: `${pct(iasGratis)}%` }}
              data-testid="barra-ias-gratis-preenchido"
            ></div>
          </div>
          <span className="valor" data-testid="valor-ias-gratis">
            {iasGratis}%
          </span>
        </div>

        <div className="barra" data-testid="barra-claude">
          <label className="rotulo" data-testid="rotulo-claude">
            Claude
          </label>
          <div className="progresso" data-testid="progresso-claude">
            <div
              className="preenchido"
              style={{ width: `${pct(claude)}%` }}
              data-testid="barra-claude-preenchido"
            ></div>
          </div>
          <span className="valor" data-testid="valor-claude">
            {claude}%
          </span>
        </div>
      </div>

      <div className="numeros" data-testid="escada-numeros">
        <div className="numero" data-testid="fila">
          <span className="rotulo" data-testid="rotulo-fila">
            Fila
          </span>
          <span className="valor" data-testid="valor-fila">
            {fila}
          </span>
        </div>
        <div className="numero" data-testid="jules">
          <span className="rotulo" data-testid="rotulo-jules">
            Jules hoje
          </span>
          <span className="valor" data-testid="valor-jules">
            {julesToday}/15
          </span>
        </div>
      </div>

      {faseB && (
        <div className="selo" data-testid="badge-fase-b">
          ✅ Pronto para fase B
        </div>
      )}
    </section>
  );
}
