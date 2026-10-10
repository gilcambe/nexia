import { lazy, Suspense, useMemo, useState, Component, type ReactNode } from 'react';
import { mapaMelhora, mapaVolume, medidasDoCorpo, type Regiao } from '@/lib/avaliacao/corpo';
import { valoresDaMeta, type MetasMedidas } from '@/lib/avaliacao/metas';
import { dataBr } from '@/lib/avaliacao/calculos';
import type { PerfilAvaliacao } from '@/lib/avaliacao/dados';
import type { ItemSerie } from '@/lib/avaliacao/serie';
import type { PoseCorpo } from './Corpo3D';
import Fotos360 from './Fotos360';
import CorpoRealista from './CorpoRealista';

const Corpo3D = lazy(() => import('./Corpo3D'));

function temWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

class SemWebGL extends Component<{ reserva: ReactNode; children: ReactNode }, { erro: boolean }> {
  state = { erro: false };
  static getDerivedStateFromError() { return { erro: true }; }
  render() { return this.state.erro ? this.props.reserva : this.props.children; }
}

const VOL = (n: number) => (n >= 18 ? '#1d4ed8' : n >= 10 ? '#3b82f6' : n >= 5 ? '#93c5fd' : n > 0 ? '#dbeafe' : '#c9ced6');
const MELHORA = { melhorou: '#40c057', piorou: '#fd7e14', igual: '#c9ced6' } as const;

type Modo = 'treino' | 'melhora';

