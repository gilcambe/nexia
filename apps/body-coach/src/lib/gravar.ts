// Grava um clipe curto (até 10 s) já comprimido no próprio celular, sem áudio, para caber no banco grátis.
export const MAX_SEG = 10;
export const MAX_CHARS = 690000;

export function podeGravar(): boolean {
  return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

function tipoSuportado(): string {
  for (const t of ['video/webm;codecs=vp8', 'video/webm', 'video/mp4']) if (MediaRecorder.isTypeSupported?.(t)) return t;
  return '';
}

export function lerComoTexto(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error('Não consegui ler o vídeo.'));
    r.readAsDataURL(b);
  });
}

export interface Gravacao { parar: () => void; pronto: Promise<string>; stream: MediaStream }

// Abre a câmera traseira e começa a gravar; para sozinho em MAX_SEG segundos. `pronto` entrega o vídeo como texto (data URL).
export async function iniciarGravacao(): Promise<Gravacao> {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 480 }, height: { ideal: 640 }, frameRate: { ideal: 20 } }, audio: false });
  const tipo = tipoSuportado();
  const rec = new MediaRecorder(stream, { ...(tipo ? { mimeType: tipo } : {}), videoBitsPerSecond: 300000 });
  const partes: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
  const pronto = new Promise<string>((res, rej) => {
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      try {
        const txt = await lerComoTexto(new Blob(partes, { type: rec.mimeType || 'video/webm' }));
        if (txt.length > MAX_CHARS) rej(new Error('O vídeo ficou grande demais. Grave um pouco menos.'));
        else res(txt);
      } catch (e) { rej(e as Error); }
    };
    rec.onerror = () => rej(new Error('A gravação falhou.'));
  });
  rec.start(500);
  const timer = setTimeout(() => { if (rec.state !== 'inactive') rec.stop(); }, MAX_SEG * 1000);
  return { stream, pronto, parar: () => { clearTimeout(timer); if (rec.state !== 'inactive') rec.stop(); } };
}

// Vídeo que já está na galeria (gravado antes, com a câmera do celular): reduz para o mesmo tamanho
// da gravação do app (até 10 s, sem som, ~480 px) tocando o vídeo num canvas e gravando de novo.
export async function comprimirArquivo(arquivo: Blob, inicioSeg = 0, onProgresso?: (p: number) => void): Promise<string> {
  if (typeof MediaRecorder === 'undefined' || !('captureStream' in HTMLCanvasElement.prototype)) throw new Error('Este navegador não consegue preparar o vídeo. Use o botão Gravar.');
  const url = URL.createObjectURL(arquivo);
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.src = url;
  try {
    await new Promise<void>((ok, erro) => { v.onloadedmetadata = () => ok(); v.onerror = () => erro(new Error('Não consegui abrir esse vídeo.')); });
    const esc = Math.min(1, 480 / Math.max(v.videoWidth || 480, v.videoHeight || 640));
    const c = document.createElement('canvas');
    c.width = Math.round((v.videoWidth || 360) * esc / 2) * 2;
    c.height = Math.round((v.videoHeight || 480) * esc / 2) * 2;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('Não consegui preparar o vídeo.');
    const inicio = Math.max(0, Math.min(inicioSeg, (v.duration || 0) - 1));
    const dur = Math.min(MAX_SEG, Math.max(1, (v.duration || MAX_SEG) - inicio));
    v.currentTime = inicio;
    await new Promise<void>((ok) => { v.onseeked = () => ok(); setTimeout(ok, 1500); });
    const stream = (c as HTMLCanvasElement & { captureStream: (fps?: number) => MediaStream }).captureStream(20);
    const tipo = tipoSuportado();
    const rec = new MediaRecorder(stream, { ...(tipo ? { mimeType: tipo } : {}), videoBitsPerSecond: 300000 });
    const partes: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
    const parou = new Promise<void>((ok) => { rec.onstop = () => ok(); });
    rec.start(500);
    await v.play().catch(() => {});
    const t0 = performance.now();
    await new Promise<void>((ok) => {
      const passo = () => {
        ctx.drawImage(v, 0, 0, c.width, c.height);
        const t = (performance.now() - t0) / 1000;
        onProgresso?.(Math.min(1, t / dur));
        if (t >= dur || v.ended) ok(); else requestAnimationFrame(passo);
      };
      requestAnimationFrame(passo);
    });
    v.pause();
    rec.stop();
    await parou;
    stream.getTracks().forEach((t) => t.stop());
    const txt = await lerComoTexto(new Blob(partes, { type: rec.mimeType || 'video/webm' }));
    if (txt.length > MAX_CHARS) throw new Error('O vídeo ficou grande demais. Escolha um trecho mais curto.');
    return txt;
  } finally {
    URL.revokeObjectURL(url);
  }
}
