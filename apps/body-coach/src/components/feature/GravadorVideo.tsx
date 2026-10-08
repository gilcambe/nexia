import { useEffect, useRef, useState } from 'react';
import { iniciarGravacao, MAX_SEG, podeGravar, type Gravacao } from '@/lib/gravar';

// Tela de gravação: mostra a câmera, grava até 10 s, deixa rever e só então envia.
export default function GravadorVideo({ titulo, onEnviar, onFechar }: { titulo: string; onEnviar: (videoTexto: string) => Promise<void>; onFechar: () => void }) {
  const vid = useRef<HTMLVideoElement>(null);
  const grav = useRef<Gravacao | null>(null);
  const [fase, setFase] = useState<'pronto' | 'gravando' | 'revisar' | 'enviando'>('pronto');
  const [seg, setSeg] = useState(0);
  const [clipe, setClipe] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => () => { grav.current?.stream.getTracks().forEach((t) => t.stop()); }, []);
  useEffect(() => {
    if (fase !== 'gravando') return;
    const t = setInterval(() => setSeg((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [fase]);

  const gravar = async () => {
    setErro(''); setSeg(0);
    try {
      const g = await iniciarGravacao();
      grav.current = g;
      if (vid.current) { vid.current.srcObject = g.stream; vid.current.muted = true; void vid.current.play().catch(() => {}); }
      setFase('gravando');
      g.pronto.then((t) => { setClipe(t); setFase('revisar'); }).catch((e: Error) => { setErro(e.message); setFase('pronto'); });
    } catch {
      setErro('Não consegui abrir a câmera. Permita o uso da câmera no navegador e tente de novo.');
    }
  };
  const enviar = async () => {
    setFase('enviando'); setErro('');
    try { await onEnviar(clipe); onFechar(); }
    catch (e) { setErro((e as Error).message); setFase('revisar'); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center" role="dialog" aria-label={titulo}>
      <div className="w-full max-w-md rounded-t-2xl bg-background-50 p-4 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-base font-bold text-foreground-950">{titulo}</h2>
          <button onClick={onFechar} aria-label="Fechar gravação" className="h-8 w-8 rounded-full text-foreground-500 hover:bg-background-100"><i className="ri-close-line text-lg"></i></button>
        </div>
        {!podeGravar() ? (
          <p className="mt-3 text-sm text-foreground-600">Este aparelho não grava vídeo pelo navegador. Abra o app no Chrome ou no Safari do celular.</p>
        ) : (
          <>
            <div className="relative mt-3 aspect-[3/4] overflow-hidden rounded-xl bg-black">
              {fase === 'revisar' || fase === 'enviando'
                ? <video src={clipe} controls playsInline className="h-full w-full object-cover" aria-label="Seu vídeo gravado" />
                : <video ref={vid} playsInline muted className="h-full w-full object-cover" aria-label="Câmera" />}
              {fase === 'gravando' && <span className="absolute left-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">● {seg}/{MAX_SEG} s</span>}
            </div>
            <p className="mt-2 text-xs text-foreground-500">Vídeo curto, de até {MAX_SEG} segundos e sem som. Apoie o celular e mostre o movimento inteiro.</p>
            <div className="mt-3 flex gap-2">
              {fase === 'pronto' && <button onClick={() => void gravar()} className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white"><i className="ri-record-circle-line mr-1"></i>Gravar</button>}
              {fase === 'gravando' && <button onClick={() => grav.current?.parar()} className="flex-1 rounded-xl bg-foreground-900 px-4 py-3 text-sm font-semibold text-background-50"><i className="ri-stop-circle-line mr-1"></i>Parar</button>}
              {(fase === 'revisar' || fase === 'enviando') && (
                <>
                  <button onClick={() => { setClipe(''); setFase('pronto'); }} disabled={fase === 'enviando'} className="rounded-xl border border-background-200 px-4 py-3 text-sm font-medium text-foreground-700 disabled:opacity-40">Gravar de novo</button>
                  <button onClick={() => void enviar()} disabled={fase === 'enviando'} className="flex-1 rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-background-50 disabled:opacity-60">{fase === 'enviando' ? 'Enviando…' : 'Enviar vídeo'}</button>
                </>
              )}
            </div>
          </>
        )}
        {erro && <p role="alert" className="mt-2 text-sm text-red-600">{erro}</p>}
      </div>
    </div>
  );
}
