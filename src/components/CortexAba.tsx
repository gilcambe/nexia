import React from 'react';
import { Cartao } from './ui';

const CortexAba: React.FC = () => {
  return (
    <div className="flex flex-col gap-4">
      <Cartao
        titulo="Contas de reserva"
        icone="chave"
        resumo="Gerencie suas contas de reserva"
        className="border-dark"
      />
      {/* Other cards */}
    </div>
  );
};

export default CortexAba;
