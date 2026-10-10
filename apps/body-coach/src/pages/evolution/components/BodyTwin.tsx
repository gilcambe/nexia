import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { pickBodyImage } from './bodyImages';
import AjustarFoto from '../fotos/AjustarFoto';
import {
  estimateMeasurements, exportBodyTwinImage, type EstimatedMeasurements,
} from './bodyAnalysis';

export type RegionKey = 'pecs' | 'deltoides' | 'abdomen' | 'gluteos' | 'quadriceps' | 'panturrilhas';
type Mode = 'ia' | 'foto';
type Style = 'realista' | 'render';
export type Angle = 'frente' | 'lado' | 'costas';
type Tool = 'select' | 'move' | 'measure';

const ANGLE_ORDER: Angle[] = ['frente', 'lado', 'costas'];
const ANGLE_LABEL: Record<Angle, string> = { frente: 'Frente', lado: 'Lado', costas: 'Costas' };

const IA_IMAGES: Record<Style, Record<Angle, string>> = {
  realista: {
    frente:
      `${import.meta.env.BASE_URL}imagens/bt-real-frente.jpg`,
    lado:
      `${import.meta.env.BASE_URL}imagens/bt-real-lado.jpg`,
    costas:
      `${import.meta.env.BASE_URL}imagens/bt-real-costas.jpg`,
  },
  render: {
    frente:
      `${import.meta.env.BASE_URL}imagens/bt-real-frente.jpg`,
    lado:
      `${import.meta.env.BASE_URL}imagens/bt-real-lado.jpg`,
    costas:
      `${import.meta.env.BASE_URL}imagens/bt-real-costas.jpg`,
  },
};

const META_IMAGES: Record<Style, string> = {
  realista:
    `${import.meta.env.BASE_URL}imagens/bt-progress-hoje.jpg`,
  render:
    `${import.meta.env.BASE_URL}imagens/bt-progress-hoje.jpg`,
};

const MARKERS: { key: RegionKey; label: string; x: number; y: number }[] = [
  { key: 'deltoides', label: 'Ombros', x: 50, y: 17 },
  { key: 'pecs', label: 'Peitoral', x: 50, y: 27 },
  { key: 'abdomen', label: 'Cintura', x: 50, y: 48 },
  { key: 'gluteos', label: 'Quadril', x: 50, y: 59 },
  { key: 'quadriceps', label: 'Coxas', x: 50, y: 73 },
  { key: 'panturrilhas', label: 'Panturrilhas', x: 50, y: 91 },
];

const INITIAL_POS = MARKERS.reduce<Record<RegionKey, { x: number; y: number }>>((acc, m) => {
  acc[m.key] = { x: m.x, y: m.y };
  return acc;
}, {} as Record<RegionKey, { x: number; y: number }>);

const clamp = (v: number) => Math.min(98, Math.max(2, v));

