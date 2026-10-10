import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/components/feature/AuthContext';
import { chatApi, type Contato, type Mensagem } from '@/lib/chat';
import DesafioCard from './Desafio';
import GravadorVideo from '@/components/feature/GravadorVideo';

function BolhaVideo({ id }: { id: string }) {
  const [src, setSrc] = useState('');
  const [erro, setErro] = useState('');
  const abrir = async () => {
    try { setSrc((await chatApi<{ video: string }>({ acao: 'video_ver', id })).video); } catch (e) { setErro((e as Error).message); }
  };
  if (src) return <video src={src} controls autoPlay playsInline className="mb-1 w-56 rounded-lg bg-black" aria-label="Vídeo recebido" />;
  return <button onClick={() => void abrir()} className="mb-1 flex items-center gap-1 rounded-lg bg-black/20 px-3 py-2 text-xs font-semibold"><i className="ri-play-circle-line text-base"></i>{erro || 'Ver vídeo'}</button>;
}

type Papel = 'coach' | 'aluno';
interface Resumo { aluno?: string; treinos: number; minutos: number; volumeKg: number; ultimoTreino: string | null; titulos: string[]; pesoAtual: number | null; variacaoPeso: number | null }

function ResumoSemana({ uid }: { uid: string }) {
  const [r, setR] = useState<Resumo | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  useEffect(() => { setR(null); setErro(''); }, [uid]);
  const ver = async () => {
    setCarregando(true); setErro('');
    try { setR((await chatApi<{ resumo: Resumo }>({ acao: 'resumo', com: uid })).resumo); }
    catch (e) { setErro((e as Error).message); }
    finally { setCarregando(false); }
  };
  if (!r) return <div><button onClick={() => void ver()} disabled={carregando} className="text-sm font-semibold text-primary-600 hover:underline"><i className="ri-bar-chart-2-line mr-1"></i>{carregando ? 'Carregando…' : 'Ver resumo da semana'}</button>{erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}</div>;
  const v = r.variacaoPeso;
  return (
    <div className="rounded-xl border border-primary-200 bg-primary-50 p-3 text-sm text-foreground-800">
      <p className="font-semibold text-primary-700">Semana de {r.aluno ?? 'aluno'}</p>
      <ul className="mt-1 space-y-0.5 text-xs">
        <li>{r.treinos === 0 ? 'Nenhum treino nos últimos 7 dias.' : `${r.treinos} treino(s), ${r.minutos} min, ${r.volumeKg.toLocaleString('pt-BR')} kg de volume.`}</li>
        {r.titulos.length > 0 && <li>Treinos: {r.titulos.join(' · ')}</li>}
        <li>{r.pesoAtual != null ? `Peso: ${r.pesoAtual.toString().replace('.', ',')} kg${v != null ? ` (${v > 0 ? '+' : ''}${v.toString().replace('.', ',')} kg na semana)` : ''}` : 'Sem peso registrado.'}</li>
      </ul>
      <button onClick={() => setR(null)} className="mt-2 text-xs text-foreground-500 hover:underline">Fechar</button>
    </div>
  );
}
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
  const [gravando, setGravando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  const nome = profile?.nickname || profile?.full_name || user?.email?.split('@')[0] || 'Aluno';

  const carregarContatos = useCallback(async () => {
    try {
      const r = await chatApi<Contatos>({ acao: 'contatos' });
      setLista(r); setPapel(r.papel);
      if (r.papel === 'aluno' && r.contatos[0]) setAberto((a) => a ?? r.contatos[0]);
    } catch (e) {
      const m = (e as Error).message;
      if (/escolha se você/i.test(m)) setPapel(null); else { setPapel(null); setErro(m); }
    }
  }, []);
  useEffect(() => {
    if (!user) return;
    let vivo = true;
    (async () => {
      // Link de convite do coach: entra na equipe sozinho (cria o perfil de aluno se for a primeira vez).
      let codigoConvite = '';
      try { codigoConvite = localStorage.getItem('bc_convite') ?? ''; } catch { /* sem armazenamento */ }
      if (codigoConvite) {
        try {
          try { await chatApi({ acao: 'contatos' }); }
          catch (e) { if (/escolha se você/i.test((e as Error).message)) await chatApi({ acao: 'perfil', papel: 'aluno', nome, foto: profile?.photo_data ?? '' }); else throw e; }
          await chatApi({ acao: 'vincular', codigo: codigoConvite });
        } catch (e) { if (vivo) setErro((e as Error).message); }
        try { localStorage.removeItem('bc_convite'); } catch { /* sem armazenamento */ }
      }
      if (vivo) await carregarContatos();
    })();
    return () => { vivo = false; };
  }, [user, carregarContatos]); // eslint-disable-line react-hooks/exhaustive-deps

  // Conferência barata: só pede o que chegou depois da última mensagem (poupa a cota do banco grátis).
  const ultimaEm = useRef(0);
  const ler = useCallback(async (completo = false) => {
    if (!aberto) return;
    try {
      const depois = completo ? 0 : ultimaEm.current;
      const r = (await chatApi<{ mensagens: Mensagem[] }>({ acao: 'ler', com: aberto.uid, ...(depois ? { depois } : {}) })).mensagens;
      if (!depois) setMsgs(r);
      else if (r.length) setMsgs((m) => [...m, ...r.filter((x) => !m.some((y) => y.id === x.id))]);
    } catch { /* tenta de novo no próximo ciclo */ }
  }, [aberto]);
  useEffect(() => { ultimaEm.current = msgs.length ? msgs[msgs.length - 1].em : 0; }, [msgs]);
  useEffect(() => {
    if (!aberto) return;
    ultimaEm.current = 0; setMsgs([]);
    void ler(true);
    const t = setInterval(() => { if (document.visibilityState === 'visible') void ler(); }, 8000);
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
          <Link to="/coach/evolucao" className="mt-2 inline-flex items-center gap-1 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-semibold text-background-50 dark:text-foreground-950"><i className="ri-line-chart-line"></i>Evolução dos alunos</Link>
        </div>
      )}
      <DesafioCard papel={papel} />
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
          {papel === 'coach' && <div className="border-b border-background-200 bg-background-50 px-4 py-2"><ResumoSemana uid={aberto.uid} /></div>}
          <div className="flex-1 space-y-2 overflow-y-auto p-3" aria-live="polite">
            {!msgs.length && <p className="py-8 text-center text-sm text-foreground-400">Nenhuma mensagem ainda. Diga um oi!</p>}
            {msgs.map((m) => (
              <div key={m.id} className={`flex ${m.de === user?.id ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${m.de === user?.id ? 'bg-primary-500 text-background-50' : 'bg-background-50 text-foreground-800 border border-background-200'}`}>
                  {m.video && <BolhaVideo id={m.video} />}
                  {m.ref && (
                    <Link to={papel === 'coach' ? `/coach/evolucao/${aberto.uid}/relatorio/${m.ref.entrada}` : `/evolution/relatorio/${m.ref.entrada}`} className="mb-1 block text-[11px] font-semibold underline opacity-80">
                      💬 Comentário na avaliação{m.ref.data ? ` de ${m.ref.data.split('-').reverse().join('/')}` : ''}
                    </Link>
                  )}
                  {m.texto}
                  <span className="mt-0.5 block text-right text-[10px] opacity-70">{new Date(m.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
            <div ref={fim} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); void enviar(); }} className="flex gap-2 border-t border-background-200 bg-background-50 p-2">
            <button type="button" onClick={() => setGravando(true)} aria-label="Gravar e enviar vídeo" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-background-200 text-foreground-600"><i className="ri-video-add-line"></i></button>
            <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={1500} placeholder="Escreva uma mensagem" aria-label="Mensagem" className="min-w-0 flex-1 rounded-full border border-background-200 bg-background-50 px-4 py-2 text-sm outline-none focus:border-primary-300" />
            <button type="submit" disabled={!texto.trim() || enviando} aria-label="Enviar mensagem" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-500 text-background-50 disabled:opacity-40"><i className="ri-send-plane-fill"></i></button>
          </form>
        </div>
      )}
      {gravando && aberto && (
        <GravadorVideo
          titulo={`Vídeo para ${aberto.nome}`}
          onFechar={() => setGravando(false)}
          onEnviar={async (v) => { const r = await chatApi<{ mensagem: Mensagem }>({ acao: 'video_enviar', com: aberto.uid, video: v }); setMsgs((m) => [...m, r.mensagem]); }}
        />
      )}
      {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
    </div>
  );
}
