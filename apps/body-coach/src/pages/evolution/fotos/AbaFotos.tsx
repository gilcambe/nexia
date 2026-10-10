import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import Card from '@/components/base/Card';
import { compressImageToDataUrl } from '@/lib/userData';
import { dataBr } from '@/lib/avaliacao/calculos';
import { MAX_FOTO_BYTES, POSES, salvarAvaliacao, type Fotos, type Pose } from '@/lib/avaliacao/dados';
import { hojeIso } from '@/lib/avaliacao/importar';
import { compartilharArquivo, montagem, videoEvolucao, videoSuportado } from '@/lib/avaliacao/imagens';
import type { ItemSerie } from '@/lib/avaliacao/serie';
import type { ProgressEntry } from '@/hooks/useProgressData';
import CameraGuia from './CameraGuia';
import Silhueta from './Silhueta';
import Postura from './Postura';
import AjustarFoto from './AjustarFoto';

const fmt = (n: number | undefined, u: string) => (n == null ? null : `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${u}`);

export default function AbaFotos({
  uid, entries, serie, onMudou, somenteComparar = false,
}: {
  uid: string | undefined;
  entries: ProgressEntry[];
  serie: ItemSerie[];
  onMudou: () => void;
  // Coach vendo as fotos do aluno: só compara, sem tirar fotos novas.
  somenteComparar?: boolean;
}) {
  // ── nova sessão de fotos ──
  const [data, setData] = useState(hojeIso());
  const [novas, setNovas] = useState<Fotos>({});
  const [camera, setCamera] = useState<Pose | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const [ajustar, setAjustar] = useState<{ pose: Pose; arquivo: Blob } | null>(null);
  const poseGaleria = useRef<Pose>('frente');

  const ultimaFoto = (p: Pose) => [...serie].reverse().find((s) => s.fotos[p])?.fotos[p] ?? null;

  const guardar = async (p: Pose, blob: Blob) => {
    try {
      const url = await compressImageToDataUrl(blob, 900, MAX_FOTO_BYTES);
      setNovas((n) => ({ ...n, [p]: url }));
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui usar essa foto.');
    }
  };

  const daGaleria = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) setAjustar({ pose: poseGaleria.current, arquivo: f });
  };

  const salvar = async () => {
    if (!uid) return;
    setSalvando(true);
    setErro(null);
    try {
      await salvarAvaliacao(uid, { data, valores: {}, fonte: 'Fotos' }, { fotos: novas, existentes: entries });
      setNovas({});
      setMsg(`Fotos de ${dataBr(data)} salvas.`);
      onMudou();
    } catch (e) {
      setErro(`Não consegui salvar: ${e instanceof Error ? e.message : 'erro'}`);
    } finally {
      setSalvando(false);
    }
  };

  // ── comparar ──
  const [pose, setPose] = useState<Pose>('frente');
  const comFoto = useMemo(() => serie.filter((s) => s.fotos[pose]), [serie, pose]);
  const [antesId, setAntesId] = useState<number | null>(null);
  const [depoisId, setDepoisId] = useState<number | null>(null);
  const antes = comFoto.find((s) => s.id === antesId) ?? comFoto[0];
  const depois = comFoto.find((s) => s.id === depoisId) ?? comFoto[comFoto.length - 1];
  const [modo, setModo] = useState<'lado' | 'deslizar'>('lado');
  const [corte, setCorte] = useState(50);
  const [gerando, setGerando] = useState<string | null>(null);

  const legenda = (s: ItemSerie) => [dataBr(s.data), fmt(s.m.peso, 'kg')].filter(Boolean).join(' · ');

  const baixarMontagem = async (todas: boolean) => {
    if (!antes || !depois) return;
    setGerando('Montando a imagem...');
    try {
      const linhas = (todas ? POSES.map((p) => p.id) : [pose])
        .filter((p) => antes.fotos[p] && depois.fotos[p])
        .map((p) => [{ src: antes.fotos[p]!, legenda: legenda(antes) }, { src: depois.fotos[p]!, legenda: legenda(depois) }]);
      const blob = await montagem(linhas);
      await compartilharArquivo(blob, `evolucao-${antes.data}-${depois.data}.jpg`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui montar a imagem.');
    } finally {
      setGerando(null);
    }
  };

  const baixarVideo = async () => {
    setGerando('Gravando o vídeo... 0%');
    try {
      const blob = await videoEvolucao(
        comFoto.map((s) => ({ src: s.fotos[pose]!, data: s.data, texto: [fmt(s.m.peso, 'kg'), s.res.gordura != null ? `${fmt(s.res.gordura, '%')} gordura` : null].filter(Boolean).join(' · ') })),
        (p) => setGerando(`Gravando o vídeo... ${Math.round(p * 100)}%`),
      );
      await compartilharArquivo(blob, `evolucao-${pose}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui gerar o vídeo.');
    } finally {
      setGerando(null);
    }
  };

  const diferencas = antes && depois && antes !== depois
    ? ([['peso', 'Peso', 'kg', 0], ['gordura', 'Gordura', '%', -1], ['cintura', 'Cintura', 'cm', -1], ['mlg', 'Massa magra', 'kg', 1]] as const)
      .map(([k, l, u, sentido]) => {
        const a = antes.m[k];
        const d = depois.m[k];
        if (a == null || d == null) return null;
        const delta = Math.round((d - a) * 10) / 10;
        return { l, txt: `${delta > 0 ? '+' : ''}${delta.toLocaleString('pt-BR')} ${u}`, bom: sentido === 0 || !delta ? null : Math.sign(delta) === sentido };
      })
      .filter(Boolean)
    : [];

  return (
    <div className="space-y-4">
      {!somenteComparar && <Card padding="p-5">
        <h2 className="font-heading text-base font-semibold text-foreground-950">Fotos de evolução</h2>
        <p className="mb-3 text-sm text-foreground-600">Sempre as 4 posições, no mesmo lugar e com a mesma luz. A câmera mostra o contorno e a sua foto anterior para alinhar.</p>
        <label className="mb-3 block max-w-[200px]">
          <span className="mb-1 block text-xs font-medium text-foreground-600">Data das fotos</span>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-full rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-sm" />
        </label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {POSES.map((p) => (
            <div key={p.id} className="rounded-xl border border-background-200 p-2">
              <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-foreground-800">
                {novas[p.id] ? (
                  <img src={novas[p.id]!} alt={`Nova foto ${p.label}`} className="h-full w-full object-cover object-top" />
                ) : (
                  <Silhueta pose={p.id} className="h-full w-full opacity-60" />
                )}
                <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">{p.label}</span>
              </div>
              <div className="mt-2 flex gap-1.5">
                <button type="button" onClick={() => setCamera(p.id)} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary-500 px-2 py-1.5 text-xs font-semibold text-background-50 dark:text-foreground-950" aria-label={`Câmera ${p.label}`}>
                  <i className="ri-camera-line"></i>{novas[p.id] ? 'Refazer' : 'Câmera'}
                </button>
                <button type="button" onClick={() => { poseGaleria.current = p.id; galeria.current?.click(); }} className="rounded-lg border border-background-300 px-2 py-1.5 text-xs text-foreground-700" aria-label={`Galeria ${p.label}`}>
                  <i className="ri-image-line"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
        <input ref={galeria} type="file" accept="image/*" className="hidden" onChange={daGaleria} data-testid="galeria-pose" />
        {ajustar && (
          <AjustarFoto
            arquivo={ajustar.arquivo}
            titulo={POSES.find((x) => x.id === ajustar.pose)?.label ?? ''}
            onCancelar={() => setAjustar(null)}
            onPronto={(b) => { const pz = ajustar.pose; setAjustar(null); void guardar(pz, b); }}
          />
        )}
        {Object.keys(novas).length > 0 && (
          <button type="button" disabled={salvando} onClick={() => void salvar()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50 disabled:opacity-50 dark:text-foreground-950">
            <i className={salvando ? 'ri-loader-4-line animate-spin' : 'ri-save-line'}></i>
            {salvando ? 'Salvando...' : `Salvar ${Object.keys(novas).length} foto(s) de ${dataBr(data)}`}
          </button>
        )}
        {msg && <p className="mt-3 rounded-lg bg-accent-100 px-3 py-2 text-sm text-accent-700">{msg}</p>}
        {erro && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}
      </Card>}

      <Card padding="p-5">
        <h2 className="mb-3 font-heading text-base font-semibold text-foreground-950">Antes e depois</h2>
        <div className="mb-3 grid grid-cols-4 gap-1 rounded-xl bg-background-100 p-1">
          {POSES.map((p) => (
            <button key={p.id} type="button" onClick={() => setPose(p.id)} className={`rounded-lg py-1.5 text-[11px] font-semibold ${pose === p.id ? 'bg-background-50 text-foreground-950 shadow-sm' : 'text-foreground-500'}`}>
              {p.label.replace('Lado ', '')}
            </button>
          ))}
        </div>
        {comFoto.length < 2 ? (
          <p className="rounded-xl border-2 border-dashed border-background-300 p-6 text-center text-sm text-foreground-500">
            Salve fotos dessa posição em pelo menos duas datas para comparar.
          </p>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2">
              {([['Antes', antes, setAntesId], ['Depois', depois, setDepoisId]] as const).map(([rot, sel, set]) => (
                <label key={rot} className="block">
                  <span className="mb-1 block text-[11px] font-medium text-foreground-500">{rot}</span>
                  <select value={sel?.id} onChange={(e) => set(Number(e.target.value))} className="w-full rounded-lg border border-background-300 bg-background-50 px-2 py-1.5 text-sm">
                    {comFoto.map((s) => <option key={s.id} value={s.id}>{dataBr(s.data)}</option>)}
                  </select>
                </label>
              ))}
            </div>
            {diferencas.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {diferencas.map((d) => d && (
                  <span key={d.l} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${d.bom == null ? 'bg-background-100 text-foreground-700' : d.bom ? 'bg-accent-100 text-accent-700' : 'bg-red-50 text-red-600'}`}>
                    {d.l} {d.txt}
                  </span>
                ))}
              </div>
            )}
            <div className="mb-3 flex gap-2 text-xs">
              {(['lado', 'deslizar'] as const).map((m) => (
                <button key={m} type="button" onClick={() => setModo(m)} className={`rounded-full px-3 py-1 font-semibold ${modo === m ? 'bg-foreground-900 text-background-50' : 'bg-background-100 text-foreground-600'}`}>
                  {m === 'lado' ? 'Lado a lado' : 'Deslizar'}
                </button>
              ))}
            </div>
            {modo === 'lado' ? (
              <div className="grid grid-cols-2 gap-1.5">
                {[antes, depois].map((s, i) => (
                  <figure key={i} className="relative overflow-hidden rounded-xl bg-background-100">
                    <img src={s.fotos[pose]!} alt={`${pose} ${dataBr(s.data)}`} className="aspect-[3/4] w-full object-cover object-top" />
                    <figcaption className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">{legenda(s)}</figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <div>
                <div className="relative mx-auto aspect-[3/4] w-full max-w-[340px] overflow-hidden rounded-xl bg-background-100">
                  <img src={depois.fotos[pose]!} alt={`Depois ${dataBr(depois.data)}`} className="absolute inset-0 h-full w-full select-none object-cover object-top" draggable={false} />
                  <img src={antes.fotos[pose]!} alt={`Antes ${dataBr(antes.data)}`} className="absolute inset-0 h-full w-full select-none object-cover object-top" draggable={false} style={{ clipPath: `inset(0 ${100 - corte}% 0 0)` }} />
                  <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white" style={{ left: `${corte}%` }} />
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">{dataBr(antes.data)}</span>
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-primary-500 px-2 py-0.5 text-[10px] font-semibold text-white">{dataBr(depois.data)}</span>
                </div>
                <input type="range" min={0} max={100} value={corte} onChange={(e) => setCorte(Number(e.target.value))} className="mx-auto mt-2 block w-full max-w-[340px] accent-primary-500" aria-label="Arraste para comparar" />
              </div>
            )}
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button type="button" disabled={!!gerando} onClick={() => void baixarMontagem(false)} className="rounded-lg border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-800 disabled:opacity-50">
                <i className="ri-image-2-line mr-1"></i>Imagem antes/depois
              </button>
              <button type="button" disabled={!!gerando} onClick={() => void baixarMontagem(true)} className="rounded-lg border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-800 disabled:opacity-50">
                <i className="ri-layout-grid-line mr-1"></i>Montagem das 4 poses
              </button>
              {videoSuportado() && (
                <button type="button" disabled={!!gerando} onClick={() => void baixarVideo()} className="rounded-lg border border-background-300 px-3 py-2 text-xs font-semibold text-foreground-800 disabled:opacity-50">
                  <i className="ri-movie-line mr-1"></i>Vídeo da evolução
                </button>
              )}
            </div>
            {gerando && <p className="mt-2 text-center text-xs text-foreground-500"><i className="ri-loader-4-line mr-1 animate-spin"></i>{gerando}</p>}
          </>
        )}
      </Card>

      <Postura serie={serie} />

      {camera && (
        <CameraGuia
          pose={camera}
          fantasma={ultimaFoto(camera)}
          onFechar={() => setCamera(null)}
          onFoto={(b) => { const p = camera; setCamera(null); void guardar(p, b); }}
        />
      )}
    </div>
  );
}
