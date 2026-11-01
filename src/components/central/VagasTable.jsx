import React from 'react';
import VagaRow from './VagaRow';

const VagasTable = ({ vagas, onPause, onOrder }) => {
  return (
    <table className="w-full">
      <thead>
        <tr>
          <th>Título</th>
          <th>Status</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        {vagas.map((vaga) => (
          <VagaRow
            key={vaga.id}
            vaga={vaga}
            onPause={onPause}
            onOrder={onOrder}
          />
        ))}
      </tbody>
    </table>
  );
};

export default VagasTable;
