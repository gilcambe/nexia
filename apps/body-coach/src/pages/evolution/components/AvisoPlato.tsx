import { useEffect, useState } from 'react';
import Card from '@/components/base/Card';
import { carregarTreinos } from '@/lib/ferramentas/useHistorico';
import { acharPlatos, type Plato } from '@/lib/plato';

// Avisa quando um exercício parou de evoluir (3+ treinos e 3+ semanas sem melhorar) e diz o que mudar.
export default function AvisoPlato({ uid }: { uid?: string }) {
  const [platos, setPlatos] = useState<Plato[]>([]);
  const [fechados, setFechados] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('bc_plato_ok') || '[]'); } catch { return []; } });
  useEffect(() => {
    if (!uid) return;
    let vivo = true;
    void carregarTreinos(uid).then((t) => { if (vivo) setPlatos(acharPlatos(t)); }).catch(() => undefined);
    return () => { vivo = false; };
  }, [uid]);
  const fechar = (nome: string) => {
    const n = [...fechados, `${nome}|${new Date().toISOString().slice(0, 7)}`];
    setFechados(n);
    try { localStorage.setItem('bc_plato_ok', JSON.stringify(n.slice(-50))); } catch { /* ok */ }
  };
  const mes = new Date().toISOString().slice(0, 7);
  const vistos = platos.filter((p) => !fechados.includes(`${p.exercicio}|${mes}`));
  if (!vistos.length) return null;
  return (
    <Card padding="p-3">
      <h2 className="font-heading text-base font-semibold text-foreground-950" data-testid="aviso-plato"><i className="ri-pause-circle-line mr-1 text-amber-600"></i>Parou de evoluir</h2>
      <ul className="mt-2 space-y-2">
        {vistos.map((p) => (
          <li key={p.exercicio} className="rounded-xl bg-amber-50 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-foreground-900"><strong>{p.exercicio}</strong>: {p.semanas} semanas sem passar de {p.melhor.weight} kg × {p.melhor.reps} ({p.treinos} treinos).</p>
              <button type="button" onClick={() => fechar(p.exercicio)} aria-label={`Dispensar aviso de ${p.exercicio}`} className="shrink-0 text-foreground-500"><i className="ri-close-line"></i></button>
            </div>
            <p className="mt-1 text-sm text-amber-800"><i className="ri-lightbulb-line mr-1"></i>{p.dica}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
