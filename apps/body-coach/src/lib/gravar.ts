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
