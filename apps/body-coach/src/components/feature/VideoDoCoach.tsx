import { useEffect, useState } from 'react';
import { chatApi } from '@/lib/chat';
import { papelEContatos, papelSalvo } from '@/lib/papelCoach';
import GravadorVideo from './GravadorVideo';

// Abaixo da demonstração do exercício: o aluno vê o vídeo que o SEU coach gravou; o coach grava/troca o dele.
// Só aparece para quem já entrou na conversa com o coach (senão fica invisível e não faz chamadas repetidas).
const cache = new Map<string, string | null>();
export default function VideoDoCoach({ id, nome }: { id: string; nome: string }) {
  const [papel, setPapel] = useState(papelSalvo());
  const [video, setVideo] = useState<string | null>(cache.get(id) ?? null);
  const [gravando, setGravando] = useState(false);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    let vivo = true;
    void papelEContatos().then(async ({ papel: p }) => {
      if (!vivo) return;
      setPapel(p);
      if (p === 'nenhum' || cache.has(id)) return;
      try { const r = await chatApi<{ video: string | null }>({ acao: 'demo_ver', exercicio: id }); cache.set(id, r.video); if (vivo) setVideo(r.video); } catch { /* sem vídeo */ }
    });
    return () => { vivo = false; };
  }, [id]);

  if (!papel || papel === 'nenhum') return null;
  return (
    <div className="mt-2">
      {video && (aberto
        ? <video src={video} controls autoPlay loop playsInline className="w-full rounded-xl bg-black sm:max-w-sm" aria-label={`Vídeo do coach: ${nome}`} />
        : <button onClick={() => setAberto(true)} className="inline-flex items-center gap-2 rounded-lg bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-700"><i className="ri-play-circle-line text-lg"></i>Ver como o meu coach faz</button>)}
      {papel === 'coach' && (
        <button onClick={() => setGravando(true)} className="ml-0 mt-1 block text-sm font-medium text-primary-600 hover:underline"><i className="ri-video-add-line mr-1"></i>{video ? 'Gravar de novo a minha execução' : 'Gravar a minha execução deste exercício'}</button>
      )}
      {gravando && (
        <GravadorVideo
          titulo={`Sua execução: ${nome}`}
          onFechar={() => setGravando(false)}
          onEnviar={async (v) => { await chatApi({ acao: 'demo_salvar', exercicio: id, video: v }); cache.set(id, v); setVideo(v); setAberto(false); }}
        />
      )}
    </div>
  );
}
