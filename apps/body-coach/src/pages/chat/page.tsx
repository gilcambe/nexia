import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/feature/AuthContext';
import { chatApi, type Contato, type Mensagem } from '@/lib/chat';

type Papel = 'coach' | 'aluno';
interface Contatos { papel: Papel; codigo?: string; contatos: Contato[] }

export default function Chat() {
  const { user, profile } = useAuth();
  const [papel, setPapel] = useState<Papel | null | undefined>(undefined); // undefined = carregando, null = ainda não escolheu
  const [lista, setLista] = useState<Contatos | null>(null);
  const [aberto, setAberto] = useState<Contato | null>(null);
  const [msgs, setMsgs] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState('');
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  const nome = profile?.nickname || profile?.full_name || user?.email?.split('@')[0] || 'Aluno';

  const carregarContatos = useCallback(async () => {
    try {
      const r = await chatApi<Contatos>({ acao: 'contatos' });
      setLista(r); setPapel(r.papel); setErro('');
      if (r.papel === 'aluno' && r.contatos[0]) setAberto((a) => a ?? r.contatos[0]);
    } catch (e) {
      const m = (e as Error).message;
      if (/escolha se você/i.test(m)) setPapel(null); else { setPapel(null); setErro(m); }
    }
  }, []);
  useEffect(() => { if (user) void carregarContatos(); }, [user, carregarContatos]);

  const ler = useCallback(async () => {
    if (!aberto) return;
    try { setMsgs((await chatApi<{ mensagens: Mensagem[] }>({ acao: 'ler', com: aberto.uid })).mensagens); } catch { /* tenta de novo no próximo ciclo */ }
  }, [aberto]);
  useEffect(() => {
    if (!aberto) return;
    void ler();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void ler(); }, 6000);
    return () => clearInterval(t);
  }, [aberto, ler]);
  useEffect(() => { fim.current?.scrollIntoView({ block: 'end' }); }, [msgs.length, aberto]);

  const escolher = async (p: Papel) => {
    setErro('');
    try { await chatApi({ acao: 'perfil', papel: p, nome, foto: profile?.photo_data ?? '' }); await carregarContatos(); }
    catch (e) { setErro((e as Error).message); }
  };
  const entrar = async () => {
    setErro('');
    try { await chatApi({ acao: 'vincular', codigo }); setCodigo(''); await carregarContatos(); }
    catch (e) { setErro((e as Error).message); }
  };
  const enviar = async () => {
    const t = texto.trim();
    if (!t || !aberto || enviando) return;
    setEnviando(true); setErro('');
    try {
      const r = await chatApi<{ mensagem: Mensagem }>({ acao: 'enviar', com: aberto.uid, texto: t });
      setMsgs((m) => [...m, r.mensagem]); setTexto('');
    } catch (e) { setErro((e as Error).message); }
    finally { setEnviando(false); }
  };

  if (papel === undefined) return <p className="py-10 text-center text-sm text-foreground-500">Carregando conversa…</p>;

  if (papel === null) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="font-heading text-2xl font-bold text-foreground-950">Conversa com o coach</h1>
        <p className="text-sm text-foreground-600">Fale direto com o seu coach, como num WhatsApp. Primeiro, diga quem você é:</p>
        <button onClick={() => void escolher('aluno')} className="w-full rounded-xl bg-primary-500 px-4 py-3 text-left text-sm font-semibold text-background-50"><i className="ri-user-line mr-2"></i>Sou aluno<span className="block text-xs font-normal opacity-90">Vou usar o código que o meu coach me passar</span></button>
        <button onClick={() => void escolher('coach')} className="w-full rounded-xl border border-primary-300 bg-background-50 px-4 py-3 text-left text-sm font-semibold text-primary-700"><i className="ri-medal-line mr-2"></i>Sou coach / personal<span className="block text-xs font-normal text-foreground-500">Recebo um código para os meus alunos entrarem</span></button>
        {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
      </div>
    );
  }

  if (papel === 'aluno' && !lista?.contatos.length) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="font-heading text-2xl font-bold text-foreground-950">Conversa com o coach</h1>
        <p className="text-sm text-foreground-600">Digite o código que o seu coach passou:</p>
        <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} maxLength={10} placeholder="Ex.: K7PQ2M" aria-label="Código do coach" className="w-full rounded-lg border border-background-200 bg-background-50 px-3 py-3 text-center text-lg font-bold tracking-widest outline-none focus:border-primary-300" />
        <button onClick={() => void entrar()} disabled={codigo.trim().length < 4} className="w-full rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-background-50 disabled:opacity-40">Entrar na conversa</button>
        {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3">
      <h1 className="font-heading text-2xl font-bold text-foreground-950">{papel === 'coach' ? 'Meus alunos' : 'Conversa com o coach'}</h1>
      {papel === 'coach' && (
        <div className="rounded-xl border border-primary-200 bg-primary-50 p-3 text-sm text-foreground-700">
          Passe este código para os seus alunos: <strong className="ml-1 text-lg tracking-widest text-primary-700">{lista?.codigo}</strong>
          <span className="block text-xs text-foreground-500">Eles abrem “Conversa”, escolhem “Sou aluno” e digitam o código.</span>
        </div>
      )}
      {papel === 'coach' && !lista?.contatos.length && <p className="text-sm text-foreground-500">Ainda não entrou nenhum aluno.</p>}
      {papel === 'coach' && !!lista?.contatos.length && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {lista.contatos.map((c) => (
            <button key={c.uid} onClick={() => setAberto(c)} className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${aberto?.uid === c.uid ? 'border-primary-500 bg-primary-100 text-primary-700' : 'border-background-200 bg-background-50 text-foreground-700'}`}>
              {c.foto ? <img src={c.foto} alt="" className="h-6 w-6 rounded-full object-cover" /> : <i className="ri-user-3-line"></i>}{c.nome}
            </button>
          ))}
        </div>
      )}
      {aberto && (
        <div className="flex h-[60vh] flex-col overflow-hidden rounded-2xl border border-background-200 bg-background-100/50">
          <div className="border-b border-background-200 bg-background-50 px-4 py-2 text-sm font-semibold text-foreground-800">{aberto.nome}</div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3" aria-live="polite">
            {!msgs.length && <p className="py-8 text-center text-sm text-foreground-400">Nenhuma mensagem ainda. Diga um oi!</p>}
            {msgs.map((m) => (
              <div key={m.id} className={`flex ${m.de === user?.id ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${m.de === user?.id ? 'bg-primary-500 text-background-50' : 'bg-background-50 text-foreground-800 border border-background-200'}`}>
                  {m.texto}
                  <span className="mt-0.5 block text-right text-[10px] opacity-70">{new Date(m.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
            <div ref={fim} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); void enviar(); }} className="flex gap-2 border-t border-background-200 bg-background-50 p-2">
            <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={1500} placeholder="Escreva uma mensagem" aria-label="Mensagem" className="min-w-0 flex-1 rounded-full border border-background-200 bg-background-50 px-4 py-2 text-sm outline-none focus:border-primary-300" />
            <button type="submit" disabled={!texto.trim() || enviando} aria-label="Enviar mensagem" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-500 text-background-50 disabled:opacity-40"><i className="ri-send-plane-fill"></i></button>
          </form>
        </div>
      )}
      {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
    </div>
  );
}
