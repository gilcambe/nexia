import type { ReactNode } from 'react';

export interface CartaoProps {
  titulo: string;
  resumo?: string;
  icone?: ReactNode;
}

export default function Cartao({ titulo, resumo, icone }: CartaoProps): JSX.Element {
  return (
    <article className="cartao" role="region" aria-label={titulo}>
      <header className="cartao-header">
        {icone && <span className="cartao-icone" aria-hidden="true">{icone}</span>}
        <h1 className="cartao-titulo">{titulo}</h1>
      </header>
      {resumo && (
        <p className="cartao-resumo">{resumo}</p>
      )}
    </article>
  );
}
