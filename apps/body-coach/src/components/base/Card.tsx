import type { ReactNode } from 'react';

export default function Card({
  children,
  className = '',
  padding = 'p-5',
}: {
  children: ReactNode;
  className?: string;
  padding?: string;
}) {
  // Mobile first: no celular o espaço interno é menor; a partir de 640 px volta ao pedido.
  const pad = /^p-([5-9]|1[0-9])$/.test(padding) ? `p-4 sm:${padding}` : padding;
  return (
    <div className={`rounded-2xl border border-background-200 bg-background-50 ${pad} ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  icon,
  action,
}: {
  title: string;
  icon?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon && <i className={`${icon} text-lg text-primary-500`}></i>}
        <h2 className="font-heading text-base font-semibold text-foreground-950">{title}</h2>
      </div>
      {action}
    </div>
  );
}