import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { chatApi } from '@/lib/chat';
import { papelEContatos, papelSalvo } from '@/lib/papelCoach';
import { demosCoach } from '@/lib/demosCoach';
import DemoExecucao from './DemoExecucao';
import GravadorVideo from './GravadorVideo';

// Demonstração do exercício. Se o coach do aluno gravou a própria execução, ela vira a demonstração
// principal (vídeo em loop); a demonstração padrão fica a um toque. O coach grava/troca a dele aqui mesmo.
const cache = demosCoach;

export default function VideoDoCoach({ id, nome, className = '', gravar = true }: { id: string; nome: string; className?: string; gravar?: boolean }) {
  const [papel, setPapel] = useState(papelSalvo());
  const [video, setVideo] = useState<string | null>(cache.get(id) ?? null);
  const [gravando, setGravando] = useState(false);
  const [padrao, setPadrao] = useState(false);

  useEffect(() => {
    let vivo = true;
    setVideo(cache.get(id) ?? null);
    setPadrao(false);
    void papelEContatos().then(async ({ papel: p }) => {
      if (!vivo) return;
      setPapel(p);
      if (p === 'nenhum' || cache.has(id)) return;
      try { const r = await chatApi<{ video: string | null }>({ acao: 'demo_ver', exercicio: id }); cache.set(id, r.video); if (vivo) setVideo(r.video); } catch { /* sem vídeo */ }
    });
    return () => { vivo = false; };
  }, [id]);

  const doCoach = !!video && !padrao;
  return (
    <div className="mt-4">
      {doCoach ? (
        <div className={`relative overflow-hidden bg-black ${className}`}>
          <video src={video as string} autoPlay muted loop playsInline controls className="h-full w-full object-contain" aria-label={`Execução do coach: ${nome}`} data-testid="demo-coach-video" />
          <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-primary-500 px-2 py-1 text-[11px] font-semibold text-white">
            <i className="ri-user-star-fill mr-1"></i>{papel === 'coach' ? 'Sua execução (seus alunos veem)' : 'Execução do seu coach'}
          </span>
        </div>
      ) : (
        <DemoExecucao id={id} nome={nome} className={className} />
      )}
      {video && (
        <button type="button" onClick={() => setPadrao((v) => !v)} className="mt-1.5 text-xs font-medium text-foreground-500 underline">
          {padrao ? (papel === 'coach' ? 'Ver a minha execução' : 'Ver a execução do meu coach') : 'Ver demonstração padrão'}
        </button>
      )}
      {papel === 'coach' && gravar && (
        <div className="mt-2 flex items-center gap-3 rounded-xl border border-primary-200 bg-primary-50 p-3">
          <i className="ri-video-add-line text-2xl text-primary-600"></i>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground-900">{video ? 'Seus alunos veem a sua execução' : 'Mostre aos alunos como você faz'}</p>
            <p className="text-[11px] text-foreground-500">Grave até 10 s. Vira a demonstração deste exercício para todos os seus alunos. <Link to="/coach/demonstracoes" className="font-semibold text-primary-600 underline">Todas</Link></p>
          </div>
          <button type="button" onClick={() => setGravando(true)} className="shrink-0 rounded-lg bg-primary-500 px-3 py-2 text-xs font-semibold text-white" data-testid="demo-coach-gravar">{video ? 'Regravar' : 'Gravar'}</button>
        </div>
      )}
      {gravando && (
        <GravadorVideo
          titulo={`Sua execução: ${nome}`}
          onFechar={() => setGravando(false)}
          onEnviar={async (v) => { await chatApi({ acao: 'demo_salvar', exercicio: id, video: v }); cache.set(id, v); setVideo(v); setPadrao(false); }}
        />
      )}
    </div>
  );
}
