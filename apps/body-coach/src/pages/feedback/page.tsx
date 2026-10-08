import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { chatApi } from '@/lib/chat';

interface Item { id: string; nome: string; tipo: string; texto: string; tela: string; em: number }
const TIPOS = [['bug', 'Algo não funciona'], ['ideia', 'Tenho uma ideia'], ['elogio', 'Gostei de algo']] as const;

// Enviar feedback: vai direto para o administrador (que também vê aqui a lista de todos os comentários).
export default function Feedback() {
  const loc = useLocation();
  const origem = (loc.state as { de?: string } | null)?.de ?? '';
  const [tipo, setTipo] = useState<string>('bug');
  const [texto, setTexto] = useState('');
  const [msg, setMsg] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [itens, setItens] = useState<Item[] | null>(null);

  useEffect(() => { chatApi<{ itens: Item[] }>({ acao: 'feedback_ver' }).then((r) => setItens(r.itens)).catch(() => setItens(null)); }, []);

  const enviar = async () => {
    setEnviando(true); setMsg('');
    try { await chatApi({ acao: 'feedback_enviar', tipo, texto, tela: origem }); setTexto(''); setMsg('Obrigado! Recebi o seu comentário.'); }
    catch (e) { setMsg((e as Error).message); }
    finally { setEnviando(false); }
  };

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="font-heading text-2xl font-bold text-foreground-950">Enviar feedback</h1>
      <p className="text-sm text-foreground-600">Conte o que não funcionou ou o que você gostaria de ver. Isso ajuda muito a melhorar o app.</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de comentário">
        {TIPOS.map(([c, n]) => <button key={c} role="radio" aria-checked={tipo === c} onClick={() => setTipo(c)} className={`rounded-full border px-3 py-1.5 text-sm ${tipo === c ? 'border-primary-500 bg-primary-100 text-primary-700' : 'border-background-200 text-foreground-600'}`}>{n}</button>)}
      </div>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} maxLength={2000} placeholder="Escreva aqui" aria-label="Seu comentário" className="w-full rounded-xl border border-background-200 bg-background-50 p-3 text-sm outline-none focus:border-primary-300" />
      <button onClick={() => void enviar()} disabled={enviando || texto.trim().length < 3} className="w-full rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-background-50 disabled:opacity-40">{enviando ? 'Enviando…' : 'Enviar'}</button>
      {msg && <p role="status" className="text-sm text-primary-700">{msg}</p>}
      {itens && (
        <section className="pt-4">
          <h2 className="font-heading text-lg font-semibold text-foreground-950">Comentários recebidos ({itens.length})</h2>
          <ul className="mt-2 space-y-2">
            {itens.map((i) => (
              <li key={i.id} className="rounded-xl border border-background-200 bg-background-50 p-3 text-sm">
                <p className="text-xs text-foreground-500">{i.tipo} · {i.nome || 'sem nome'} · {new Date(i.em).toLocaleString('pt-BR')}{i.tela ? ` · ${i.tela}` : ''}</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-foreground-800">{i.texto}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
