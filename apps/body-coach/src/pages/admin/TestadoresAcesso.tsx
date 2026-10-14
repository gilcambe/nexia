import { useEffect, useState } from 'react';
import Card from '@/components/base/Card';
import { dataCurta } from '@/lib/acesso';
import { listarTestadores, type Testador } from '@/lib/testador';

// Quem virou testador do app Android (o Google Play pede 12 por 14 dias).
export default function TestadoresAcesso() {
  const [lista, setLista] = useState<Testador[] | null>(null);
  useEffect(() => { void listarTestadores().then((r) => setLista(r.testadores)).catch(() => setLista([])); }, []);
  if (!lista) return null;
  return (
    <Card>
      <h2 className="font-semibold text-foreground-950"><i className="ri-android-line mr-1"></i>Testadores do Android: {lista.length} de 12</h2>
      {lista.length === 0 ? <p className="mt-1 text-sm text-foreground-500">Ninguém ainda. O convite fica em /testador.</p> : (
        <ul className="mt-2 divide-y divide-background-200 text-sm">
          {lista.map((t) => (
            <li key={t.uid} className="flex justify-between gap-2 py-1.5">
              <span className="min-w-0 truncate">{t.email || t.nome || t.uid}</span>
              <span className="shrink-0 text-foreground-500">{dataCurta(t.em)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
