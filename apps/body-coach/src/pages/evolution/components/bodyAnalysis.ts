// Análise de imagem para estimar medidas corporais a partir de uma foto.
// IMPORTANTE (transparência): esta é uma estimativa geométrica aproximada.
// NÃO é uma medição médica/clínica — serve apenas como referência visual.

export interface EstimatedMeasurements {
  pescoco: number;
  ombro: number;
  cintura: number;
  quadril: number;
  bodyFatPct: number | null;
  silhouetteRows: number[]; // largura em pixels de cada linha (para debug/viz)
}

export interface SilhouetteAnalysis {
  width: number;
  height: number;
  silhouette: number[]; // largura em pixels por linha
  background: [number, number, number];
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = src;
  });
}

function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

// Detecta a silhueta (corpo) contra o fundo, assumindo fundo claro/neutro.
export function analyzeSilhouette(img: HTMLImageElement): SilhouetteAnalysis | null {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return null;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  try {
    ctx.drawImage(img, 0, 0, w, h);
  } catch {
    return null; // canvas "tainted" por CORS
  }

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return null;
  }

  // Amostra os cantos e o topo para estimar a cor do fundo
  const samples: [number, number][] = [
    [2, 2],
    [w - 3, 2],
    [2, h - 3],
    [w - 3, h - 3],
    [Math.floor(w / 2), 2],
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  samples.forEach(([x, y]) => {
    const i = (y * w + x) * 4;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  });
  const bg: [number, number, number] = [r / samples.length, g / samples.length, b / samples.length];

  const THRESHOLD = 45; // distância de cor mínima para considerar "corpo"
  const silhouette: number[] = new Array(h).fill(0);

  for (let y = 0; y < h; y += 1) {
    let minX = w;
    let maxX = -1;
    const rowBase = y * w;
    for (let x = 0; x < w; x += 1) {
      const i = (rowBase + x) * 4;
      const dist = colorDistance(data[i], data[i + 1], data[i + 2], bg[0], bg[1], bg[2]);
      if (dist > THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
    silhouette[y] = maxX >= minX ? maxX - minX : 0;
  }

  return { width: w, height: h, silhouette, background: bg };
}

// Estimativa de medidas em cm usando a altura conhecida como régua.
export function estimateMeasurements(img: HTMLImageElement, heightCm: number): EstimatedMeasurements | null {
  const analysis = analyzeSilhouette(img);
  if (!analysis) return null;

  const { width, height, silhouette } = analysis;

  // Assume que o corpo ocupa ~85% da altura da imagem
  const bodyPixelHeight = height * 0.85;
  if (bodyPixelHeight <= 0) return null;
  const pxPerCm = bodyPixelHeight / heightCm;

  const measureAt = (frac: number): number => {
    const y = Math.floor(frac * height);
    let sum = 0;
    let count = 0;
    const win = 6;
    for (let yy = Math.max(0, y - win); yy <= Math.min(height - 1, y + win); yy += 1) {
      if (silhouette[yy] > 0) {
        sum += silhouette[yy];
        count += 1;
      }
    }
    const avgWidth = count ? sum / count : 0;
    return avgWidth / pxPerCm;
  };

  const pescoco = measureAt(0.06);
  const ombro = measureAt(0.17);
  const cintura = measureAt(0.48);
  const quadril = measureAt(0.59);

  // Método da Marinha (Navy) para % de gordura — homens.
  const bodyFatPct =
    cintura > pescoco && pescoco > 0
      ? 495 / (1.0324 - 0.19077 * Math.log10(cintura - pescoco) + 0.15456 * Math.log10(heightCm)) - 450
      : null;

  return {
    pescoco: Math.round(pescoco),
    ombro: Math.round(ombro),
    cintura: Math.round(cintura),
    quadril: Math.round(quadril),
    bodyFatPct: bodyFatPct !== null ? Math.round(bodyFatPct * 10) / 10 : null,
    silhouetteRows: silhouette,
  };
}

// Desenha a imagem + sobreposições num canvas e baixa como PNG.
export async function exportBodyTwinImage(opts: {
  imageSrc: string;
  markers: { label: string; x: number; y: number; active: boolean }[];
  badge?: string | null;
  measure?: { p1: { x: number; y: number }; p2: { x: number; y: number }; cm: number } | null;
}): Promise<void> {
  const img = await loadImage(opts.imageSrc);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas não suportado');
  ctx.drawImage(img, 0, 0, w, h);

  const scale = w / 100; // marcadores em % → px

  // fita métrica
  if (opts.measure) {
    const x1 = opts.measure.p1.x * scale;
    const y1 = opts.measure.p1.y * scale;
    const x2 = opts.measure.p2.x * scale;
    const y2 = opts.measure.p2.y * scale;
    ctx.strokeStyle = '#ff6b35';
    ctx.lineWidth = Math.max(3, w * 0.004);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    ctx.font = `bold ${Math.round(w * 0.03)}px sans-serif`;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    const label = `${opts.measure.cm.toFixed(1)} cm`;
    const tw = ctx.measureText(label).width;
    ctx.fillRect(mx - tw / 2 - 8, my - Math.round(w * 0.025) - 8, tw + 16, Math.round(w * 0.04));
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(label, mx, my - Math.round(w * 0.01));
  }

  // marcadores
  opts.markers.forEach((m) => {
    const x = m.x * scale;
    const y = m.y * scale;
    const radius = Math.round(w * 0.02);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = m.active ? 'rgba(255,107,53,0.9)' : 'rgba(0,0,0,0.5)';
    ctx.fill();
    ctx.lineWidth = Math.max(2, w * 0.004);
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    // cruz interna
    ctx.beginPath();
    ctx.moveTo(x - radius * 0.4, y);
    ctx.lineTo(x + radius * 0.4, y);
    ctx.moveTo(x, y - radius * 0.4);
    ctx.lineTo(x, y + radius * 0.4);
    ctx.stroke();
    // label
    ctx.font = `bold ${Math.round(w * 0.026)}px sans-serif`;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    const tw = ctx.measureText(m.label).width;
    ctx.fillRect(x - tw / 2 - 8, y + radius + 6, tw + 16, Math.round(w * 0.04));
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(m.label, x, y + radius + Math.round(w * 0.032));
  });

  // badge
  if (opts.badge) {
    ctx.font = `bold ${Math.round(w * 0.03)}px sans-serif`;
    const tw = ctx.measureText(opts.badge).width;
    const bx = w / 2 - tw / 2 - 14;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(bx, Math.round(h * 0.03), tw + 28, Math.round(w * 0.045));
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(opts.badge, w / 2, Math.round(h * 0.03) + Math.round(w * 0.032));
  }

  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `body-twin-${new Date().toISOString().slice(0, 10)}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}