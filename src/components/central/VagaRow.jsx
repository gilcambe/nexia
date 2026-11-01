import React from 'react';

const VagaRow = ({ vaga, onPause, onOrder }) => {
  const handlePause = () => {
    onPause(vaga.id, !vaga.paused);
  };

  const handleOrder = (direction) => {
    onOrder(vaga.id, direction);
  };

  return (
    <tr>
      <td>{vaga.title}</td>
      <td>{vaga.paused ? 'Pausada' : 'Ativa'}</td>
      <td>
        <button
          onClick={handlePause}
          className="px-2 py-1 bg-blue-500 text-white rounded"
        >
          {vaga.paused ? 'Ligar' : 'Pausar'}
        </button>
        <button
          onClick={() => handleOrder('up')}
          className="ml-2 px-2 py-1 bg-gray-500 text-white rounded"
        >
          ↑
        </button>
        <button
          onClick={() => handleOrder('down')}
          className="ml-2 px-2 py-1 bg-gray-500 text-white rounded"
        >
          ↓
        </button>
      </td>
    </tr>
  );
};

export default VagaRow;
