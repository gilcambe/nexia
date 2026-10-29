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

interface EscadaCardProps {
  abaInicial?: 'geral' | 'cortex';
}

export default function EscadaCard({ abaInicial }: EscadaCardProps) {
  const [data, setData] = useState<EscadaData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let montado = true;
    const token = localStorage.getItem('nexia_token') || undefined;

    fetch('/api/escada', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error('Erro ao carregar escada');
        return res.json();
      })
      .then((dados) => {
        if (montado) setData(dados as EscadaData);
      })
      .catch((err) => {
        if (montado) setError(err.message);
      });

    return () => {
      montado = false;
    };
  }, []);

  const pct = (v: number | undefined) => Math.min(100, Math.max(0, v ?? 0));

  const faseB = data?.faseB === true;
  const julesToday = data?.julesHoje ?? data?.jules_hoje ?? data?.julesToday ?? 0;
  const fila = data?.fila ?? data?.filaSemana ?? 0;

  const barraCortex = pct(data?.semana?.cortex ?? data?.progresso?.cortex);
  const barraIasGratis = pct(data?.semana?.iasGratis ?? data?.progresso?.iasGratis ?? data?.ias_gratis);
  const barraClaude = pct(data?.semana?.claude ?? data?.progresso?.claude);

  return (
    <section className="escada-card" data-testid="escada-card">
      <header className="escada-header">
        <h2>🪜 Escada</h2>
        <p className="escada-sub" data-testid="escada-sub">
          Acompanhe o avanço do Cortex nesta semana.
        </p>
      </header>

      {error ? (
        <p className="erro" data-testid="escada-erro">
          {error}
        </p>
      ) : (
        <>
          <div className="barras" data-testid="escada-barras">
            <div className="barra" data-testid="barra-cortex">
              <label className="rotulo" data-testid="rotulo-cortex">
                Cortex
              </label>
              <div className="progresso" data-testid="progresso-cortex">
                <div
                  className="preenchido"
                  data-testid="barra-cortex-preenchido"
                  style={{ width: `${barraCortex}%` }}
                />
              </div>
              <span className="valor" data-testid="valor-cortex">
                {barraCortex}%
              </span>
            </div>

            <div className="barra" data-testid="barra-ias-gratis">
              <label className="rotulo" data-testid="rotulo-ias-gratis">
                IAs grátis
              </label>
              <div className="progresso" data-testid="progresso-ias-gratis">
                <div
                  className="preenchido"
                  data-testid="barra-ias-gratis-preenchido"
                  style={{ width: `${barraIasGratis}%` }}
                />
              </div>
              <span className="valor" data-testid="valor-ias-gratis">
                {barraIasGratis}%
              </span>
            </div>

            <div className="barra" data-testid="barra-claude">
              <label className="rotulo" data-testid="rotulo-claude">
                Claude
              </label>
              <div className="progresso" data-testid="progresso-claude">
                <div
                  className="preenchido"
                  data-testid="barra-claude-preenchido"
                  style={{ width: `${barraClaude}%` }}
                />
              </div>
              <span className="valor" data-testid="valor-claude">
                {barraClaude}%
              </span>
            </div>
          </div>

          <div className="numeros" data-testid="escada-numeros">
            <div className="numero" data-testid="numero-fila">
              <span className="rotulo" data-testid="rotulo-fila">
                Fila
              </span>
              <span className="valor" data-testid="valor-fila">
                {fila}
              </span>
            </div>
            <div className="numero" data-testid="numero-jules">
              <span className="rotulo" data-testid="rotulo-jules">
                Jules hoje
              </span>
              <span className="valor" data-testid="valor-jules">
                {julesToday}/15
              </span>
            </div>
          </div>

          {faseB && (
            <div className="selo" data-testid="selo-fase-b">
              ✅ Pronto para fase B
            </div>
          )}
        </>
      )}
    </section>
  );
}

import { useState, useEffect } from 'react';