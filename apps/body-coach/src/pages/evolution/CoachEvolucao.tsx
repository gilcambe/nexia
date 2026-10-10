import { useEffect, useState } from 'react';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import { evolucaoConfig, evolucaoInfo, PREPARO, type Partilha, type ProximaAvaliacao } from '@/lib/avaliacao/coach';
import { dataBr } from '@/lib/avaliacao/calculos';
import { compartilharArquivo } from '@/lib/avaliacao/imagens';
import { gerarIcsAvaliacaoMarcada } from '@/lib/lembretes';

// Para o aluno que tem coach: a próxima avaliação marcada (com o preparo) e o que o coach pode ver.
export default function CoachEvolucao() {
  const { isLocalDemo } = useAuth();
  const [info, setInfo] = useState<{ coach: { nome: string } | null; partilha: Partilha; proximaAvaliacao: ProximaAvaliacao | null } | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (isLocalDemo) return;
    evolucaoInfo().then(setInfo).catch(() => setInfo(null));
  }, [isLocalDemo]);
  if (!info?.coach) return null;

  const mudar = async (p: Partilha) => {
    setErro('');
    const antes = info.partilha;
    setInfo({ ...info, partilha: p });
    try { await evolucaoConfig(p); } catch (e) { setInfo({ ...info, partilha: antes }); setErro((e as Error).message); }
  };
  const prox = info.proximaAvaliacao;
  const futura = prox && prox.data >= new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);

  return (
    <Card padding="p-5">
      <div className="mb-3 flex items-center gap-2">
        <i className="ri-user-star-line text-lg text-primary-500"></i>
        <h2 className="font-heading text-base font-semibold text-foreground-950">Seu coach: {info.coach.nome}</h2>
      </div>
      {futura && prox && (
        <div className="mb-3 rounded-xl bg-accent-50 p-3 text-sm text-accent-900">
          <p className="font-semibold">📅 Próxima avaliação: {dataBr(prox.data)}{prox.hora ? ` às ${prox.hora}` : ''}</p>
          <ul className="mt-1 list-disc pl-5 text-xs">{PREPARO.map((p) => <li key={p}>{p}</li>)}</ul>
          <button type="button" onClick={() => void compartilharArquivo(new Blob([gerarIcsAvaliacaoMarcada(prox.data, prox.hora, info.coach!.nome, PREPARO)], { type: 'text/calendar;charset=utf-8' }), 'avaliacao.ics')} className="mt-2 rounded-lg border border-accent-300 bg-background-50 px-3 py-1.5 text-xs font-semibold text-accent-800">Pôr na agenda do celular</button>
        </div>
      )}
      <label className="flex items-center justify-between gap-3 py-1.5 text-sm text-foreground-800">
        <span>Mostrar minhas avaliações ao coach</span>
        <input type="checkbox" role="switch" checked={info.partilha.avaliacoes} onChange={(e) => void mudar({ avaliacoes: e.target.checked, fotos: e.target.checked && info.partilha.fotos })} className="h-5 w-5 accent-primary-500" />
      </label>
      <label className="flex items-center justify-between gap-3 py-1.5 text-sm text-foreground-800">
        <span>Mostrar minhas fotos ao coach</span>
        <input type="checkbox" role="switch" checked={info.partilha.fotos} disabled={!info.partilha.avaliacoes} onChange={(e) => void mudar({ avaliacoes: true, fotos: e.target.checked })} className="h-5 w-5 accent-primary-500" />
      </label>
      <p className="mt-1 text-xs text-foreground-500">O coach vê só o que estiver ligado, e você pode desligar quando quiser. Ninguém mais vê.</p>
      {erro && <p role="alert" className="mt-2 text-sm text-red-600">{erro}</p>}
    </Card>
  );
}
