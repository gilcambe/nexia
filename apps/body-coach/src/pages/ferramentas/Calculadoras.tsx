import { useState, type ReactNode } from 'react';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import {
  ANILHAS_KG, NIVEIS_ATIVIDADE, ZONAS_RM, aguaDia, anilhasPorLado, formatarMin, gastoDiario, preverProva, ritmo, umRM, zonasFC,
} from '@/lib/ferramentas/calculadoras';

const ABAS = [
  { id: 'rm', nome: '1RM', icone: 'ri-boxing-line' },
  { id: 'anilhas', nome: 'Anilhas', icone: 'ri-donut-chart-line' },
  { id: 'fc', nome: 'Zonas FC', icone: 'ri-heart-pulse-line' },
  { id: 'ritmo', nome: 'Ritmo', icone: 'ri-timer-flash-line' },
  { id: 'gasto', nome: 'Gasto', icone: 'ri-fire-line' },
  { id: 'agua', nome: 'Água', icone: 'ri-drop-line' },
] as const;
type Aba = (typeof ABAS)[number]['id'];

function Campo({ rotulo, valor, onChange, sufixo, passo = '1' }: { rotulo: string; valor: string; onChange: (v: string) => void; sufixo?: string; passo?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-foreground-600">{rotulo}</span>
      <span className="flex items-center rounded-lg border border-background-200 bg-background-50 focus-within:border-primary-300">
        <input inputMode="decimal" type="number" step={passo} value={valor} onChange={(e) => onChange(e.target.value)} className="w-full min-w-0 bg-transparent px-3 py-2.5 text-sm outline-none" />
        {sufixo && <span className="pr-3 text-xs text-foreground-400">{sufixo}</span>}
      </span>
    </label>
  );
}

function Resultado({ children }: { children: ReactNode }) {
  return <div className="rounded-xl bg-primary-50 p-3 text-sm text-foreground-800">{children}</div>;
}

const n = (s: string) => Number(String(s).replace(',', '.')) || 0;

