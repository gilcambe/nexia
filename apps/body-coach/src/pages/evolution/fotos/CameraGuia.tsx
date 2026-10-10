import { useEffect, useRef, useState } from 'react';
import { POSES, type Pose } from '@/lib/avaliacao/dados';
import Silhueta from './Silhueta';

// Câmera em tela cheia com o contorno da pose, a "foto fantasma" da última vez (para alinhar)
// e um temporizador de 10 s para quem tira a foto sozinho.
export default function CameraGuia({
  pose,
  fantasma,
  onFoto,
  onFechar,
}: {
  pose: Pose;
  fantasma?: string | null;
  onFoto: (foto: Blob) => void;
  onFechar: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [frontal, setFrontal] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [contagem, setContagem] = useState<number | null>(null);
  const [opFantasma, setOpFantasma] = useState(0.35);
  const info = POSES.find((p) => p.id === pose)!;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let ativo = true;
    setErro(null);
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: frontal ? 'user' : 'environment', width: { ideal: 1440 }, height: { ideal: 1920 } }, audio: false })
      .then((s) => {
        if (!ativo) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play().catch(() => {});
        }
      })
      .catch(() => setErro('Não consegui abrir a câmera. Libere a câmera para o app ou escolha uma foto da galeria.'));
    if (!navigator.mediaDevices) setErro('Este navegador não abre a câmera aqui. Escolha uma foto da galeria.');
    return () => {
      ativo = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [frontal]);

  useEffect(() => {
    if (contagem == null) return;
    if (contagem === 0) { capturar(); setContagem(null); return; }
    const t = setTimeout(() => setContagem((c) => (c == null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contagem]);

  const capturar = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    // Recorta 3:4 (retrato) do centro, igual ao quadro que a pessoa vê.
    const alvo = 3 / 4;
    let w = v.videoWidth;
    let h = v.videoHeight;
    if (w / h > alvo) w = Math.round(h * alvo); else h = Math.round(w / alvo);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    if (frontal) { ctx.translate(w, 0); ctx.scale(-1, 1); }
    ctx.drawImage(v, (v.videoWidth - w) / 2, (v.videoHeight - h) / 2, w, h, 0, 0, w, h);
    canvas.toBlob((b) => { if (b) onFoto(b); }, 'image/jpeg', 0.92);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white" role="dialog" aria-label={`Foto ${info.label}`}>
      <div className="flex items-center justify-between px-3 py-2">
        <button type="button" onClick={onFechar} className="rounded-full p-2" aria-label="Fechar câmera"><i className="ri-close-line text-2xl"></i></button>
        <p className="text-sm font-semibold">{info.label}</p>
        <button type="button" onClick={() => setFrontal((f) => !f)} className="rounded-full p-2" aria-label="Trocar câmera"><i className="ri-camera-switch-line text-2xl"></i></button>
      </div>
      <div className="relative mx-auto aspect-[3/4] w-full max-w-[520px] flex-1 overflow-hidden" style={{ maxHeight: 'calc(100vh - 170px)' }}>
        <video ref={video} playsInline muted className="absolute inset-0 h-full w-full object-cover" style={frontal ? { transform: 'scaleX(-1)' } : undefined} />
        {fantasma && <img src={fantasma} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover object-top" style={{ opacity: opFantasma }} />}
        <Silhueta pose={pose} className="pointer-events-none absolute inset-0 h-full w-full" />
        {contagem != null && <div className="absolute inset-0 flex items-center justify-center text-8xl font-bold drop-shadow-lg">{contagem}</div>}
        {erro && <p className="absolute inset-x-4 top-1/3 rounded-lg bg-black/70 p-3 text-center text-sm">{erro}</p>}
      </div>
      <p className="px-4 pt-2 text-center text-xs text-white/80">{info.dica} Mesmo lugar, mesma luz e mesma distância sempre.</p>
      {fantasma && (
        <label className="mx-auto mt-1 flex w-full max-w-[320px] items-center gap-2 px-4 text-[11px] text-white/80">
          Foto anterior
          <input type="range" min={0} max={0.7} step={0.05} value={opFantasma} onChange={(e) => setOpFantasma(Number(e.target.value))} className="flex-1" aria-label="Transparência da foto anterior" />
        </label>
      )}
      <div className="flex items-center justify-center gap-8 py-3">
        <button type="button" onClick={() => setContagem(10)} disabled={!!erro || contagem != null} className="flex flex-col items-center text-xs disabled:opacity-40" aria-label="Tirar foto em 10 segundos">
          <i className="ri-timer-line text-2xl"></i>10 s
        </button>
        <button type="button" onClick={capturar} disabled={!!erro} className="h-16 w-16 rounded-full border-4 border-white bg-white/20 disabled:opacity-40" aria-label="Tirar foto agora"></button>
        <span className="w-10" />
      </div>
    </div>
  );
}
