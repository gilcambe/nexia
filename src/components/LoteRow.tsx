import React from 'react';

interface LoteRowProps {
  nome: string;
  etapa: string;
  linkPreview: string;
  prints: string[];
  slugs: string[];
  onAprovar: (slugs: string[]) => void;
}

const LoteRow: React.FC<LoteRowProps> = ({ nome, etapa, linkPreview, prints, slugs, onAprovar }) => {
  return (
    <tr className="border-b border-gray-200 hover:bg-gray-100">
      <td className="py-3 px-6 text-left whitespace-nowrap">{nome}</td>
      <td className="py-3 px-6 text-left">{etapa}</td>
      <td className="py-3 px-6 text-left">
        <a href={linkPreview} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
          Preview
        </a>
      </td>
      <td className="py-3 px-6 text-left">
        {prints.map((print, index) => (
          <a key={index} href={print} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline block">
            Print {index + 1}
          </a>
        ))}
      </td>
      <td className="py-3 px-6 text-left">
        <button
          onClick={() => onAprovar(slugs)}
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
        >
          Aprovar e publicar
        </button>
      </td>
    </tr>
  );
};

export default LoteRow;
