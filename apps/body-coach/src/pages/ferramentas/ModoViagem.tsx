import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/base/Card';
import { DICAS_VIAGEM, montarTreinoViagem, type Equipamento, type OpcoesViagem } from '@/lib/ferramentas/modoViagem';
import { duracaoMin } from '@/lib/ferramentas/treinosProntos';
import { Player } from './TreinosProntos';

const EQUIP: { id: Equipamento; nome: string; icone: string }[] = [
  { id: 'nada', nome: 'Nada', icone: 'ri-hotel-bed-line' },
  { id: 'elastico', nome: 'Elástico', icone: 'ri-links-line' },
  { id: 'halteres', nome: 'Halteres', icone: 'ri-boxing-line' },
  { id: 'academia', nome: 'Academia do hotel', icone: 'ri-building-line' },
];
const FOCOS: { id: OpcoesViagem['foco']; nome: string }[] = [
  { id: 'corpo', nome: 'Corpo todo' }, { id: 'pernas', nome: 'Pernas e glúteo' }, { id: 'superior', nome: 'Peito, costas e braços' }, { id: 'cardio', nome: 'Cardio' },
];
const chip = (ativo: boolean) => `rounded-full px-3 py-1.5 text-sm font-semibold ${ativo ? 'bg-primary-500 text-background-50' : 'border border-background-200 bg-background-50 text-foreground-700'}`;

// Viajando? Monta o treino com o tempo e o que tiver no quarto, e guia por voz no mesmo player dos treinos prontos.
export default function ModoViagem() {
  const [o, setO] = useState<OpcoesViagem>({ minutos: 20, equipamento: 'nada', silencioso: true, foco: 'corpo', nivel: 'Intermediário' });
  const [ativo, setAtivo] = useState(false);
  const treino = useMemo(() => montarTreinoViagem(o), [o]);
  const muda = (p: Partial<OpcoesViagem>) => setO((v) => ({ ...v, ...p }));

  if (ativo) return <Player treino={treino} onSair={() => setAtivo(false)} />;
  const exs = [...new Set(treino.blocos.slice(3, -1).filter((b) => !b.descanso).map((b) => b.nome))];

  return (
    <div className="space-y-3">
      <Card>
        <h2 className="text-sm font-semibold text-foreground-900">Quanto tempo você tem?</h2>
        <div className="mt-2 flex flex-wrap gap-2">{[10, 15, 20, 30, 45].map((m) => <button key={m} type="button" onClick={() => muda({ minutos: m })} className={chip(o.minutos === m)}>{m} min</button>)}</div>
        <h2 className="mt-4 text-sm font-semibold text-foreground-900">O que tem aí?</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {EQUIP.map((e) => (
            <button key={e.id} type="button" onClick={() => muda({ equipamento: e.id })} className={`flex items-center gap-2 rounded-xl p-3 text-left text-sm font-semibold ${o.equipamento === e.id ? 'bg-primary-500 text-background-50' : 'border border-background-200 bg-background-50 text-foreground-700'}`}><i className={`${e.icone} text-lg`}></i>{e.nome}</button>
          ))}
        </div>
        <h2 className="mt-4 text-sm font-semibold text-foreground-900">Foco</h2>
        <div className="mt-2 flex flex-wrap gap-2">{FOCOS.map((f) => <button key={f.id} type="button" onClick={() => muda({ foco: f.id })} className={chip(o.foco === f.id)}>{f.nome}</button>)}</div>
        <h2 className="mt-4 text-sm font-semibold text-foreground-900">Nível</h2>
        <div className="mt-2 flex flex-wrap gap-2">{(['Iniciante', 'Intermediário', 'Avançado'] as const).map((n) => <button key={n} type="button" onClick={() => muda({ nivel: n })} className={chip(o.nivel === n)}>{n}</button>)}</div>
        <label className="mt-4 flex items-center justify-between gap-3 text-sm text-foreground-800">
          <span><b>Silencioso</b> · sem saltos, para não incomodar o quarto de baixo</span>
          <input type="checkbox" role="switch" checked={o.silencioso} onChange={(e) => muda({ silencioso: e.target.checked })} className="h-5 w-5 accent-primary-500" />
        </label>
      </Card>
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground-400">Seu treino</p>
        <h2 className="font-heading text-lg font-bold text-foreground-950">{treino.nome}</h2>
        <p className="text-sm text-foreground-600">{treino.desc} Cerca de {duracaoMin(treino)} min com aquecimento.</p>
        <ul className="mt-2 list-inside list-disc text-sm text-foreground-700">{exs.map((e) => <li key={e}>{e}</li>)}</ul>
        <button type="button" onClick={() => setAtivo(true)} className="mt-3 w-full rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-background-50"><i className="ri-play-fill mr-1"></i>Começar com voz</button>
      </Card>
      <Link to="/ferramentas/mapa" className="flex items-center gap-3 rounded-2xl border border-background-200 bg-background-50 p-3.5">
        <i className="ri-map-2-line text-xl text-primary-600"></i>
        <span className="flex-1 text-sm"><b>Academias e parques perto do hotel</b><br /><span className="text-foreground-500">Ache onde correr ou treinar na cidade</span></span>
        <i className="ri-arrow-right-s-line text-xl text-foreground-400"></i>
      </Link>
      <Card>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-400">Dicas de viagem</h3>
        <ul className="mt-2 space-y-2 text-sm text-foreground-700">{DICAS_VIAGEM.map((d) => <li key={d} className="flex gap-2"><i className="ri-plane-line mt-0.5 text-primary-500"></i><span>{d}</span></li>)}</ul>
      </Card>
    </div>
  );
}
