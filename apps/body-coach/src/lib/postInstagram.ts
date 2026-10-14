// Post e vídeo para o Instagram feitos no próprio celular (canvas + MediaRecorder): sem servidor, sem custo.
// O aluno escolhe fotos/vídeos do treino; o app monta a imagem (colagem) ou o vídeo (sequência com zoom suave),
// com o título do treino, os números e uma marca d'água discreta "Body Coach · NEXIA" no canto.
import { selo } from '@/lib/ferramentas/cartao';

export type Formato = 'story' | 'feed';
export interface Midia { id: string; tipo: 'foto' | 'video'; url: string }
export interface TextoPost { titulo?: string; frase?: string; numeros?: { valor: string; rotulo: string }[]; marca?: string; selo?: string /* link do QR do app no canto; vazio = sem selo */ }

export const TAMANHO: Record<Formato, { w: number; h: number; rotulo: string }> = {
  story: { w: 1080, h: 1920, rotulo: 'Story / Reels (vertical)' },
  feed: { w: 1080, h: 1350, rotulo: 'Feed (4:5)' },
};
// Vídeo um pouco menor: o celular grava em tempo real sem travar.
const ESCALA_VIDEO = 2 / 3;
const SEG_FOTO = 2.5;
const SEG_VIDEO_MAX = 6;
const SEG_MAX_TOTAL = 30;

export const FRASES = ['Treino pago ✅', 'Disciplina > motivação', 'Um dia de cada vez 💪', 'Hoje eu venci a preguiça', 'Foco no processo'];

type Fonte = HTMLImageElement | HTMLVideoElement;

export function carregarMidia(m: Midia): Promise<Fonte> {
  return new Promise((ok, erro) => {
    if (m.tipo === 'foto') {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => erro(new Error('Não consegui abrir uma das fotos.'));
      img.src = m.url;
      return;
    }
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.crossOrigin = 'anonymous';
    v.onloadeddata = () => ok(v);
    v.onerror = () => erro(new Error('Não consegui abrir um dos vídeos.'));
    v.src = m.url;
    v.load();
  });
}

const dimensoes = (f: Fonte) => (f instanceof HTMLVideoElement ? { w: f.videoWidth || 720, h: f.videoHeight || 1280 } : { w: f.naturalWidth || 1, h: f.naturalHeight || 1 });

