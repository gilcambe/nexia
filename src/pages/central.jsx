import React, { useState, useEffect } from 'react';

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
          headers: { 'Content-Type': 'application/json' },
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
    <div className="central-custos" style={estilos.container}>
      <h2 style={estilos.titulo}>Custos do mês</h2>

      <div style={estilos.resumo}>
        <div style={estilos.card}>
          <span style={estilos.rotulo}>Custo total do mês</span>
          <span style={estilos.valor}>{formatarMoeda(dados.custoTotal)}</span>
        </div>
        <div style={estilos.card}>
          <span style={estilos.rotulo}>Custo médio por plano</span>
          <span style={estilos.valor}>{formatarMoeda(dados.custoMedioGeral || 0)}</span>
        </div>
        <div style={estilos.card}>
          <span style={estilos.rotulo}>% do custo sobre a receita do plano</span>
          <span style={estilos.valor}>{formatarPercentual(dados.percentualCustoReceita)}</span>
        </div>
      </div>

      {dados.circuitoGlobalAtivo && (
        <div style={dados.alertaTetoGlobal ? estilos.alertaExcedido : estilos.alertaAtivo} role="alert">
          ⚠️ Circuito global {dados.alertaTetoGlobal ? 'excedeu o teto global' : 'está ativo'}.
        </div>
      )}

      <div style={estilos.secao}>
        <h3 style={estilos.subtitulo}>Custo médio por plano</h3>
        <ul style={estilos.lista}>
          {Object.entries(dados.custoMedioPorPlano || {}).map(([plano, media]) => (
            <li key={plano} style={estilos.itemLista}>
              {plano}: {formatarMoeda(media)}
            </li>
          ))}
        </ul>
      </div>

      <div style={estilos.secao}>
        <h3 style={estilos.subtitulo}>Top 10 clientes que mais gastam</h3>
        <ol style={estilos.lista}>
          {(dados.top10Clientes || []).map((c, i) => (
            <li key={i} style={estilos.itemLista}>
              {c.cliente || 'Desconhecido'} — {formatarMoeda(c.total)}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

const estilos = {
  container: { fontFamily: 'system-ui, sans-serif', maxWidth: '900px', margin: '0 auto', padding: '24px', color: '#111827' },
  titulo: { fontSize: '20px', fontWeight: '700', marginBottom: '20px' },
  resumo: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' },
  card: { flex: 1, minWidth: '200px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  rotulo: { display: 'block', fontSize: '13px', color: '#6b7280', marginBottom: '6px' },
  valor: { fontSize: '18px', fontWeight: '700', color: '#111827' },
  alertaAtivo: { background: '#fef3c7', border: '1px solid #f59e0b', color: '#92400e', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', fontWeight: '600' },
  alertaExcedido: { background: '#fee2e2', border: '1px solid #ef4444', color: '#991b1b', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '14px', fontWeight: '600' },
  secao: { marginBottom: '24px' },
  subtitulo: { fontSize: '16px', fontWeight: '700', marginBottom: '10px', color: '#111827' },
  lista: { listStyle: 'none', padding: 0, margin: 0 },
  itemLista: { padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: '14px' },
};

