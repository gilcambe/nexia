import React, { useState, useEffect } from 'react';
import LoteRow from '../../components/LoteRow';

interface LoteData {
  nome: string;
  etapa: string;
  linkPreview: string;
  prints: string[];
  slugs: string[];
}

const LoteClientes: React.FC = () => {
  const [lotes, setLotes] = useState<LoteData[]>([]);
  const [novoLoteSlugs, setNovoLoteSlugs] = useState('');

  useEffect(() => {
    const fetchLotes = async () => {
      try {
        const response = await fetch('/api/lote/latest');
        const data = await response.json();
        setLotes(data);
      } catch (error) {
        console.error('Error fetching lotes:', error);
      }
    };

    fetchLotes();
  }, []);

  const handleAprovar = async (slugs: string[]) => {
    try {
      await fetch('/api/lote/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ slugs, publicar: 'producao' }),
      });
      alert('Lote aprovado e publicado com sucesso!');
    } catch (error) {
      console.error('Error approving lote:', error);
      alert('Erro ao aprovar lote.');
    }
  };

  const handleNovoLote = async () => {
    const slugsArray = novoLoteSlugs.split(',').map(slug => slug.trim());
    try {
      await fetch('/api/lote/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ slugs: slugsArray, publicar: 'producao' }),
      });
      alert('Novo lote criado com sucesso!');
      setNovoLoteSlugs('');
    } catch (error) {
      console.error('Error creating new lote:', error);
      alert('Erro ao criar novo lote.');
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Lote de Clientes</h1>
      <div className="mb-4">
        <input
          type="text"
          value={novoLoteSlugs}
          onChange={(e) => setNovoLoteSlugs(e.target.value)}
          placeholder="Digite os slugs separados por vírgula"
          className="border border-gray-300 rounded px-4 py-2 mr-2"
        />
        <button
          onClick={handleNovoLote}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Novo Lote
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead>
            <tr className="bg-gray-200 text-gray-600 uppercase text-sm leading-normal">
              <th className="py-3 px-6 text-left">Nome</th>
              <th className="py-3 px-6 text-left">Etapa</th>
              <th className="py-3 px-6 text-left">Link Preview</th>
              <th className="py-3 px-6 text-left">Prints</th>
              <th className="py-3 px-6 text-left">Ações</th>
            </tr>
          </thead>
          <tbody className="text-gray-600 text-sm font-light">
            {lotes.map((lote, index) => (
              <LoteRow
                key={index}
                nome={lote.nome}
                etapa={lote.etapa}
                linkPreview={lote.linkPreview}
                prints={lote.prints}
                slugs={lote.slugs}
                onAprovar={handleAprovar}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LoteClientes;