// Desenha a mídia cobrindo o retângulo (corta as sobras, como o Instagram), com zoom opcional.
function cobrir(ctx: CanvasRenderingContext2D, f: Fonte, x: number, y: number, w: number, h: number, zoom = 1) {
  const d = dimensoes(f);
  const esc = Math.max(w / d.w, h / d.h) * zoom;
  const dw = d.w * esc;
  const dh = d.h * esc;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(f, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

function quebrar(ctx: CanvasRenderingContext2D, texto: string, largura: number): string[] {
  const linhas: string[] = [];
  let atual = '';
  for (const p of texto.split(/\s+/)) {
    const t = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(t).width > largura && atual) { linhas.push(atual); atual = p; } else atual = t;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

// Textos por cima: sombra embaixo, título, frase, números e a marca d'água discreta no canto.
export function desenharTextos(ctx: CanvasRenderingContext2D, W: number, H: number, t: TextoPost, alfa = 1) {
  const u = W / 1080; // unidade: tudo proporcional ao tamanho
  ctx.save();
  ctx.globalAlpha = alfa;
  const temTexto = !!(t.titulo || t.frase || t.numeros?.length);
  if (temTexto) {
    const g = ctx.createLinearGradient(0, H * 0.5, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = g;
    ctx.fillRect(0, H * 0.5, W, H * 0.5);
  }
  const margem = 70 * u;
  let y = H - 150 * u - (t.selo ? 120 * u : 0); // com o selo, o texto sobe para não ficar por baixo dele
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 12 * u;
  // Números do treino em pílulas (de baixo para cima).
  const nums = (t.numeros ?? []).filter((n) => n.valor).slice(0, 3);
  if (nums.length) {
    ctx.font = `600 ${34 * u}px system-ui, sans-serif`;
    let x = margem;
    for (const n of nums) {
      const txt = `${n.valor} ${n.rotulo}`;
      const w = ctx.measureText(txt).width + 44 * u;
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.roundRect(x, y - 52 * u, w, 70 * u, 35 * u);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(txt, x + 22 * u, y - 5 * u);
      x += w + 14 * u;
    }
    y -= 100 * u;
  }
  if (t.frase) {
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = `500 ${46 * u}px system-ui, sans-serif`;
    const ls = quebrar(ctx, t.frase, W - margem * 2).slice(0, 2);
    for (let i = ls.length - 1; i >= 0; i--) { ctx.fillText(ls[i], margem, y); y -= 58 * u; }
    y -= 10 * u;
  }
  if (t.titulo) {
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${72 * u}px system-ui, sans-serif`;
    const ls = quebrar(ctx, t.titulo, W - margem * 2).slice(0, 2);
    for (let i = ls.length - 1; i >= 0; i--) { ctx.fillText(ls[i], margem, y); y -= 84 * u; }
  }
  ctx.restore();
  if (t.selo) selo(ctx, W, H, t.selo);
  else marcaDagua(ctx, W, H, t.marca);
}

// Marca d'água discreta (canto de baixo, à direita): pequena e meio transparente.
export function marcaDagua(ctx: CanvasRenderingContext2D, W: number, H: number, marca?: string) {
  const u = W / 1080;
  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 6 * u;
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${28 * u}px system-ui, sans-serif`;
  ctx.fillText(marca ? `${marca} · Body Coach` : 'Body Coach', W - 40 * u, H - 62 * u);
  ctx.globalAlpha = 0.55;
  ctx.font = `500 ${20 * u}px system-ui, sans-serif`;
  ctx.fillText('feito com NEXIA', W - 40 * u, H - 34 * u);
  ctx.restore();
}

// Colagem para imagem: 1 mídia ocupa tudo; 2 lado a lado (ou em cima/embaixo no story); 3 ou 4 em grade.
function colagem(ctx: CanvasRenderingContext2D, W: number, H: number, fontes: Fonte[]) {
  ctx.fillStyle = '#0b0b0f';
  ctx.fillRect(0, 0, W, H);
  const f = fontes.slice(0, 4);
  const gap = 8 * (W / 1080);
  if (f.length === 1) return cobrir(ctx, f[0], 0, 0, W, H);
  if (f.length === 2) {
    if (H > W * 1.4) { cobrir(ctx, f[0], 0, 0, W, H / 2 - gap / 2); cobrir(ctx, f[1], 0, H / 2 + gap / 2, W, H / 2 - gap / 2); }
    else { cobrir(ctx, f[0], 0, 0, W / 2 - gap / 2, H); cobrir(ctx, f[1], W / 2 + gap / 2, 0, W / 2 - gap / 2, H); }
    return;
  }
  if (f.length === 3) {
    cobrir(ctx, f[0], 0, 0, W, H / 2 - gap / 2);
    cobrir(ctx, f[1], 0, H / 2 + gap / 2, W / 2 - gap / 2, H / 2 - gap / 2);
    cobrir(ctx, f[2], W / 2 + gap / 2, H / 2 + gap / 2, W / 2 - gap / 2, H / 2 - gap / 2);
    return;
  }
  const w = W / 2 - gap / 2;
  const h = H / 2 - gap / 2;
  f.forEach((x, i) => cobrir(ctx, x, (i % 2) * (w + gap), Math.floor(i / 2) * (h + gap), w, h));
}

async function quadroDoVideo(v: HTMLVideoElement): Promise<void> {
  // Um quadro do meio do primeiro segundo, para a foto não sair preta.
  await new Promise<void>((ok) => {
    const pronto = () => { v.removeEventListener('seeked', pronto); ok(); };
    v.addEventListener('seeked', pronto);
    try { v.currentTime = Math.min(0.5, (v.duration || 1) / 2); } catch { ok(); }
    setTimeout(ok, 1500);
  });
}

export async function gerarImagem(midias: Midia[], formato: Formato, texto: TextoPost, canvas?: HTMLCanvasElement): Promise<Blob> {
  const { w, h } = TAMANHO[formato];
  const c = canvas ?? document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Este aparelho não consegue montar a imagem.');
  const fontes = await Promise.all(midias.slice(0, 4).map(carregarMidia));
  for (const f of fontes) if (f instanceof HTMLVideoElement) await quadroDoVideo(f);
  colagem(ctx, w, h, fontes);
  desenharTextos(ctx, w, h, texto);
  const blob: Blob | null = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.92));
  if (!blob) throw new Error('Não consegui gerar a imagem.');
  return blob;
}

export function tipoDeVideo(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement === 'undefined' || !('captureStream' in HTMLCanvasElement.prototype)) return null;
  // MP4 primeiro: o Instagram aceita direto. WebM fica de reserva (Android antigo).
  for (const mime of ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) {
    try { if (MediaRecorder.isTypeSupported(mime)) return { mime, ext: mime.startsWith('video/mp4') ? 'mp4' : 'webm' }; } catch { /* segue */ }
  }
  return null;
}

// Quanto o vídeo final vai durar (fotos 2,5 s; vídeos até 6 s; no máximo 30 s).
export function duracaoPrevista(midias: Midia[], duracoes: Record<string, number> = {}): number {
  const total = midias.reduce((a, m) => a + (m.tipo === 'foto' ? SEG_FOTO : Math.min(SEG_VIDEO_MAX, duracoes[m.id] || SEG_VIDEO_MAX)), 0);
  return Math.min(SEG_MAX_TOTAL, total);
}

// Vídeo: cada foto aparece com um zoom suave; cada vídeo toca (sem som) por até 6 s. Grava o canvas em tempo real.
export async function gerarVideo(midias: Midia[], formato: Formato, texto: TextoPost, onProgresso?: (p: number) => void, canvas?: HTMLCanvasElement): Promise<{ blob: Blob; ext: string }> {
  const tipo = tipoDeVideo();
  if (!tipo) throw new Error('Este navegador não grava vídeo. Use a opção de imagem.');
  const W = Math.round(TAMANHO[formato].w * ESCALA_VIDEO / 2) * 2;
  const H = Math.round(TAMANHO[formato].h * ESCALA_VIDEO / 2) * 2;
  const c = canvas ?? document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Este aparelho não consegue montar o vídeo.');
  const fontes = await Promise.all(midias.map(carregarMidia));
  const cenas = fontes.map((f) => ({ f, seg: f instanceof HTMLVideoElement ? Math.min(SEG_VIDEO_MAX, Number.isFinite(f.duration) && f.duration > 0 ? f.duration : SEG_VIDEO_MAX) : SEG_FOTO }));
  const usadas: typeof cenas = [];
  let acumulado = 0;
  for (const cn of cenas) { if (acumulado >= SEG_MAX_TOTAL) break; usadas.push(cn); acumulado += cn.seg; }
  const duracao = Math.min(SEG_MAX_TOTAL, usadas.reduce((a, cn) => a + cn.seg, 0));

  const stream = (c as HTMLCanvasElement & { captureStream: (fps?: number) => MediaStream }).captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: tipo.mime, videoBitsPerSecond: 3_500_000 });
  const partes: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
  const fim = new Promise<void>((ok) => { rec.onstop = () => ok(); });

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  rec.start(250);
  let feito = 0;
  for (const cena of usadas) {
    const seg = Math.min(cena.seg, duracao - feito);
    if (seg <= 0) break;
    const v = cena.f instanceof HTMLVideoElement ? cena.f : null;
    if (v) { try { v.currentTime = 0; await v.play(); } catch { /* sem play: desenha o quadro parado */ } }
    const inicio = performance.now();
    await new Promise<void>((ok) => {
      const passo = () => {
        const t = (performance.now() - inicio) / 1000;
        const p = Math.min(1, t / seg);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        cobrir(ctx, cena.f, 0, 0, W, H, v ? 1 : 1 + 0.08 * p);
        // Entrada suave de cada cena.
        if (t < 0.25) { ctx.fillStyle = `rgba(0,0,0,${1 - t / 0.25})`; ctx.fillRect(0, 0, W, H); }
        desenharTextos(ctx, W, H, texto, Math.min(1, (feito + t) / 0.6));
        onProgresso?.(Math.min(0.99, (feito + t) / duracao));
        if (t >= seg) ok(); else requestAnimationFrame(passo);
      };
      requestAnimationFrame(passo);
    });
    if (v) v.pause();
    feito += seg;
  }
  rec.stop();
  await fim;
  stream.getTracks().forEach((tr) => tr.stop());
  onProgresso?.(1);
  return { blob: new Blob(partes, { type: tipo.mime.split(';')[0] }), ext: tipo.ext };
}

// Abre o "compartilhar" do celular (Instagram, WhatsApp...). Sem isso, baixa o arquivo.
export async function compartilharArquivo(blob: Blob, nome: string, texto: string): Promise<'compartilhado' | 'baixado'> {
  const arquivo = new File([blob], nome, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: { files?: File[] }) => boolean };
  if (nav.share && nav.canShare?.({ files: [arquivo] })) {
    try {
      await nav.share({ files: [arquivo], text: texto });
      return 'compartilhado';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'compartilhado';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  return 'baixado';
}
