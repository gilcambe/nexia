import React, { useEffect, useState } from 'react';
import { useCentral } from './central/api';
import { Abre, Folha, Grupo, TarefasPorConta } from './central/celular';

const CentralPage = () => {
  const { buscar } = useCentral();
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const cortexData = await buscar('cortex');
        setDados(cortexData);
      } catch (error) {
        console.error('Failed to fetch Cortex data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [buscar]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!dados) {
    return <div>Failed to load Cortex data</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Central NEXIA</h1>

      <Grupo titulo="Tarefas">
        <Abre titulo="Tarefas do Cortex" id="tarefas-cortex">
          <div>
            <h2 className="text-lg font-semibold mb-2">Tarefas do Cortex</h2>
            {dados.cortex.tarefasPorConta && <TarefasPorConta tarefas={dados.cortex.tarefasPorConta} />}
          </div>
        </Abre>
      </Grupo>
    </div>
  );
};

export default CentralPage;
