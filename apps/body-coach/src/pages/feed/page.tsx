import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apagarPost, curtir, postar, verFeed, type Post } from '@/lib/comunidade';
import { compressImageToDataUrl } from '@/lib/userData';

const quando = (t: number) => {
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${Math.round(min / 60)} h`;
  return new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

// Feed da equipe: só o coach e os alunos dele veem. Fotos de treino, recados do coach, curtidas.
export default function Feed() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [mais, setMais] = useState(false);
  const [souCoach, setSouCoach] = useState(false);
  const [erro, setErro] = useState('');
  const [texto, setTexto] = useState('');
  const [imagem, setImagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  const carregar = useCallback(() => verFeed().then((r) => { setPosts(r.posts); setMais(r.mais); setSouCoach(r.souCoach); setErro(''); }).catch((e: Error) => { setErro(e.message); setPosts([]); }), []);
  useEffect(() => { void carregar(); }, [carregar]);

  const enviar = async () => {
    setEnviando(true); setErro('');
    try { await postar(texto.trim(), imagem || undefined); setTexto(''); setImagem(''); await carregar(); }
    catch (e) { setErro((e as Error).message); } finally { setEnviando(false); }
  };
  const foto = async (f?: File) => {
    if (!f) return;
    try { setImagem(await compressImageToDataUrl(f, 1080, 300000)); } catch (e) { setErro((e as Error).message); }
  };
  const alternar = async (p: Post) => {
    setPosts((l) => (l ?? []).map((x) => (x.id === p.id ? { ...x, curti: !x.curti, curtidas: x.curtidas + (x.curti ? -1 : 1) } : x)));
    try { const r = await curtir(p.id); setPosts((l) => (l ?? []).map((x) => (x.id === p.id ? { ...x, ...r } : x))); } catch { void carregar(); }
  };

  if (erro && posts && posts.length === 0 && /equipe/.test(erro)) {
    return (
      <div className="rounded-2xl border border-background-200 bg-background-50 p-5">
        <h1 className="font-heading text-xl font-bold text-foreground-950">Feed da equipe</h1>
        <p className="mt-2 text-sm text-foreground-600">{erro}</p>
        <Link to="/chat" className="mt-3 inline-block rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-background-50">Entrar com o código</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground-950">Feed da equipe</h1>
        <p className="mt-1 text-sm text-foreground-600">Só o seu coach e os colegas da equipe veem.</p>
      </header>

      <div className="rounded-2xl border border-background-200 bg-background-50 p-3" data-testid="feed-novo">
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={500} rows={2} placeholder={souCoach ? 'Recado para a equipe (todos recebem um aviso)' : 'Conte como foi o treino...'} aria-label="Texto do post" className="w-full resize-none rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-sm outline-none focus:border-primary-300" />
        {imagem && (
          <div className="relative mt-2">
            <img src={imagem} alt="Foto escolhida" className="max-h-64 w-full rounded-xl object-cover" />
            <button type="button" onClick={() => setImagem('')} aria-label="Tirar foto" className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white"><i className="ri-close-line"></i></button>
          </div>
        )}
        <div className="mt-2 flex items-center gap-2">
          <button type="button" onClick={() => arquivo.current?.click()} className="rounded-lg border border-background-200 px-3 py-2 text-xs font-semibold text-foreground-700"><i className="ri-image-add-line mr-1"></i>Foto</button>
          <input ref={arquivo} type="file" accept="image/*" className="hidden" onChange={(e) => { void foto(e.target.files?.[0]); e.target.value = ''; }} data-testid="feed-foto" />
          <button type="button" disabled={enviando || (!texto.trim() && !imagem)} onClick={() => void enviar()} className="ml-auto rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-background-50 disabled:opacity-50 dark:text-foreground-950">{enviando ? 'Postando...' : 'Postar'}</button>
        </div>
      </div>
      {erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}
      {posts == null && <p className="text-center text-sm text-foreground-500"><i className="ri-loader-4-line mr-2 animate-spin"></i>Carregando...</p>}
      {posts?.length === 0 && !erro && <p className="text-center text-sm text-foreground-500">Ninguém postou ainda. Seja o primeiro! 💪</p>}

      <ul className="space-y-3">
        {posts?.map((p) => (
          <li key={p.id} className="rounded-2xl border border-background-200 bg-background-50 p-3" data-testid="feed-post">
            <div className="flex items-center gap-2">
              {p.foto ? <img src={p.foto} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-primary-700"><i className="ri-user-3-line"></i></span>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground-950">{p.nome}{p.coach && <span className="ml-1 rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-bold text-primary-700">COACH</span>}</p>
                <p className="text-[11px] text-foreground-500">{quando(p.em)}</p>
              </div>
              {(p.meu || souCoach) && <button type="button" onClick={() => { if (window.confirm('Apagar este post?')) void apagarPost(p.id).then(carregar); }} aria-label="Apagar post" className="p-1 text-foreground-400"><i className="ri-delete-bin-line"></i></button>}
            </div>
            {p.texto && <p className="mt-2 whitespace-pre-line text-sm text-foreground-800">{p.texto}</p>}
            {p.imagem && <img src={p.imagem} alt={`Foto de ${p.nome}`} loading="lazy" className="mt-2 w-full rounded-xl object-cover" />}
            <button type="button" onClick={() => void alternar(p)} aria-pressed={p.curti} aria-label={p.curti ? 'Descurtir' : 'Curtir'} className={`mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${p.curti ? 'bg-red-50 text-red-600' : 'text-foreground-500'}`}>
              {p.curti ? '❤️' : '🤍'} {p.curtidas > 0 ? p.curtidas : ''}
            </button>
          </li>
        ))}
      </ul>
      {mais && posts && <button type="button" onClick={() => void verFeed(posts[posts.length - 1].em).then((r) => { setPosts([...posts, ...r.posts]); setMais(r.mais); })} className="w-full rounded-xl border border-background-200 px-4 py-2.5 text-sm font-semibold text-foreground-700">Ver mais</button>}
    </div>
  );
}
