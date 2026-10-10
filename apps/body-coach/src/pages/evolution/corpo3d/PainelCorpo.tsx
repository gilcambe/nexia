import { useMemo, useState } from 'react';
import type { MetasMedidas } from '@/lib/avaliacao/metas';
import { dataBr } from '@/lib/avaliacao/calculos';
import type { PerfilAvaliacao } from '@/lib/avaliacao/dados';
import type { ItemSerie } from '@/lib/avaliacao/serie';
import Fotos360 from './Fotos360';
import CorpoRealista from './CorpoRealista';

// Corpo do aluno: o corpo realista moldado com as medidas ou as fotos dele girando.
// O boneco 3D cinza saiu (o aluno pediu só o corpo realista).
export default function PainelCorpo({ serie, perfil, nome, onSalvarMedida }: { serie: ItemSerie[]; perfil: PerfilAvaliacao; volume?: Record<string, number>; nome?: string; metas?: MetasMedidas | null; onSalvarMedida?: (campo: string, cm: number) => Promise<void> }) {
  const comMedidas = serie.filter((s) => s.m.peso != null || s.m.cintura != null);
  const ultima = comMedidas[comMedidas.length - 1] ?? null;
  const comFotos = [...serie].reverse().find((s) => Object.values(s.fotos).filter(Boolean).length >= 2) ?? null;
  const [vistaEscolhida, setVista] = useState<'fotos' | 'realista' | null>(null);
  const vista = vistaEscolhida === 'fotos' && comFotos ? 'fotos' : 'realista';
  // A medida mais recente de cada parte (a última avaliação pode ter só algumas).
  const recentes = useMemo(() => {
    const v: Record<string, number> = {};
    for (const s of serie) for (const [k, n] of Object.entries(s.av.valores)) if (n != null && Number.isFinite(n)) v[k] = n;
    return v;
  }, [serie]);
  const gordura = [...serie].reverse().find((s) => s.m.gordura != null)?.m.gordura ?? null;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <i className="ri-body-scan-line text-lg text-primary-500"></i>
        <h2 className="font-heading text-base font-semibold text-foreground-950">{nome ? `Corpo de ${nome}` : 'Seu corpo'}</h2>
        {ultima && <span className="ml-auto text-[11px] text-foreground-500">medidas de {dataBr(ultima.data)}</span>}
      </div>
      {comFotos && (
        <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-background-100 p-1">
          <button type="button" onClick={() => setVista('realista')} className={`rounded-lg py-1.5 text-xs font-semibold ${vista === 'realista' ? 'bg-background-50 text-foreground-950 shadow-sm' : 'text-foreground-500'}`}>Corpo realista</button>
          <button type="button" onClick={() => setVista('fotos')} className={`rounded-lg py-1.5 text-xs font-semibold ${vista === 'fotos' ? 'bg-background-50 text-foreground-950 shadow-sm' : 'text-foreground-500'}`}>{nome ? 'Fotos' : 'Você'} 360°</button>
        </div>
      )}
      {vista === 'fotos' && comFotos ? (
        <>
          <Fotos360 fotos={comFotos.fotos} />
          <p className="mt-1 text-[11px] text-foreground-400">Suas fotos de {dataBr(comFotos.data)}. Para comparar com outras datas, use a aba Fotos.</p>
        </>
      ) : (
        <CorpoRealista valores={recentes} sexo={ultima?.av.sexo ?? perfil.sexo} altura={perfil.altura} gordura={gordura} onSalvarMedida={nome ? undefined : onSalvarMedida} />
      )}
    </div>
  );
}
