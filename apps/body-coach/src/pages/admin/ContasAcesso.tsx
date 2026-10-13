import { useState } from 'react';
import Card from '@/components/base/Card';
import { FILTROS, passaNoFiltro, situacaoDa, tipoNome, type Conta, type Filtro } from './contas';

// Lista de contas do admin com filtros (tipo, vence em 7 dias, sem acesso, pagantes) e busca por e-mail.
export default function ContasAcesso({ todas, liberar, fazer }: { todas: Conta[]; liberar: (uid: string, dias: number, ehCoach?: boolean) => void; fazer: (corpo: Record<string, unknown>, ok: string) => void }) {
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busca, setBusca] = useState('');
  const agora = Date.now();
  const contas = todas.filter((c) => passaNoFiltro(c, filtro, agora) && (!busca || c.email.includes(busca.toLowerCase())));
  return (
      <Card>
        <h2 className="font-semibold text-foreground-900">Contas</h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {FILTROS.map(([f, nome]) => <button key={f} onClick={() => setFiltro(f)} aria-pressed={filtro === f} className={`rounded-full px-3 py-1 text-xs font-semibold ${filtro === f ? 'bg-primary-500 text-background-50' : 'bg-background-100 text-foreground-700'}`}>{nome}</button>)}
        </div>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por e-mail" aria-label="Buscar por e-mail" className="mt-2 w-full rounded-lg border border-background-200 px-3 py-2 text-sm" />
        {contas.map((c) => (
          <div key={c.uid} className="mt-2 flex flex-wrap items-center gap-2 border-t border-background-200 pt-2 text-sm">
            <span className="flex-1 break-all">{c.email || c.uid}<br /><span className="text-foreground-500">{tipoNome[c.tipo] || 'Sem coach'} · {situacaoDa(c, agora)}</span></span>
            <button onClick={() => liberar(c.uid, 30, c.tipo === 'coach')} className="rounded-lg border border-primary-300 px-2 py-1.5 text-primary-700">+30 dias</button>
            <button onClick={() => liberar(c.uid, 365, c.tipo === 'coach')} className="rounded-lg border border-primary-300 px-2 py-1.5 text-primary-700">+1 ano</button>
            <button onClick={() => fazer({ acao: 'acesso_isento', uid: c.uid, isento: !c.isento }, c.isento ? 'Volta a seguir o plano.' : 'Conta isenta: nunca bloqueia.')} className="rounded-lg border border-background-300 px-2 py-1.5">{c.isento ? 'Tirar isenção' : 'Isentar'}</button>
          </div>
        ))}
      </Card>
  );
}
