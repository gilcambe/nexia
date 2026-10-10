import { useRef, useState } from 'react';
import Card from '@/components/base/Card';
import MonitorCardiaco from '@/components/feature/MonitorCardiaco';
import { useAuth } from '@/components/feature/AuthContext';
import { setUserDoc } from '@/lib/userData';
import { formatarMin } from '@/lib/ferramentas/calculadoras';
import { kcalPorMinuto, zerarSessaoFC } from '@/lib/ferramentas/frequencia';
import { kcalPercurso } from '@/lib/ferramentas/gps';
import { lerAtividade, type Atividade } from '@/lib/ferramentas/importarAtividade';

const MARCAS = [
  { nome: 'Garmin', como: 'Nas configurações de sensores do relógio (ou durante a atividade), ligue "Transmitir frequência cardíaca". Em alguns modelos, inicie a atividade "Corrida virtual" para transmitir.' },
  { nome: 'Polar', como: 'Cintas H10 e Verity Sense já transmitem sozinhas. Nos relógios, procure "Compartilhar FC com outros aparelhos".' },
  { nome: 'Amazfit / Zepp', como: 'No app Zepp, ative "Compartilhar frequência cardíaca" do relógio e deixe a tela de batimentos aberta.' },
  { nome: 'Xiaomi Mi Band', como: 'No app da pulseira, ative "Detectável" e "Compartilhar frequência cardíaca".' },
  { nome: 'Coros / Suunto', como: 'Nas configurações do relógio, ligue "Transmitir frequência cardíaca".' },
  { nome: 'Apple Watch / Galaxy Watch', como: 'Não transmitem batimentos para outros apps pelo Bluetooth. Exporte o treino em .GPX/.TCX (direto ou pelo Strava) e importe aqui.' },
];

