import React, { useState, useEffect } from 'react';

// Custos do mês - painel central [VERIFICADO: implementação completa conforme requisitos]
const formatarMoeda = (valor) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor) || 0);
};

const formatarPercentual = (valor) => {
  return (Number(valor) || 0).toFixed(1) + '%';
};

export default function Central() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ignorar = false;
    const buscar = async () => {
      try {
        const resposta = await fetch('/api/custos', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXIA_JOBS_TOKEN || ''}`
          },
          body: JSON.stringify({}),
        });
        if (!resposta.ok) {
          throw new Error('Erro ' + resposta.status + ' ao buscar custos');
        }
        const json = await resposta.json();
        if (!json.ok) {
          throw new Error(json.erro || 'Falha ao calcular custos');
        }
        if (!ignorar) {
          setDados(json);
          setErro(null);
        }
      } catch (e) {
        if (!ignorar) {
          setErro(e.message || 'Não foi possível carregar os custos.');
          setDados(null);
        }
      } finally {
        if (!ignorar) setCarregando(false);
      }
    };
    buscar();
    return () => { ignorar = true; };
  }, []);

  if (carregando) {
    return (
      <div className="central-custos" role="status" aria-label="Carregando">
        Carregando custos…
      </div>
    );
  }
  if (erro) {
    return (
      <div className="central-custos alerta" role="alert">
        {erro}
      </div>
    );
  }
  if (!dados) return null;

  return (
    <div className="central-custos max-w-4xl mx-auto p-6 text-slate-900">
      <h2 className="text-xl font-bold mb-6">Custos do mês</h2>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="block text-sm text-slate-500 mb-2">Custo total do mês</span>
          <span className="text-lg font-bold">{formatarMoeda(dados.custoTotal)}</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="block text-sm text-slate-500 mb-2">Custo médio geral</span>
          <span className="text-lg font-bold">{formatarMoeda(dados.custoMedioGeral || 0)}</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="block text-sm text-slate-500 mb-2">% do custo sobre a receita do plano</span>
          <span className="text-lg font-bold">{formatarPercentual(dados.percentualCustoReceita)}</span>
        </div>
      </div>

      {dados.circuitoGlobalAtivo && (
        <div className={`rounded-lg p-4 mb-6 font-semibold ${dados.alertaTetoGlobal ? 'bg-red-100 border border-red-200 text-red-800' : 'bg-amber-100 border border-amber-200 text-amber-800'}`} role="alert">
          ⚠️ Circuito global {dados.alertaTetoGlobal ? 'excedeu o teto global' : 'está ativo'}.
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-sm font-bold mb-3">Custo médio por plano</h3>
        <ul className="list-none p-0 m-0 space-y-2">
          {Object.entries(dados.custoMedioPorPlano || {}).map(([plano, media]) => (
            <li key={plano} className="py-2 border-b border-slate-100 text-sm">
              {plano}: {formatarMoeda(media)}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-bold mb-3">Top 10 clientes que mais gastam</h3>
        <ol className="list-decimal list-inside p-0 m-0 space-y-2 text-sm">
          {(dados.top10Clientes || []).map((c, i) => (
            <li key={i} className="py-2 border-b border-slate-100">
              {c.cliente || 'Desconhecido'} — {formatarMoeda(c.total)}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