export default function Calculadoras() {
  const { profile } = useAuth();
  const ob = (profile?.onboarding ?? {}) as Record<string, string | undefined>;
  const [aba, setAba] = useState<Aba>('rm');
  const [carga, setCarga] = useState('60');
  const [reps, setReps] = useState('8');
  const [total, setTotal] = useState('100');
  const [barra, setBarra] = useState('20');
  const [idade, setIdade] = useState(ob.age ?? '30');
  const [repouso, setRepouso] = useState('');
  const [km, setKm] = useState('5');
  const [min, setMin] = useState('30');
  const [alvo, setAlvo] = useState('10');
  const [peso, setPeso] = useState(ob.weight ?? '75');
  const [altura, setAltura] = useState(ob.height ?? '175');
  const [sexo, setSexo] = useState<'M' | 'F'>('M');
  const [atividade, setAtividade] = useState(1.55);
  const [horas, setHoras] = useState('1');

  const rm = umRM(n(carga), n(reps));
  const anilhas = anilhasPorLado(n(total), n(barra));
  const zonas = zonasFC(n(idade) || 30, n(repouso) || undefined);
  const prev = preverProva(n(km), n(min), n(alvo));
  const gasto = gastoDiario({ peso: n(peso), altura: n(altura), idade: n(idade), sexo, atividade });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {ABAS.map((a) => (
          <button key={a.id} type="button" onClick={() => setAba(a.id)} className={`flex flex-col items-center gap-0.5 rounded-xl py-2 text-xs font-semibold ${aba === a.id ? 'bg-primary-500 text-background-50 dark:text-foreground-950' : 'border border-background-200 bg-background-50 text-foreground-600'}`}>
            <i className={`${a.icone} text-base`}></i>{a.nome}
          </button>
        ))}
      </div>

      <Card>
        {aba === 'rm' && (
          <div className="space-y-3">
            <p className="text-sm text-foreground-600">Descubra sua carga máxima (1 repetição) sem testar no limite.</p>
            <div className="grid grid-cols-2 gap-2">
              <Campo rotulo="Carga levantada" valor={carga} onChange={setCarga} sufixo="kg" passo="0.5" />
              <Campo rotulo="Repetições" valor={reps} onChange={setReps} />
            </div>
            <Resultado><b className="text-lg">1RM ≈ {rm.toLocaleString('pt-BR')} kg</b></Resultado>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-foreground-400"><th className="py-1">%</th><th>Carga</th><th>Reps</th><th>Para</th></tr></thead>
              <tbody>
                {ZONAS_RM.map((z) => (
                  <tr key={z.pct} className="border-t border-background-200">
                    <td className="py-1.5 font-semibold">{z.pct}%</td>
                    <td>{(Math.round((rm * z.pct) / 100 * 2) / 2).toLocaleString('pt-BR')} kg</td>
                    <td>{z.reps}</td>
                    <td className="text-xs text-foreground-500">{z.uso}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {aba === 'anilhas' && (
          <div className="space-y-3">
            <p className="text-sm text-foreground-600">Quais anilhas colocar em cada lado da barra.</p>
            <div className="grid grid-cols-2 gap-2">
              <Campo rotulo="Carga total" valor={total} onChange={setTotal} sufixo="kg" passo="0.5" />
              <Campo rotulo="Peso da barra" valor={barra} onChange={setBarra} sufixo="kg" passo="0.5" />
            </div>
            <Resultado>
              {anilhas.lado.length === 0 ? 'Só a barra.' : (
                <>
                  <p className="font-semibold">Cada lado: {anilhas.lado.map((a) => `${a.toLocaleString('pt-BR')}`).join(' + ')} kg</p>
                  <div className="mt-2 flex items-center gap-1" aria-hidden>
                    <span className="h-2 w-10 rounded bg-foreground-400" />
                    {anilhas.lado.map((a, i) => (
                      <span key={i} className="rounded-sm bg-primary-600" style={{ width: 8 + a / 2, height: 20 + a * 2.4 }} />
                    ))}
                  </div>
                  {anilhas.sobra > 0 && <p className="mt-1 text-xs text-foreground-500">Sobram {anilhas.sobra} kg por lado sem anilha que feche certinho.</p>}
                </>
              )}
            </Resultado>
            <p className="text-xs text-foreground-400">Anilhas consideradas: {ANILHAS_KG.join(', ')} kg.</p>
          </div>
        )}

        {aba === 'fc' && (
          <div className="space-y-3">
            <p className="text-sm text-foreground-600">Zonas de batimentos para cardio. Com a FC de repouso fica mais preciso.</p>
            <div className="grid grid-cols-2 gap-2">
              <Campo rotulo="Idade" valor={idade} onChange={setIdade} sufixo="anos" />
              <Campo rotulo="FC de repouso (opcional)" valor={repouso} onChange={setRepouso} sufixo="bpm" />
            </div>
            <div className="space-y-1.5">
              {zonas.map((z) => (
                <div key={z.zona} className="flex items-center gap-3 rounded-xl bg-background-100/70 p-2.5">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white ${['bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-orange-500', 'bg-red-500'][z.zona - 1]}`}>Z{z.zona}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground-900">{z.nome} · {z.de}–{z.ate} bpm</p>
                    <p className="text-xs text-foreground-500">{z.uso}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {aba === 'ritmo' && (
          <div className="space-y-3">
            <p className="text-sm text-foreground-600">Seu ritmo por km e quanto faria em outra distância.</p>
            <div className="grid grid-cols-3 gap-2">
              <Campo rotulo="Distância" valor={km} onChange={setKm} sufixo="km" passo="0.1" />
              <Campo rotulo="Tempo" valor={min} onChange={setMin} sufixo="min" passo="0.5" />
              <Campo rotulo="Prova alvo" valor={alvo} onChange={setAlvo} sufixo="km" passo="0.1" />
            </div>
            <Resultado>
              <p>Ritmo: <b>{ritmo(n(km), n(min))}</b> · Velocidade: <b>{n(min) > 0 ? (n(km) / (n(min) / 60)).toFixed(1) : '—'} km/h</b></p>
              <p className="mt-1">Previsão para {n(alvo).toLocaleString('pt-BR')} km: <b>{formatarMin(prev)}</b> ({ritmo(n(alvo), prev)})</p>
            </Resultado>
            <div className="flex flex-wrap gap-1.5">
              {[['5 km', '5'], ['10 km', '10'], ['21 km', '21.0975'], ['42 km', '42.195']].map(([r, v]) => (
                <button key={r} type="button" onClick={() => setAlvo(v)} className="rounded-full border border-background-200 px-3 py-1 text-xs font-semibold text-foreground-600">{r}</button>
              ))}
            </div>
          </div>
        )}

        {aba === 'gasto' && (
          <div className="space-y-3">
            <p className="text-sm text-foreground-600">Quantas calorias seu corpo gasta por dia.</p>
            <div className="grid grid-cols-2 gap-2">
              <Campo rotulo="Peso" valor={peso} onChange={setPeso} sufixo="kg" passo="0.1" />
              <Campo rotulo="Altura" valor={altura} onChange={setAltura} sufixo="cm" />
              <Campo rotulo="Idade" valor={idade} onChange={setIdade} sufixo="anos" />
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-foreground-600">Sexo</span>
                <select value={sexo} onChange={(e) => setSexo(e.target.value as 'M' | 'F')} className="rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm">
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                </select>
              </label>
            </div>
            <select value={atividade} onChange={(e) => setAtividade(Number(e.target.value))} className="w-full rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm" aria-label="Nível de atividade">
              {NIVEIS_ATIVIDADE.map((a) => <option key={a.valor} value={a.valor}>{a.nome}</option>)}
            </select>
            <Resultado>
              <p>Basal (em repouso): <b>{gasto.basal.toLocaleString('pt-BR')} kcal</b></p>
              <p>Total do dia: <b>{gasto.total.toLocaleString('pt-BR')} kcal</b></p>
              <p className="mt-1 text-xs text-foreground-500">Para perder gordura: ~{(gasto.total - 400).toLocaleString('pt-BR')} kcal · Para ganhar massa: ~{(gasto.total + 300).toLocaleString('pt-BR')} kcal</p>
            </Resultado>
          </div>
        )}

        {aba === 'agua' && (
          <div className="space-y-3">
            <p className="text-sm text-foreground-600">Quanto beber hoje, contando o treino.</p>
            <div className="grid grid-cols-2 gap-2">
              <Campo rotulo="Peso" valor={peso} onChange={setPeso} sufixo="kg" passo="0.1" />
              <Campo rotulo="Horas de treino hoje" valor={horas} onChange={setHoras} sufixo="h" passo="0.5" />
            </div>
            <Resultado>
              <b className="text-lg">{(aguaDia(n(peso), n(horas)) / 1000).toLocaleString('pt-BR')} litros</b>
              <p className="text-xs text-foreground-500">≈ {Math.round(aguaDia(n(peso), n(horas)) / 250)} copos de 250 ml. No calor, beba mais.</p>
            </Resultado>
          </div>
        )}
      </Card>
      <p className="text-center text-[11px] text-foreground-400">Estimativas de referência. Não substituem avaliação profissional.</p>
    </div>
  );
}
