import type { ReactNode } from 'react';

// Aviso de "ainda não tem nada" que ocupa o espaço livre do cartão (ícone grande e texto centralizado),
// para a tela não ficar com um cartão esticado e vazio. O cartão pai precisa ser "flex flex-col".
export default function EstadoVazio({ icone, texto, acao, testId }: { icone: string; texto: ReactNode; acao?: ReactNode; testId?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-background-300 p-3 text-center alto:gap-2 alto:p-4" data-testid={testId ?? 'estado-vazio'}>
      <i className={`${icone} hidden text-5xl text-primary-400 alto:block`} aria-hidden="true"></i>
      <p className="max-w-xs text-sm text-foreground-600 alto:text-base">{texto}</p>
      {acao}
    </div>
  );
}