// Corpo 3D do aluno: montado com as medidas da última avaliação (não é escaneamento da câmera).
// Duas leituras de cor: músculos treinados na semana ou o que melhorou desde a avaliação anterior.
export default function PainelCorpo({ serie, perfil, volume, nome, metas, onSalvarMedida }: { serie: ItemSerie[]; perfil: PerfilAvaliacao; volume: Record<string, number>; nome?: string; metas?: MetasMedidas | null; onSalvarMedida?: (campo: string, cm: number) => Promise<void> }) {
  const comMedidas = serie.filter((s) => s.m.peso != null || s.m.cintura != null);
  const ultima = comMedidas[comMedidas.length - 1] ?? null;
  const anterior = comMedidas.length > 1 ? comMedidas[comMedidas.length - 2] : null;
  // Sem escolha do usuário, segue os dados (que chegam depois do primeiro desenho).
  const [modoEscolhido, setModo] = useState<Modo | null>(null);
  const modo: Modo = modoEscolhido ?? (anterior ? 'melhora' : 'treino');
  const [pose, setPose] = useState<PoseCorpo>('relaxado');
  const [girar, setGirar] = useState(true);
  const [comparar, setComparar] = useState<null | 'anterior' | 'meta'>(null);
  const temMeta = !!metas && Object.keys(metas).some((k) => k !== 'gordura');
  const webgl = useMemo(temWebGL, []);
  // Com as fotos do aluno, o padrão é ele de verdade girando; o boneco 3D fica como segunda opção.
  const comFotos = [...serie].reverse().find((s) => Object.values(s.fotos).filter(Boolean).length >= 2) ?? null;
  const [vistaEscolhida, setVista] = useState<'fotos' | 'realista' | 'boneco' | null>(null);
  const vista = vistaEscolhida ?? 'realista';
  // A medida mais recente de cada parte (a última avaliação pode ter só algumas).
  const recentes = useMemo(() => {
    const v: Record<string, number> = {};
    for (const s of serie) for (const [k, n] of Object.entries(s.av.valores)) if (n != null && Number.isFinite(n)) v[k] = n;
    return v;
  }, [serie]);
  const gordura = [...serie].reverse().find((s) => s.m.gordura != null)?.m.gordura ?? null;

  const medidas = useMemo(
    () => medidasDoCorpo(ultima?.av.valores ?? {}, ultima?.av.sexo ?? perfil.sexo, perfil.altura),
    [ultima, perfil.sexo, perfil.altura],
  );
  const fantasma = useMemo(
    () => (comparar === 'anterior' && anterior ? medidasDoCorpo(anterior.av.valores, anterior.av.sexo ?? perfil.sexo, perfil.altura)
      : comparar === 'meta' && metas ? medidasDoCorpo(valoresDaMeta(ultima?.av.valores ?? {}, metas), ultima?.av.sexo ?? perfil.sexo, perfil.altura)
        : null),
    [comparar, anterior, ultima, metas, perfil.sexo, perfil.altura],
  );
  const cores = useMemo(() => {
    const out: Partial<Record<Regiao, string>> = {};
    if (modo === 'treino') {
      for (const [k, n] of Object.entries(mapaVolume(volume))) out[k as Regiao] = VOL(n ?? 0);
    } else if (ultima && anterior) {
      for (const [k, st] of Object.entries(mapaMelhora(anterior.m, ultima.m))) if (st) out[k as Regiao] = MELHORA[st];
    }
    return out;
  }, [modo, volume, ultima, anterior]);

  const reserva = <p className="px-6 text-center text-sm text-foreground-500">Este aparelho não mostra 3D. Veja suas medidas e o Body Twin acima.</p>;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <i className="ri-body-scan-line text-lg text-primary-500"></i>
        <h2 className="font-heading text-base font-semibold text-foreground-950">{nome ? `Corpo de ${nome}` : 'Seu corpo'}</h2>
        {ultima && <span className="ml-auto text-[11px] text-foreground-500">medidas de {dataBr(ultima.data)}</span>}
      </div>
      <div className={`mb-2 grid ${comFotos ? 'grid-cols-3' : 'grid-cols-2'} gap-1 rounded-xl bg-background-100 p-1`}>
        <button type="button" onClick={() => setVista('realista')} className={`rounded-lg py-1.5 text-xs font-semibold ${vista === 'realista' ? 'bg-background-50 text-foreground-950 shadow-sm' : 'text-foreground-500'}`}>Corpo realista</button>
        {comFotos && <button type="button" onClick={() => setVista('fotos')} className={`rounded-lg py-1.5 text-xs font-semibold ${vista === 'fotos' ? 'bg-background-50 text-foreground-950 shadow-sm' : 'text-foreground-500'}`}>{nome ? 'Fotos' : 'Você'} 360°</button>}
        <button type="button" onClick={() => setVista('boneco')} className={`rounded-lg py-1.5 text-xs font-semibold ${vista === 'boneco' ? 'bg-background-50 text-foreground-950 shadow-sm' : 'text-foreground-500'}`}>Mapa 3D</button>
      </div>
      {vista === 'realista' ? (
        <CorpoRealista valores={recentes} sexo={ultima?.av.sexo ?? perfil.sexo} altura={perfil.altura} gordura={gordura} onSalvarMedida={nome ? undefined : onSalvarMedida} />
      ) : vista === 'fotos' && comFotos ? (
        <>
          <Fotos360 fotos={comFotos.fotos} />
          <p className="mt-1 text-[11px] text-foreground-400">Suas fotos de {dataBr(comFotos.data)}. Para comparar com outras datas, use a aba Fotos.</p>
        </>
      ) : (<>
      <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-background-100 p-1">
        <button type="button" onClick={() => setModo('melhora')} disabled={!anterior} className={`rounded-lg py-1.5 text-xs font-semibold disabled:opacity-40 ${modo === 'melhora' ? 'bg-background-50 text-foreground-950 shadow-sm' : 'text-foreground-500'}`}>O que melhorou</button>
        <button type="button" onClick={() => setModo('treino')} className={`rounded-lg py-1.5 text-xs font-semibold ${modo === 'treino' ? 'bg-background-50 text-foreground-950 shadow-sm' : 'text-foreground-500'}`}>Treino da semana</button>
      </div>
      <div className="relative h-[380px] w-full overflow-hidden rounded-2xl bg-gradient-to-b from-background-100 to-background-200">
        {webgl ? (
          <SemWebGL reserva={<div className="flex h-full items-center justify-center">{reserva}</div>}>
            <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-foreground-500"><i className="ri-loader-4-line mr-2 animate-spin"></i>Montando seu corpo...</div>}>
              <Corpo3D medidas={medidas} cores={cores} fantasma={fantasma} pose={pose} girar={girar} />
            </Suspense>
          </SemWebGL>
        ) : (
          <div className="flex h-full items-center justify-center">{reserva}</div>
        )}
        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap justify-center gap-1.5">
          {([['relaxado', 'Relaxado'], ['biceps', 'Bíceps'], ['frente', 'Braços à frente']] as const).map(([p, l]) => (
            <button key={p} type="button" onClick={() => setPose(p)} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur ${pose === p ? 'bg-foreground-900 text-background-50' : 'bg-background-50/80 text-foreground-700'}`}>{l}</button>
          ))}
          <button type="button" onClick={() => setGirar((g) => !g)} className="rounded-full bg-background-50/80 px-2.5 py-1 text-[11px] font-semibold text-foreground-700 backdrop-blur" aria-label={girar ? 'Parar de girar' : 'Girar sozinho'}>
            <i className={girar ? 'ri-pause-line' : 'ri-refresh-line'}></i>
          </button>
          {anterior && (
            <button type="button" onClick={() => setComparar((c) => (c === 'anterior' ? null : 'anterior'))} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur ${comparar === 'anterior' ? 'bg-primary-500 text-white' : 'bg-background-50/80 text-foreground-700'}`}>
              Comparar com {dataBr(anterior.data).slice(0, 5)}
            </button>
          )}
          {temMeta && ultima && (
            <button type="button" onClick={() => setComparar((c) => (c === 'meta' ? null : 'meta'))} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur ${comparar === 'meta' ? 'bg-primary-500 text-white' : 'bg-background-50/80 text-foreground-700'}`}>
              Como vou ficar na meta
            </button>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-foreground-600">
        {modo === 'melhora' ? (
          <>
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: MELHORA.melhorou }}></span>melhorou</span>
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: MELHORA.piorou }}></span>precisa de atenção</span>
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full" style={{ background: MELHORA.igual }}></span>igual ou sem medida</span>
          </>
        ) : (
          <span>Quanto mais azul, mais séries na semana. Arraste o dedo para girar.</span>
        )}
      </div>
      {comparar && <p className="mt-1 text-[11px] font-medium text-foreground-600">Contorno em linhas: {comparar === 'meta' ? 'você com as medidas da meta' : `você em ${dataBr(anterior!.data)}`}.</p>}
      <p className="mt-1 text-[11px] text-foreground-400">
        Montado com as {nome ? 'medidas da avaliação' : 'suas medidas'}{medidas.estimadas.length ? ` (estimei ${medidas.estimadas.length} que faltam pela altura e peso)` : ''}. Quanto mais medidas na avaliação, mais parecido fica.
      </p>
      </>)}
    </div>
  );
}
