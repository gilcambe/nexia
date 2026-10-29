import { ReactNode } from 'react';

interface CartaoProps {
  titulo: string;
  resumo?: string;
  icone?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export default function Cartao({ titulo, resumo, icone, children, className }: CartaoProps) {
  return (
    <div className={`rounded-lg border border-foreground-200 bg-background-100 p-4 ${className}`}>
      <div className="flex items-center gap-2">
        {icone && <div className="text-foreground-500">{icone}</div>}
        <h3 className="text-lg font-medium text-foreground-900">{titulo}</h3>
      </div>
      {resumo && <p className="mt-1 text-sm text-foreground-500">{resumo}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