export default function BodyTwin({
  selected,
  onSelect,
  currentWeight,
  currentBodyFat,
  currentHeight,
  goalBodyFat,
  goalWeight,
  fotosReais,
  onSalvarFoto,
  medidasRegiao,
}: {
  selected: string | null;
  onSelect: (key: string) => void;
  currentWeight: number;
  currentBodyFat: number;
  currentHeight: number;
  goalBodyFat: number;
  goalWeight: number | null;
  // Últimas fotos da aba Fotos: aparecem em "Foto real" sem precisar enviar de novo.
  fotosReais?: Partial<Record<Angle, string | null>>;
  // Grava a foto enviada aqui junto com as fotos de evolução (ângulo, imagem já ajustada).
  onSalvarFoto?: (angle: Angle, foto: Blob) => Promise<void>;
  // Texto da medida de cada região, mostrado ao tocar no ponto (ex.: "78 cm · −3 cm").
  medidasRegiao?: Partial<Record<RegionKey, string>>;
}) {
  // Com fotos do aluno, abre direto nelas: o Body Twin passa a ser ele de verdade.
  const [modoEscolhido, setMode] = useState<Mode | null>(null);
  const mode: Mode = modoEscolhido ?? (fotosReais?.frente ? 'foto' : 'ia');
  const [regiao, setRegiao] = useState<RegionKey | null>(null);
  const [ajustar, setAjustar] = useState<File | null>(null);
  const [salvandoFoto, setSalvandoFoto] = useState<string | null>(null);
  const [style, setStyle] = useState<Style>('realista');
  const [angle, setAngle] = useState<Angle>('frente');
  const [goalMode, setGoalMode] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [comparePos, setComparePos] = useState(50);
  const [autoRotate, setAutoRotate] = useState(false);
  const [tool, setTool] = useState<Tool>('select');
  const [enviadas, setPhotos] = useState<Record<Angle, string | null>>({
    frente: null,
    lado: null,
    costas: null,
  });
  const photos: Record<Angle, string | null> = {
    frente: enviadas.frente ?? fotosReais?.frente ?? null,
    lado: enviadas.lado ?? fotosReais?.lado ?? null,
    costas: enviadas.costas ?? fotosReais?.costas ?? null,
  };
  const [markerPos, setMarkerPos] = useState(INITIAL_POS);
  const [measurePoints, setMeasurePoints] = useState<{ x: number; y: number }[]>([]);
  const [measureCm, setMeasureCm] = useState<number | null>(null);
  const [estimated, setEstimated] = useState<EstimatedMeasurements | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const dragX = useRef<number | null>(null);
  const draggingMarker = useRef<RegionKey | null>(null);

  useEffect(() => {
    if (!autoRotate || compareMode || goalMode) return;
    const id = window.setInterval(() => {
      setAngle((prev) => {
        const i = ANGLE_ORDER.indexOf(prev);
        return ANGLE_ORDER[(i + 1) % ANGLE_ORDER.length];
      });
    }, 1800);
    return () => window.clearInterval(id);
  }, [autoRotate, compareMode, goalMode]);

  const goalLeanMass = (goalWeight ?? currentWeight) * (1 - goalBodyFat / 100);

  const currentImage = (() => {
    if (mode === 'foto') return photos[angle];
    if (goalMode) {
      return style === 'realista' ? pickBodyImage(goalBodyFat) : META_IMAGES[style];
    }
    if (style === 'realista' && angle === 'frente') {
      return pickBodyImage(currentBodyFat);
    }
    return IA_IMAGES[style][angle];
  })();

  const compareCurrentSrc =
    style === 'realista' ? pickBodyImage(currentBodyFat) : IA_IMAGES[style].frente;
  const compareGoalSrc =
    style === 'realista' ? pickBodyImage(goalBodyFat) : META_IMAGES[style];

  const showMarkers = mode === 'foto' ? angle === 'frente' : !goalMode && angle === 'frente';

  const changeAngle = (a: Angle) => {
    setAngle(a);
    setTool('select');
    setMeasurePoints([]);
    setMeasureCm(null);
  };

  const handleFile = (file: File | undefined) => {
    if (file) setAjustar(file);
  };

  const usarFoto = async (foto: Blob) => {
    setAjustar(null);
    const a = angle;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotos((prev) => ({ ...prev, [a]: reader.result as string }));
      setMarkerPos(INITIAL_POS);
    };
    reader.readAsDataURL(foto);
    if (!onSalvarFoto) return;
    setSalvandoFoto('Salvando a foto...');
    try {
      await onSalvarFoto(a, foto);
      setSalvandoFoto('Foto salva na sua evolução de hoje.');
    } catch (e) {
      setSalvandoFoto(`Não consegui salvar a foto: ${e instanceof Error ? e.message : 'erro'}. Tente de novo.`);
    }
  };

  // IA turntable drag
  const onDragStart = (e: ReactPointerEvent) => {
    dragX.current = e.clientX;
  };
  const onDragMove = (e: ReactPointerEvent) => {
    if (dragX.current === null || goalMode || compareMode || mode !== 'ia') return;
    const dx = e.clientX - dragX.current;
    if (Math.abs(dx) > 50) {
      const dir = dx > 0 ? -1 : 1;
      dragX.current = e.clientX;
      setAngle((prev) => {
        const i = ANGLE_ORDER.indexOf(prev);
        return ANGLE_ORDER[(i + dir + ANGLE_ORDER.length) % ANGLE_ORDER.length];
      });
    }
  };
  const onDragEnd = () => {
    dragX.current = null;
  };

  // marker dragging
  const startMarkerDrag = (key: RegionKey) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (tool !== 'move') return;
    e.preventDefault();
    e.stopPropagation();
    draggingMarker.current = key;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMarkerMove = (e: ReactPointerEvent) => {
    const key = draggingMarker.current;
    if (!key) return;
    const rect = viewerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMarkerPos((prev) => ({ ...prev, [key]: { x: clamp(x), y: clamp(y) } }));
  };
  const onMarkerUp = () => {
    draggingMarker.current = null;
  };

  // measure tape
  const onMeasureClick = (e: ReactMouseEvent) => {
    if (tool !== 'measure' || mode !== 'foto') return;
    const rect = viewerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setMeasurePoints((prev) => {
      if (prev.length >= 2) return [px];
      const next = [...prev, px];
      if (next.length === 2) {
        const dx = next[1].x - next[0].x;
        const dy = next[1].y - next[0].y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const pxPerCm = (rect.height * 0.85) / currentHeight;
        setMeasureCm(len / pxPerCm);
      }
      return next;
    });
  };

  const measureLine =
    measurePoints.length === 2
      ? (() => {
          const [p1, p2] = measurePoints;
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          return {
            left: p1.x,
            top: p1.y,
            width: Math.sqrt(dx * dx + dy * dy),
            angle: (Math.atan2(dy, dx) * 180) / Math.PI,
            midX: (p1.x + p2.x) / 2,
            midY: (p1.y + p2.y) / 2,
          };
        })()
      : null;

  // Estima medidas automaticamente a partir da foto (pixels → cm via silhueta).
  const runAutoEstimate = async () => {
    const src = photos[angle];
    if (!src) return;
    setEstimating(true);
    setEstimated(null);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('load'));
        el.src = src;
      });
      const result = estimateMeasurements(img, currentHeight);
      if (result) {
        setEstimated(result);
        // reposiciona os marcadores nas alturas estimadas (ombro/cintura/quadril)
        setMarkerPos((prev) => ({
          ...prev,
          deltoides: { ...prev.deltoides, y: 17 },
          pecs: { ...prev.pecs, y: 27 },
          abdomen: { ...prev.abdomen, y: 48 },
          gluteos: { ...prev.gluteos, y: 59 },
        }));
      }
    } catch {
      setExportMsg('Não foi possível analisar esta foto. Tente uma imagem com fundo mais uniforme.');
    } finally {
      setEstimating(false);
    }
  };

  // Exporta a imagem do Body Twin com medidas marcadas por cima.
  const runExport = async () => {
    const src = currentImage;
    if (!src) return;
    setExporting(true);
    setExportMsg(null);
    try {
      await exportBodyTwinImage({
        imageSrc: src,
        markers: showMarkers
          ? MARKERS.map((m) => ({ label: m.label, x: markerPos[m.key].x, y: markerPos[m.key].y, active: selected === m.key }))
          : [],
        badge: goalMode && !compareMode
          ? `Meta · ${goalBodyFat}% gordura · ${goalLeanMass.toFixed(1)} kg magra`
          : null,
        measure:
          measurePoints.length === 2 && measureCm !== null
            ? { p1: measurePoints[0], p2: measurePoints[1], cm: measureCm }
            : null,
      });
      setExportMsg('Imagem baixada com sucesso!');
    } catch {
      setExportMsg('Não foi possível exportar esta imagem (o navegador bloqueou o download).');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* mode tabs */}
      <div className="flex rounded-full bg-background-200 p-1">
        <button
          onClick={() => {
            setMode('ia');
            setTool('select');
            setMeasurePoints([]);
            setMeasureCm(null);
          }}
          className={`flex-1 whitespace-nowrap rounded-full px-1 py-1.5 text-xs font-medium transition ${
            mode === 'ia' ? 'bg-background-50 text-foreground-950' : 'text-foreground-500 hover:text-foreground-800'
          }`}
        >
          Corpo IA
        </button>
        <button
          onClick={() => {
            setMode('foto');
            setCompareMode(false);
            setAutoRotate(false);
          }}
          className={`flex-1 whitespace-nowrap rounded-full px-1 py-1.5 text-xs font-medium transition ${
            mode === 'foto' ? 'bg-background-50 text-foreground-950' : 'text-foreground-500 hover:text-foreground-800'
          }`}
        >
          Foto real
        </button>
      </div>

      {/* body viewer */}
      <div className="overflow-hidden rounded-xl bg-background-100/50">
        <div
          ref={viewerRef}
          className="relative mx-auto aspect-[3/4] w-full max-w-[260px]"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerLeave={onDragEnd}
          onClick={onMeasureClick}
          style={{ cursor: tool === 'measure' ? 'crosshair' : mode === 'ia' && !goalMode && !compareMode ? 'grab' : 'default' }}
        >
          {compareMode ? (
            <>
              <img
                src={compareCurrentSrc}
                alt={`Corpo atual ${currentWeight} kg`}
                className="absolute inset-0 h-full w-full select-none object-cover object-top"
                draggable={false}
              />
              <img
                src={compareGoalSrc}
                alt={`Corpo na meta ${goalBodyFat}% gordura`}
                className="absolute inset-0 h-full w-full select-none object-cover object-top"
                draggable={false}
                style={{ clipPath: `inset(0 0 0 ${comparePos}%)` }}
              />
              <div className="pointer-events-none absolute inset-y-0" style={{ left: `${comparePos}%` }}>
                <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-background-50"></div>
                <div className="absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-background-50 text-foreground-600">
                  <i className="ri-arrow-left-right-line text-sm"></i>
                </div>
              </div>
              <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-background-50">
                Atual
              </span>
              <span className="absolute right-2 top-2 rounded-full bg-accent-500 px-2 py-0.5 text-[10px] font-semibold text-background-50 dark:text-foreground-950">
                Meta
              </span>
            </>
          ) : currentImage ? (
            <img
              src={currentImage}
              alt={`Body Twin de ${currentHeight}cm, ${currentWeight}kg — ${goalMode ? 'corpo na meta' : ANGLE_LABEL[angle].toLowerCase()}`}
              className={`h-full w-full select-none ${mode === 'foto' ? 'object-contain' : 'object-cover object-top'}`}
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-background-300 p-4 sm:p-6 text-center">
              <i className="ri-camera-line text-3xl text-foreground-400"></i>
              <p className="text-xs text-foreground-500">
                Adicione uma foto do ângulo <span className="font-semibold">{ANGLE_LABEL[angle]}</span> para ver seu corpo real.
              </p>
            </div>
          )}

          {/* measure overlay */}
          {measureLine && (
            <>
              <div
                className="pointer-events-none absolute h-0.5 origin-left bg-accent-500"
                style={{ left: measureLine.left, top: measureLine.top, width: measureLine.width, transform: `rotate(${measureLine.angle}deg)` }}
              />
              {measurePoints.map((p, i) => (
                <span
                  key={i}
                  className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background-50 bg-accent-500"
                  style={{ left: p.x, top: p.y }}
                />
              ))}
              {measureCm !== null && (
                <span className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-background-50">
                  {measureCm.toFixed(1)} cm
                </span>
              )}
            </>
          )}

          {/* region markers */}
          {showMarkers && currentImage && !compareMode && (
            <>
              {MARKERS.map((m) => {
                const pos = markerPos[m.key];
                const active = (regiao ?? selected) === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => {
                      if (tool !== 'select') return;
                      setRegiao((r) => (r === m.key ? null : m.key));
                      onSelect(m.key);
                    }}
                    onPointerDown={startMarkerDrag(m.key)}
                    onPointerMove={onMarkerMove}
                    onPointerUp={onMarkerUp}
                    className="group absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${pos.x}%`, top: `${pos.y}%`, cursor: tool === 'move' ? 'move' : 'pointer' }}
                    aria-label={`Ver medida: ${m.label}`}
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition ${
                        active
                          ? 'border-primary-500 bg-primary-500 text-background-50'
                          : 'border-background-50 bg-black/35 text-background-50 backdrop-blur-sm group-hover:bg-primary-500'
                      }`}
                    >
                      <i className="ri-add-line text-[11px]"></i>
                    </span>
                    <span
                      className={`pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-semibold transition ${
                        active ? 'bg-primary-500 text-background-50' : 'bg-black/70 text-background-50 opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {m.label}{active ? ` · ${medidasRegiao?.[m.key] ?? 'sem medida'}` : ''}
                    </span>
                  </button>
                );
              })}
            </>
          )}

          {/* goal badge */}
          {goalMode && !compareMode && (
            <div className="absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent-500 px-3 py-1 text-[11px] font-semibold text-background-50 dark:text-foreground-950">
              Meta · {goalBodyFat}% gordura · {goalLeanMass.toFixed(1)} kg magra
            </div>
          )}
        </div>

        {/* export */}
        <button
          onClick={runExport}
          disabled={!currentImage || exporting}
          className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-sm font-semibold text-foreground-800 transition hover:bg-background-100 disabled:opacity-50"
        >
          <i className="ri-download-2-line"></i>
          {exporting ? 'Exportando...' : 'Baixar imagem (PNG)'}
        </button>
        {exportMsg && (
          <p className="text-center text-xs font-medium text-foreground-500">{exportMsg}</p>
        )}
      </div>

      {/* dados atuais reais */}
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-background-100/70 p-3">
        <div className="text-center">
          <p className="text-[10px] text-foreground-500">Peso atual</p>
          <p className="font-heading text-sm font-bold text-foreground-950">{currentWeight} kg</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-foreground-500">Gordura</p>
          <p className="font-heading text-sm font-bold text-foreground-950">{currentBodyFat}%</p>
        </div>
      </div>

      {/* ia controls */}
      {mode === 'ia' && (
        <div className="space-y-3">
          <div className="flex rounded-full bg-background-200 p-1">
            <button
              onClick={() => setStyle('realista')}
              className={`flex-1 whitespace-nowrap rounded-full px-1 py-1.5 text-xs font-medium transition ${
                style === 'realista' ? 'bg-background-50 text-foreground-950' : 'text-foreground-500 hover:text-foreground-800'
              }`}
            >
              Fotorrealista
            </button>
            <button
              onClick={() => setStyle('render')}
              className={`flex-1 whitespace-nowrap rounded-full px-1 py-1.5 text-xs font-medium transition ${
                style === 'render' ? 'bg-background-50 text-foreground-950' : 'text-foreground-500 hover:text-foreground-800'
              }`}
            >
              Render 3D
            </button>
          </div>

          {!compareMode && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {ANGLE_ORDER.map((a) => (
                  <button
                    key={a}
                    onClick={() => changeAngle(a)}
                    disabled={goalMode}
                    className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-40 ${
                      angle === a && !goalMode ? 'bg-primary-100 text-primary-700' : 'text-foreground-500 hover:bg-background-100'
                    }`}
                  >
                    {ANGLE_LABEL[a]}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setAutoRotate((v) => !v)}
                disabled={goalMode}
                className={`flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-40 ${
                  autoRotate ? 'bg-primary-500 text-background-50 dark:text-foreground-950' : 'text-foreground-500 hover:bg-background-100'
                }`}
              >
                <i className={autoRotate ? 'ri-pause-line' : 'ri-play-line'}></i>
                360°
              </button>
            </div>
          )}

          <div className="flex rounded-full bg-background-200 p-1">
            <button
              onClick={() => {
                setGoalMode(false);
                setCompareMode(false);
              }}
              className={`flex-1 whitespace-nowrap rounded-full px-1 py-1.5 text-xs font-medium transition ${
                !goalMode && !compareMode ? 'bg-background-50 text-foreground-950' : 'text-foreground-500 hover:text-foreground-800'
              }`}
            >
              Atual
            </button>
            <button
              onClick={() => {
                setGoalMode(true);
                setCompareMode(false);
              }}
              className={`flex-1 whitespace-nowrap rounded-full px-1 py-1.5 text-xs font-medium transition ${
                goalMode ? 'bg-background-50 text-foreground-950' : 'text-foreground-500 hover:text-foreground-800'
              }`}
            >
              Meta
            </button>
            <button
              onClick={() => {
                setCompareMode(true);
                setGoalMode(false);
              }}
              className={`flex-1 whitespace-nowrap rounded-full px-1 py-1.5 text-xs font-medium transition ${
                compareMode ? 'bg-background-50 text-foreground-950' : 'text-foreground-500 hover:text-foreground-800'
              }`}
            >
              Comparar
            </button>
          </div>

          {compareMode && (
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-foreground-600">Arraste para comparar</span>
                <span className="text-foreground-400">Atual ↔ Meta</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={comparePos}
                onChange={(e) => setComparePos(Number(e.target.value))}
                className="w-full accent-primary-500"
              />
            </div>
          )}
        </div>
      )}

      {showMarkers && currentImage && !compareMode && (
        <p className="-mt-2 text-center text-[11px] text-foreground-500">Toque nos pontos para ver a medida de cada parte do corpo.</p>
      )}

      {/* foto controls */}
      {mode === 'foto' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {ANGLE_ORDER.map((a) => (
                <button
                  key={a}
                  onClick={() => changeAngle(a)}
                  className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                    angle === a ? 'bg-primary-100 text-primary-700' : 'text-foreground-500 hover:bg-background-100'
                  }`}
                >
                  {ANGLE_LABEL[a]}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-3 py-2 text-sm font-semibold text-background-50 transition hover:bg-primary-600 dark:text-foreground-950"
          >
            <i className="ri-upload-cloud-2-line"></i>
            {photos[angle] ? 'Trocar foto' : `Enviar foto (${ANGLE_LABEL[angle]})`}
          </button>
          {salvandoFoto && <p className={`rounded-lg px-3 py-2 text-xs ${salvandoFoto.startsWith('Não') ? 'bg-red-50 text-red-600' : 'bg-accent-100 text-accent-700'}`}>{salvandoFoto}</p>}
          {ajustar && <AjustarFoto arquivo={ajustar} titulo={ANGLE_LABEL[angle]} onCancelar={() => setAjustar(null)} onPronto={(b) => void usarFoto(b)} />}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />

          {/* tools */}
          <div className="flex rounded-full bg-background-200 p-1">
            <button
              onClick={() => {
                setTool('select');
                setMeasurePoints([]);
                setMeasureCm(null);
              }}
              className={`flex-1 whitespace-nowrap rounded-full px-1 py-1.5 text-[11px] font-medium transition ${
                tool === 'select' ? 'bg-background-50 text-foreground-950' : 'text-foreground-500 hover:text-foreground-800'
              }`}
            >
              Selecionar
            </button>
            <button
              onClick={() => {
                setTool('move');
                setMeasurePoints([]);
                setMeasureCm(null);
              }}
              className={`flex-1 whitespace-nowrap rounded-full px-1 py-1.5 text-[11px] font-medium transition ${
                tool === 'move' ? 'bg-background-50 text-foreground-950' : 'text-foreground-500 hover:text-foreground-800'
              }`}
            >
              Mover marcadores
            </button>
            <button
              onClick={() => {
                setTool('measure');
                setMeasurePoints([]);
                setMeasureCm(null);
              }}
              className={`flex-1 whitespace-nowrap rounded-full px-1 py-1.5 text-[11px] font-medium transition ${
                tool === 'measure' ? 'bg-background-50 text-foreground-950' : 'text-foreground-500 hover:text-foreground-800'
              }`}
            >
              Medir
            </button>
          </div>

          {/* auto estimate */}
          <div className="space-y-2">
            <button
              onClick={runAutoEstimate}
              disabled={!photos[angle] || estimating}
              className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-secondary-500 px-3 py-2 text-sm font-semibold text-background-50 transition hover:bg-secondary-600 disabled:opacity-50 dark:text-foreground-950"
            >
              <i className="ri-magic-line"></i>
              {estimating ? 'Analisando...' : 'Estimar medidas automaticamente'}
            </button>
            {estimated && (
              <div className="rounded-xl border border-secondary-200 bg-secondary-100/60 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-secondary-900">Medidas estimadas (a partir da foto)</p>
                  <span className="rounded-full bg-secondary-500 px-2 py-0.5 text-[10px] font-semibold text-background-50 dark:text-foreground-950">IA</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Ombros', value: estimated.ombro },
                    { label: 'Cintura', value: estimated.cintura },
                    { label: 'Quadril', value: estimated.quadril },
                    { label: 'Pescoço', value: estimated.pescoco },
                  ].map((m) => (
                    <div key={m.label} className="rounded-lg bg-background-50 px-3 py-2">
                      <p className="text-[10px] text-foreground-500">{m.label}</p>
                      <p className="text-sm font-semibold text-foreground-900">{m.value} cm</p>
                    </div>
                  ))}
                </div>
                {estimated.bodyFatPct !== null && (
                  <p className="mt-2 text-[11px] text-foreground-600">
                    Gordura corporal estimada (método Navy): <span className="font-semibold text-foreground-900">{estimated.bodyFatPct}%</span>
                  </p>
                )}
                <p className="mt-1 text-[10px] text-foreground-400">
                  Estimativa geométrica a partir da silhueta — não substitui medição com fita métrica.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <p className="max-w-[260px] text-center text-xs text-foreground-400">
        {mode === 'ia'
          ? compareMode
            ? 'Arraste o divisor (ou o controle) para comparar o corpo atual com a meta.'
            : 'Arraste para girar 360° ou toque em 360° para girar sozinho. Toque numa região para ver as medidas.'
          : tool === 'measure'
            ? 'Clique em dois pontos do corpo para medir a distância (escala baseada na sua altura).'
            : tool === 'move'
              ? 'Arraste os marcadores para alinhar com o corpo real.'
              : 'Envie fotos reais (frente/lado/costas) e toque numa região para ver as medidas.'}
      </p>
    </div>
  );
}