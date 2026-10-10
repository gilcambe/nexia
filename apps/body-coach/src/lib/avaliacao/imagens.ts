// Montagem antes/depois e vídeo de evolução, feitos no próprio celular (canvas + MediaRecorder),
// sem servidor e sem custo.
import { dataBr } from './calculos.ts';

function carregar(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Foto inválida'));
    img.src = src;
  });
}

// Desenha a foto cobrindo o quadro (como object-fit: cover, alinhada pelo topo).
function cobrir(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s;
  const sh = h / s;
  const sx = (img.width - sw) / 2;
  ctx.drawImage(img, sx, 0, sw, sh, x, y, w, h);
}

function etiqueta(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, tam: number) {
  ctx.font = `700 ${tam}px Inter, sans-serif`;
  const w = ctx.measureText(texto).width + tam;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, tam * 1.7, tam * 0.85);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(texto, x + tam / 2, y + tam * 1.2);
}

function marca(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.font = `600 ${Math.round(w / 45)}px Inter, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.textAlign = 'right';
  ctx.fillText('Feito com NEXIA Body Coach', w - 16, h - 16);
  ctx.textAlign = 'left';
}

export interface Quadro { src: string; legenda: string }

// Grade de fotos: colunas = datas, linhas = poses (ou 1 linha com 2 datas, como nas montagens de antes/depois).
export async function montagem(linhas: Quadro[][], largura = 1440): Promise<Blob> {
  const cols = Math.max(...linhas.map((l) => l.length));
  const celW = Math.floor(largura / cols);
  const celH = Math.round(celW * (4 / 3));
  const canvas = document.createElement('canvas');
  canvas.width = celW * cols;
  canvas.height = celH * linhas.length;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let r = 0; r < linhas.length; r += 1) {
    for (let c = 0; c < linhas[r].length; c += 1) {
      const q = linhas[r][c];
      const img = await carregar(q.src);
      cobrir(ctx, img, c * celW + 3, r * celH + 3, celW - 6, celH - 6);
      etiqueta(ctx, q.legenda, c * celW + 14, r * celH + 14, Math.round(celW / 22));
    }
  }
  marca(ctx, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar a imagem'))), 'image/jpeg', 0.9));
}

export function videoSuportado(): boolean {
  return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

// Vídeo curto: cada foto aparece com a data e o peso, com transição suave. 9:16 para stories.
export async function videoEvolucao(quadros: { src: string; data: string; texto?: string }[], aoProgresso?: (p: number) => void): Promise<Blob> {
  if (!videoSuportado()) throw new Error('Este navegador não grava vídeo. Use a montagem de fotos.');
  const W = 720;
  const H = 1280;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const imgs = await Promise.all(quadros.map((q) => carregar(q.src)));
  const tipo = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t)) ?? 'video/webm';
  const rec = new MediaRecorder(canvas.captureStream(30), { mimeType: tipo, videoBitsPerSecond: 2_500_000 });
  const partes: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
  const fim = new Promise<Blob>((resolve) => { rec.onstop = () => resolve(new Blob(partes, { type: tipo.split(';')[0] })); });

  const porFoto = 1400;
  const fade = 450;
  const total = porFoto * imgs.length + 900;
  const desenhar = (t: number) => {
    const i = Math.min(imgs.length - 1, Math.floor(t / porFoto));
    const dentro = t - i * porFoto;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    cobrir(ctx, imgs[i], 0, 120, W, H - 240);
    if (i + 1 < imgs.length && dentro > porFoto - fade) {
      ctx.globalAlpha = (dentro - (porFoto - fade)) / fade;
      cobrir(ctx, imgs[i + 1], 0, 120, W, H - 240);
      ctx.globalAlpha = 1;
    }
    const q = quadros[i];
    ctx.fillStyle = '#fff';
    ctx.font = '700 46px Inter, sans-serif';
    ctx.fillText(dataBr(q.data), 40, 80);
    if (q.texto) {
      ctx.font = '600 38px Inter, sans-serif';
      ctx.fillText(q.texto, 40, H - 50);
    }
    ctx.font = '600 22px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'right';
    ctx.fillText('NEXIA Body Coach', W - 30, 80);
    ctx.textAlign = 'left';
  };

  rec.start(250);
  const t0 = performance.now();
  await new Promise<void>((resolve) => {
    const passo = () => {
      const t = performance.now() - t0;
      desenhar(Math.min(t, total - 1));
      aoProgresso?.(Math.min(1, t / total));
      if (t >= total) resolve();
      else requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  });
  rec.stop();
  return fim;
}

// Envia pelo compartilhamento do celular (WhatsApp, Instagram...) ou baixa o arquivo.
export async function compartilharArquivo(blob: Blob, nome: string): Promise<void> {
  const arquivo = new File([blob], nome, { type: blob.type });
  if (navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: 'Minha evolução' });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
