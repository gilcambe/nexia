import { useEffect, useState } from 'react';
import { ALVOS, comentar, comentarios, type Comentario } from '@/lib/avaliacao/coach';

// Comentários do coach e do aluno numa avaliação (medidas ou uma foto). Ficam na conversa dos dois.
export default function Comentarios({ com, nomeOutro, entrada, data, meuUid }: { com: string; nomeOutro: string; entrada: number; data: string; meuUid: string | undefined }) {
  const [lista, setLista] = useState<Comentario[] | null>(null);
  const [alvo, setAlvo] = useState('geral');
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let vivo = true;
    comentarios(com, entrada).then((l) => vivo && setLista(l)).catch((e: Error) => { if (vivo) { setLista([]); setErro(e.message); } });
    return () => { vivo = false; };
  }, [com, entrada]);

  const enviar = async () => {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true); setErro('');
    try {
      const r = await comentar(com, entrada, alvo, t, data);
      setLista((l) => [...(l ?? []), r.mensagem]);
      setTexto('');
    } catch (e) { setErro((e as Error).message); } finally { setEnviando(false); }
  };

  const rotulo = (id?: string) => ALVOS.find((a) => a.id === id)?.label ?? 'Geral';
  return (
    <section className="rounded-2xl border border-background-200 bg-background-50 p-4" aria-label="Comentários">
      <h2 className="mb-2 font-heading text-base font-semibold text-foreground-950"><i className="ri-chat-3-line mr-1 text-primary-500"></i>Comentários com {nomeOutro}</h2>
      {lista == null ? <p className="text-sm text-foreground-500">Carregando...</p> : lista.length === 0 ? (
        <p className="text-sm text-foreground-500">Nenhum comentário nesta avaliação ainda.</p>
      ) : (
        <ul className="mb-3 space-y-2">
          {lista.map((c) => (
            <li key={c.id} className={`rounded-xl px-3 py-2 text-sm ${c.de === meuUid ? 'ml-6 bg-primary-50 text-foreground-900' : 'mr-6 bg-background-100 text-foreground-800'}`}>
              <span className="mb-0.5 block text-[11px] font-semibold text-foreground-500">{c.de === meuUid ? 'Você' : nomeOutro} · {rotulo(c.ref?.alvo)} · {new Date(c.em).toLocaleDateString('pt-BR')}</span>
              <span className="whitespace-pre-wrap">{c.texto}</span>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={(e) => { e.preventDefault(); void enviar(); }} className="space-y-2">
        <select value={alvo} onChange={(e) => setAlvo(e.target.value)} aria-label="Sobre o quê" className="w-full rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-sm">
          {ALVOS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        <div className="flex gap-2">
          <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={600} placeholder="Escreva um comentário" aria-label="Comentário" className="min-w-0 flex-1 rounded-lg border border-background-300 bg-background-50 px-3 py-2 text-sm" />
          <button type="submit" disabled={!texto.trim() || enviando} className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50 disabled:opacity-40 dark:text-foreground-950">Comentar</button>
        </div>
      </form>
      {erro && <p role="alert" className="mt-2 text-sm text-red-600">{erro}</p>}
    </section>
  );
}
