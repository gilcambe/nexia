import React, { useEffect, useState } from 'react';
import { useCentral } from './central/api';

const CentralPage = () => {
  const { buscar, enviarTodasTarefasParaContas } = useCentral();
  const [cortex, setCortex] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await buscar('cortex');
        setCortex(data);
      } catch (error) {
        console.error('Failed to fetch cortex data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [buscar]);

  const handleEnviarTarefas = async () => {
    try {
      await enviarTodasTarefasParaContas();
      alert('Todas as tarefas foram enviadas para as contas ajudarem a resolver.');
    } catch (error) {
      console.error('Failed to send tasks to accounts:', error);
      alert('Falha ao enviar tarefas para as contas.');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!cortex) {
    return <div>Failed to load cortex data</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Central NEXIA</h1>

      <button
        onClick={handleEnviarTarefas}
        className="mb-4 bg-blue-500 text-white px-4 py-2 rounded"
      >
        Enviar Todas as Tarefas para as Contas
      </button>

      <div className="bg-white p-4 rounded shadow mb-4">
        <h2 className="text-lg font-semibold mb-2">Tarefas na Fila</h2>
        <p>{cortex.naFila}</p>
      </div>

      <div className="bg-white p-4 rounded shadow mb-4">
        <h2 className="text-lg font-semibold mb-2">Tarefas em Andamento</h2>
        <ul>
          {cortex.fazendo.map((tarefa) => (
            <li key={tarefa.numero}>{tarefa.titulo}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default CentralPage;
