import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Card from '@/components/base/Card';
import { chatApi } from '@/lib/chat';

interface Treino { em: number; titulo: string; min: number; kcal: number }
const dia = (t: number) => new Date(t).toLocaleDateString('sv-SE'); // AAAA-MM-DD no fuso do aparelho

// O coach vê se o aluno foi treinar de verdade e qual treino fez (últimos 28 dias).
export default function Presenca() {
  const { uid } = useParams();
  const [d, setD] = useState<{ nome: string; treinos: Treino[] } | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    chatApi<{ nome: string; treinos: Treino[] }>({ acao: 'presenca_aluno', com: uid }).then(setD).catch((e: Error) => setErro(e.message));
  }, [uid]);

  if (erro) return <div className="p-8 text-center text-sm text-red-600">{erro}</div>;
  if (!d) return <div className="p-8 text-center text-sm text-foreground-500"><i className="ri-loader-4-line mr-2 animate-spin"></i>Carregando...</div>;

  const porDia = new Map<string, Treino[]>();
  for (const t of d.treinos) porDia.set(dia(t.em), [...(porDia.get(dia(t.em)) || []), t]);
  const dias = Array.from({ length: 28 }, (_, i) => new Date(Date.now() - (27 - i) * 86400000));
  const treinou = dias.filter((x) => porDia.has(dia(x.getTime()))).length;

  return (
    <div className="space-y-4">
      <Link to="/coach/alunos" className="inline-flex items-center gap-1 text-sm font-medium text-primary-700"><i className="ri-arrow-left-line"></i>Meus alunos</Link>
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground-950">Presença de {d.nome}</h1>
        <p className="text-sm text-foreground-600" data-testid="presenca-resumo">Treinou em {treinou} dos últimos 28 dias.</p>
      </header>
      <Card padding="p-4">
        <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
          {dias.map((x) => {
            const ts = porDia.get(dia(x.getTime()));
            return (
              <div key={x.toISOString()} title={ts ? ts.map((t) => t.titulo).join(', ') : 'Não treinou'}
                className={`rounded-lg py-2 ${ts ? 'bg-green-100 font-semibold text-green-800' : 'bg-background-100 text-foreground-400'}`}>{x.getDate()}</div>
            );
          })}
        </div>
      </Card>
      <Card padding="p-4">
        {d.treinos.length === 0 ? <p className="text-sm text-foreground-600">Nenhum treino concluído registrado ainda. Os treinos aparecem aqui quando o aluno terminar e o app enviar.</p> : (
          <ul className="divide-y divide-background-200">
            {d.treinos.slice(0, 30).map((t) => (
              <li key={t.em} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium text-foreground-900">{t.titulo}</span>
                <span className="text-foreground-600">{new Date(t.em).toLocaleDateString('pt-BR')} · {t.min} min</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
