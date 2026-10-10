import { useState } from 'react';

// Campo rápido para digitar ou corrigir a medida de uma parte do corpo (em cm) ao tocar no "+".
export default function EditarMedida({ nome, atual, onSalvar, onFechar }: {
  nome: string;
  atual: number | null;
  onSalvar: (cm: number) => Promise<void>;
  onFechar: () => void;
}) {
  const [txt, setTxt] = useState(atual != null ? String(atual).replace('.', ',') : '');
  const [estado, setEstado] = useState<null | 'salvando' | 'ok' | string>(null);
  const valor = Number(txt.replace(',', '.'));
  const valido = txt.trim() !== '' && Number.isFinite(valor) && valor >= 10 && valor <= 250;

  const salvar = async () => {
    if (!valido) return;
    setEstado('salvando');
    try {
      await onSalvar(Math.round(valor * 10) / 10);
      setEstado('ok');
    } catch (e) {
      setEstado(`Não consegui salvar: ${e instanceof Error ? e.message : 'erro'}`);
    }
  };

  return (
    <div className="rounded-xl border border-primary-200 bg-primary-50/60 p-3" data-testid="editar-medida">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground-900">{nome}</p>
        <button type="button" onClick={onFechar} className="text-foreground-500" aria-label="Fechar"><i className="ri-close-line"></i></button>
      </div>
      <p className="mb-2 text-xs text-foreground-600">{atual != null ? `Última medida: ${atual.toLocaleString('pt-BR')} cm.` : 'Ainda sem medida.'} Digite a de hoje com a fita métrica.</p>
      <div className="flex gap-2">
        <input
          inputMode="decimal"
          value={txt}
          onChange={(e) => { setTxt(e.target.value); setEstado(null); }}
          placeholder="ex.: 78,5"
          aria-label={`Medida de ${nome} em cm`}
          className="w-full rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-sm"
        />
        <span className="self-center text-sm text-foreground-500">cm</span>
        <button type="button" onClick={() => void salvar()} disabled={!valido || estado === 'salvando'} className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {estado === 'salvando' ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
      {estado === 'ok' && <p className="mt-2 text-xs font-medium text-accent-700">Medida salva na avaliação de hoje.</p>}
      {estado && estado !== 'ok' && estado !== 'salvando' && <p className="mt-2 text-xs text-red-600">{estado}</p>}
    </div>
  );
}
