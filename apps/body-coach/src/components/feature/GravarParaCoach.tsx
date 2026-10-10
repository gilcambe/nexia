import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { chatApi, type Contato } from '@/lib/chat';
import GravadorVideo from './GravadorVideo';
import { papelEContatos } from '@/lib/papelCoach';

// No treino: o aluno grava a própria execução (até 10 s) e manda direto na conversa com o coach,
// já com o nome do exercício e a carga, para o coach analisar a técnica.
export default function GravarParaCoach({ exercicio, detalhe }: { exercicio: string; detalhe?: string }) {
  const [info, setInfo] = useState<{ papel: 'coach' | 'aluno' | 'nenhum'; contatos: Contato[] } | null>(null);
  const [para, setPara] = useState<string>('');
  const [gravando, setGravando] = useState(false);
  const [enviado, setEnviado] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void papelEContatos().then((r) => { if (!vivo) return; setInfo(r); setPara(r.contatos[0]?.uid ?? ''); });
    return () => { vivo = false; };
  }, []);
  useEffect(() => { setEnviado(null); }, [exercicio]);

  if (!info || info.papel === 'coach') return null;
  const temCoach = info.papel === 'aluno' && info.contatos.length > 0;
  const coach = info.contatos.find((c) => c.uid === para);

  return (
    <div className="mt-3 rounded-xl border border-red-200 bg-red-50/60 p-3" data-testid="gravar-para-coach">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-600 text-white"><i className="ri-video-add-line text-xl"></i></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground-950">Seu coach confere a sua técnica</p>
          <p className="text-xs text-foreground-600">{temCoach ? `Grave uma série (até 10 s) e mande para ${coach?.nome || 'o seu coach'} analisar.` : 'Conecte-se ao seu coach para mandar vídeos da sua execução.'}</p>
        </div>
      </div>
      {temCoach ? (
        <>
          {info.contatos.length > 1 && (
            <select value={para} onChange={(e) => setPara(e.target.value)} className="mt-2 w-full rounded-lg border border-background-200 bg-background-50 px-2 py-1.5 text-sm" aria-label="Enviar para">
              {info.contatos.map((c) => <option key={c.uid} value={c.uid}>{c.nome}</option>)}
            </select>
          )}
          <button type="button" onClick={() => setGravando(true)} className="mt-2 w-full rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white" data-testid="gravar-execucao">
            <i className="ri-record-circle-line mr-1"></i>Gravar minha execução
          </button>
          {enviado && <p role="status" className="mt-2 text-sm text-green-700"><i className="ri-check-line mr-1"></i>{enviado}</p>}
        </>
      ) : (
        <Link to="/chat" className="mt-2 inline-flex rounded-xl bg-background-50 px-4 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-200">Conectar ao meu coach</Link>
      )}
      {gravando && (
        <GravadorVideo
          titulo={`Sua execução: ${exercicio}`}
          onFechar={() => setGravando(false)}
          onEnviar={async (v) => {
            await chatApi({ acao: 'video_enviar', com: para, video: v, texto: `Minha execução: ${exercicio}${detalhe ? ` (${detalhe})` : ''}. Pode avaliar?` });
            setEnviado(`Vídeo enviado para ${coach?.nome || 'o seu coach'}. A resposta chega na aba Coach.`);
          }}
        />
      )}
    </div>
  );
}
