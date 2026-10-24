import { useSearchParams } from 'react-router-dom';

// Abas no topo da tela: cada tópico mostra só a sua parte (sem rolar). A aba fica no endereço (?aba=), então voltar e recarregar mantêm.
export function useAba<T extends string>(ids: readonly T[], padrao: T): [T, (id: T) => void] {
  const [params, setParams] = useSearchParams();
  const pedida = params.get('aba') as T | null;
  const aba = pedida && ids.includes(pedida) ? pedida : padrao;
  const mudar = (id: T) => {
    const p = new URLSearchParams(params);
    if (id === padrao) p.delete('aba'); else p.set('aba', id);
    setParams(p, { replace: true });
    window.scrollTo({ top: 0 });
  };
  return [aba, mudar];
}

export default function Abas<T extends string>({ abas, atual, onMudar, rotulo }: { abas: readonly { id: T; label: string; icone?: string }[]; atual: T; onMudar: (id: T) => void; rotulo: string }) {
  return (
    <div className="grid gap-1 rounded-xl bg-background-100 p-1" style={{ gridTemplateColumns: `repeat(${abas.length}, minmax(0, 1fr))` }} role="tablist" aria-label={rotulo}>
      {abas.map((a) => (
        <button key={a.id} type="button" role="tab" aria-selected={atual === a.id} onClick={() => onMudar(a.id)}
          className={`truncate rounded-lg px-1 py-1.5 text-xs font-semibold ${atual === a.id ? 'bg-background-50 text-foreground-950 shadow-sm' : 'text-foreground-500'}`}>
          {a.icone && <i className={`${a.icone} mr-1`}></i>}{a.label}
        </button>
      ))}
    </div>
  );
}