export default function Relogio() {
  const { user, profile } = useAuth();
  const ob = (profile?.onboarding ?? {}) as Record<string, string | undefined>;
  const peso = Number(ob.weight) || 70;
  const arquivo = useRef<HTMLInputElement>(null);
  const [atv, setAtv] = useState<Atividade | null>(null);
  const [erro, setErro] = useState('');
  const [salvo, setSalvo] = useState(false);
  const [marca, setMarca] = useState<string | null>(null);

  const ler = async (f: File | undefined) => {
    setErro(''); setSalvo(false); setAtv(null);
    if (!f) return;
    if (f.size > 25_000_000) { setErro('Arquivo grande demais (máx. 25 MB).'); return; }
    try {
      const a = lerAtividade(f.name, await f.text());
      if (!a.minutos && !a.km) throw new Error('Não achei tempo nem distância nesse arquivo.');
      setAtv(a);
    } catch (e) {
      setErro((e as Error).message);
    }
  };
  // Calorias: as do relógio; sem elas, pela FC média; sem FC, pela distância.
  const kcal = atv ? (atv.kcal ?? (atv.fcMedia ? Math.round(kcalPorMinuto(atv.fcMedia, peso, Number(ob.age) || 30, /^f/i.test(profile?.gender ?? '') ? 'F' : 'M') * atv.minutos) : kcalPercurso(atv.km, peso, atv.tipo === 'Bike' ? 'bike' : atv.tipo === 'Caminhada' ? 'caminhada' : 'corrida'))) : 0;

  const salvar = async () => {
    if (!user || !atv) return;
    const w = {
      user_id: user.id, title: atv.nome.slice(0, 190), done_at: atv.inicio, duration_min: Math.max(1, atv.minutos),
      exercises: 0, sets: 0, volume_kg: 0, series_por_grupo: {}, melhores: {}, origem: 'relogio',
      fc_media: atv.fcMedia, fc_maxima: atv.fcMaxima, kcal,
      cardio: [{ tipo: atv.tipo, minutos: atv.minutos, km: Math.round(atv.km * 100) / 100, kcal }],
    };
    try {
      const key = `bc_workouts_${user.id}`;
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      if (!(Array.isArray(list) && list.some((x: { done_at?: string }) => x.done_at === w.done_at))) localStorage.setItem(key, JSON.stringify([...(Array.isArray(list) ? list : []), w]));
    } catch { /* sem armazenamento local */ }
    await setUserDoc(user.id, 'workouts', `relogio-${Date.parse(atv.inicio) || Date.now()}`, w).catch(() => {});
    setSalvo(true);
  };

  return (
    <div className="space-y-3">
      <Card>
        <h2 className="font-heading text-base font-semibold text-foreground-950">Batimentos ao vivo</h2>
        <p className="mb-3 mt-1 text-xs text-foreground-500">Conecte a cinta ou o relógio e veja BPM, zona e calorias reais. Também aparece no treino e na corrida com GPS.</p>
        <MonitorCardiaco />
        <button type="button" onClick={zerarSessaoFC} className="mt-2 w-full py-1 text-xs font-medium text-foreground-500">Zerar média e calorias</button>
      </Card>

      <Card>
        <h2 className="font-heading text-base font-semibold text-foreground-950">Importar treino do relógio</h2>
        <p className="mt-1 text-xs text-foreground-500">Exporte a atividade como .GPX ou .TCX no Garmin Connect, Strava (⋯ › Exportar GPX), Polar Flow, Coros ou Zepp e escolha o arquivo.</p>
        <input ref={arquivo} type="file" className="hidden" onChange={(e) => void ler(e.target.files?.[0])} />
        <button type="button" onClick={() => arquivo.current?.click()} className="mt-3 w-full rounded-xl bg-primary-500 py-3 text-sm font-semibold text-background-50 dark:text-foreground-950"><i className="ri-upload-2-line mr-1"></i>Escolher arquivo</button>
        {erro && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{erro}</p>}
        {atv && (
          <div className="mt-3 rounded-xl bg-background-100/70 p-3">
            <p className="font-semibold text-foreground-950">{atv.nome}</p>
            <p className="text-xs text-foreground-500">{new Date(atv.inicio).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })} · {atv.tipo}</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              {[
                [atv.km.toFixed(2), 'km'],
                [formatarMin(atv.minutos), 'tempo'],
                [atv.km > 0 ? formatarMin(atv.minutos / atv.km) : '—', 'ritmo /km'],
                [atv.fcMedia ?? '—', 'FC média'],
                [atv.fcMaxima ?? '—', 'FC máx.'],
                [kcal, 'kcal'],
              ].map(([v, l]) => (
                <div key={String(l)} className="rounded-lg bg-background-50 p-2">
                  <p className="font-heading text-lg font-bold text-foreground-950">{v}</p>
                  <p className="text-[11px] text-foreground-500">{l}</p>
                </div>
              ))}
            </div>
            {salvo
              ? <p className="mt-2 text-center text-sm font-medium text-emerald-700"><i className="ri-check-line mr-1"></i>Salvo no histórico de treinos.</p>
              : <button type="button" onClick={() => void salvar()} className="mt-3 w-full rounded-xl bg-foreground-950 py-3 text-sm font-semibold text-background-50">Salvar no histórico</button>}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-heading text-base font-semibold text-foreground-950">Como ligar a transmissão no seu relógio</h2>
        <p className="mt-1 text-xs text-foreground-500">O nome da opção muda conforme o modelo, e nem todo modelo tem.</p>
        <div className="mt-2 divide-y divide-background-200">
          {MARCAS.map((m) => (
            <div key={m.nome}>
              <button type="button" onClick={() => setMarca(marca === m.nome ? null : m.nome)} className="flex w-full items-center justify-between py-2.5 text-left text-sm font-semibold text-foreground-800">
                {m.nome}<i className={`ri-arrow-${marca === m.nome ? 'up' : 'down'}-s-line text-foreground-400`}></i>
              </button>
              {marca === m.nome && <p className="pb-3 text-xs text-foreground-600">{m.como}</p>}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="font-heading text-base font-semibold text-foreground-950">Em breve</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-foreground-600">
          <li><i className="ri-links-line mr-1 text-primary-500"></i>Strava conectado: os treinos do relógio chegam sozinhos.</li>
          <li><i className="ri-google-play-line mr-1 text-primary-500"></i>Health Connect e Apple Saúde: passos, sono e batimentos (na versão de loja do app).</li>
        </ul>
      </Card>
    </div>
  );
}
