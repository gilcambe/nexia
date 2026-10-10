import { useState } from 'react';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import { setUserDoc } from '@/lib/userData';
import { linkGoogleAgenda } from '@/lib/lembretes';

type Sup = { nome: string; dose: string; hora: string };
const SUGESTOES: Sup[] = [
  { nome: 'Creatina', dose: '3–5 g', hora: '08:00' },
  { nome: 'Whey protein', dose: '30 g', hora: '17:00' },
  { nome: 'Vitamina D', dose: '1 cápsula', hora: '12:00' },
  { nome: 'Ômega 3', dose: '1 g', hora: '12:00' },
  { nome: 'Magnésio', dose: '1 cápsula', hora: '22:00' },
  { nome: 'Multivitamínico', dose: '1 cápsula', hora: '08:00' },
];
const hoje = () => new Date().toISOString().slice(0, 10);

export default function Suplementos() {
  const { user, profile, refreshProfile } = useAuth();
  const lista: Sup[] = profile?.suplementos ?? [];
  const [novo, setNovo] = useState<Sup>({ nome: '', dose: '', hora: '08:00' });
  const chave = user ? `bc_sup_${user.id}_${hoje()}` : '';
  const [tomados, setTomados] = useState<string[]>(() => {
    try { return chave ? JSON.parse(localStorage.getItem(chave) || '[]') : []; } catch { return []; }
  });

  const salvar = (l: Sup[]) => {
    if (user) void setUserDoc(user.id, 'profile', 'main', { suplementos: l }, true).then(refreshProfile).catch(() => {});
  };
  const adicionar = (s: Sup) => {
    if (!s.nome.trim() || lista.some((x) => x.nome.toLowerCase() === s.nome.trim().toLowerCase())) return;
    salvar([...lista, { nome: s.nome.trim().slice(0, 60), dose: s.dose.trim().slice(0, 40), hora: s.hora }].sort((a, b) => a.hora.localeCompare(b.hora)));
    setNovo({ nome: '', dose: '', hora: '08:00' });
  };
  const marcar = (nome: string) => {
    const l = tomados.includes(nome) ? tomados.filter((x) => x !== nome) : [...tomados, nome];
    setTomados(l);
    try { if (chave) localStorage.setItem(chave, JSON.stringify(l)); } catch { /* sem armazenamento */ }
  };

  return (
    <div className="space-y-3">
      <Card>
        <h2 className="font-heading text-base font-semibold text-foreground-950">Hoje</h2>
        {lista.length === 0 ? (
          <p className="mt-2 text-sm text-foreground-500">Nenhum suplemento ainda. Adicione abaixo.</p>
        ) : (
          <>
            <p className="mt-0.5 text-xs text-foreground-500">{tomados.filter((t) => lista.some((s) => s.nome === t)).length} de {lista.length} tomados</p>
            <ul className="mt-3 space-y-2">
              {lista.map((s) => {
                const ok = tomados.includes(s.nome);
                return (
                  <li key={s.nome} className="flex items-center gap-2 rounded-xl bg-background-100/70 p-2.5">
                    <button type="button" onClick={() => marcar(s.nome)} aria-pressed={ok} aria-label={`Marcar ${s.nome} como tomado`} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${ok ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-background-300 text-transparent'}`}>
                      <i className="ri-check-line text-lg"></i>
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate font-semibold ${ok ? 'text-foreground-400 line-through' : 'text-foreground-900'}`}>{s.nome}</p>
                      <p className="text-xs text-foreground-500">{s.hora}{s.dose ? ` · ${s.dose}` : ''}</p>
                    </div>
                    <a href={linkGoogleAgenda(`Tomar ${s.nome}`, s.hora, s.dose ? `Dose: ${s.dose}` : '')} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-primary-700" aria-label={`Lembrete diário de ${s.nome} no Google Agenda`}><i className="ri-alarm-line text-lg"></i></a>
                    <button type="button" onClick={() => salvar(lista.filter((x) => x.nome !== s.nome))} className="rounded-lg p-2 text-foreground-400" aria-label={`Remover ${s.nome}`}><i className="ri-delete-bin-line"></i></button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      <Card>
        <h2 className="font-heading text-base font-semibold text-foreground-950">Adicionar</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Nome (ex.: Creatina)" className="col-span-2 rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm" aria-label="Nome do suplemento" />
          <input value={novo.dose} onChange={(e) => setNovo({ ...novo, dose: e.target.value })} placeholder="Dose (ex.: 5 g)" className="rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm" aria-label="Dose" />
          <input type="time" value={novo.hora} onChange={(e) => setNovo({ ...novo, hora: e.target.value })} className="rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm" aria-label="Horário" />
        </div>
        <button type="button" onClick={() => adicionar(novo)} className="mt-2 w-full rounded-xl bg-primary-500 py-3 font-semibold text-background-50 dark:text-foreground-950">Adicionar</button>
        <p className="mt-3 text-xs font-semibold text-foreground-500">Toque para adicionar rápido:</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {SUGESTOES.filter((s) => !lista.some((x) => x.nome === s.nome)).map((s) => (
            <button key={s.nome} type="button" onClick={() => adicionar(s)} className="rounded-full border border-background-200 px-3 py-1.5 text-xs font-medium text-foreground-700">+ {s.nome}</button>
          ))}
        </div>
      </Card>
      <p className="text-[11px] text-foreground-400">Atleta federado? Confira cada suplemento na aba Anti-Doping. Doses são exemplos comuns; siga a orientação do seu nutricionista ou médico.</p>
    </div>
  );
}
