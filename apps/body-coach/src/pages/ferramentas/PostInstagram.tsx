import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/components/feature/AuthContext';
import { apagarMomento, guardarMomento, listarMomentos, MAX_MOMENTOS, tipoDoArquivo, type Momento } from '@/lib/momentos';
import { compartilharArquivo, duracaoPrevista, FRASES, gerarImagem, gerarVideo, TAMANHO, tipoDeVideo, type Formato, type Midia, type TextoPost } from '@/lib/postInstagram';
import { linkIndicacao } from '@/lib/ferramentas/cartao';

// Post/vídeo do treino para o Instagram: escolhe fotos e vídeos, o app monta com a marca discreta e abre o compartilhar.
interface Estado { titulo?: string; numeros?: { valor: string; rotulo: string }[] }

function ultimoTreino(uid?: string): Estado {
  try {
    const lista = JSON.parse(localStorage.getItem(`bc_workouts_${uid}`) || '[]') as { title?: string; done_at?: string; duration_min?: number; sets?: number; volume_kg?: number }[];
    const w = lista[lista.length - 1];
    if (!w || !w.done_at || Date.now() - new Date(w.done_at).getTime() > 2 * 86400000) return {};
    return {
      titulo: w.title,
      numeros: [
        { valor: String(w.duration_min ?? ''), rotulo: 'min' },
        { valor: String(w.sets ?? ''), rotulo: 'séries' },
        { valor: w.volume_kg ? Number(w.volume_kg).toLocaleString('pt-BR') : '', rotulo: 'kg' },
      ].filter((n) => n.valor && n.valor !== '0'),
    };
  } catch { return {}; }
}

export default function PostInstagram() {
  const { user } = useAuth();
  const local = useLocation();
  const inicial = useMemo<Estado>(() => ({ ...ultimoTreino(user?.id), ...((local.state as Estado | null) ?? {}) }), [user?.id, local.state]);
  const [momentos, setMomentos] = useState<Momento[]>([]);
  const [formato, setFormato] = useState<Formato>('story');
  const [titulo, setTitulo] = useState(inicial.titulo ?? 'Treino feito');
  const [frase, setFrase] = useState(FRASES[0]);
  const [comNumeros, setComNumeros] = useState(true);
  const [gerando, setGerando] = useState<'' | 'imagem' | 'video'>('');
  const [progresso, setProgresso] = useState(0);
  const [pronto, setPronto] = useState<{ blob: Blob; url: string; ext: string; video: boolean } | null>(null);
  const [msg, setMsg] = useState('');
  const previa = useRef<HTMLCanvasElement>(null);
  const trabalho = useRef<HTMLCanvasElement>(null);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => { void listarMomentos().then(setMomentos); }, []);
  useEffect(() => { if (inicial.titulo) setTitulo(inicial.titulo); }, [inicial.titulo]);

  const midias: Midia[] = useMemo(() => momentos.map((m) => ({ id: m.id, tipo: m.tipo, url: URL.createObjectURL(m.blob) })), [momentos]);
  useEffect(() => () => midias.forEach((m) => URL.revokeObjectURL(m.url)), [midias]);

  const texto: TextoPost = { titulo: titulo.trim(), frase: frase.trim(), numeros: comNumeros ? inicial.numeros : [] };
  const chaveTexto = JSON.stringify(texto);
  const temVideo = midias.some((m) => m.tipo === 'video');
  const podeVideo = !!tipoDeVideo();

  // Prévia ao vivo (imagem) sempre que muda algo.
  useEffect(() => {
    if (!previa.current || !midias.length) return;
    let vivo = true;
    const c = previa.current;
    void gerarImagem(midias, formato, JSON.parse(chaveTexto) as TextoPost, c).catch(() => { if (vivo) setMsg('Não consegui montar a prévia com esse arquivo.'); });
    return () => { vivo = false; };
  }, [midias, formato, chaveTexto, pronto]);

  const adicionar = async (lista: FileList | null) => {
    setMsg('');
    if (!lista?.length) return;
    let recusados = 0;
    for (const f of Array.from(lista).slice(0, MAX_MOMENTOS)) {
      if (!tipoDoArquivo(f) || f.size > 150 * 1024 * 1024) { recusados++; continue; }
      await guardarMomento(f);
    }
    setMomentos(await listarMomentos());
    if (recusados) setMsg(`${recusados} arquivo(s) ficaram de fora (só foto ou vídeo de até 150 MB).`);
    setPronto(null);
  };

  const criar = async (tipo: 'imagem' | 'video') => {
    if (!midias.length) return;
    setGerando(tipo); setProgresso(0); setMsg(''); setPronto(null);
    try {
      if (tipo === 'imagem') {
        const blob = await gerarImagem(midias, formato, texto, trabalho.current ?? undefined);
        setPronto({ blob, url: URL.createObjectURL(blob), ext: 'jpg', video: false });
      } else {
        const r = await gerarVideo(midias, formato, texto, setProgresso, trabalho.current ?? undefined);
        setPronto({ blob: r.blob, url: URL.createObjectURL(r.blob), ext: r.ext, video: true });
      }
    } catch (e) {
      setMsg((e as Error).message || 'Não consegui criar. Tente com menos arquivos.');
    }
    setGerando('');
  };

  const enviar = async () => {
    if (!pronto) return;
    const link = user ? linkIndicacao(user.id) : '';
    const r = await compartilharArquivo(pronto.blob, `treino-body-coach.${pronto.ext}`, `Treino pago no Body Coach 💪 ${link}`.trim());
    setMsg(r === 'baixado'
      ? (pronto.ext === 'webm' ? 'Vídeo salvo. Se o Instagram não aceitar este formato, use a opção de imagem.' : 'Arquivo salvo no aparelho. Abra o Instagram e escolha da galeria.')
      : '');
  };

  const seg = Math.round(duracaoPrevista(midias));

  return (
    <div className="space-y-5" data-testid="post-instagram">
      <section>
        <h2 className="text-lg font-bold text-foreground-950">1. Fotos e vídeos do treino</h2>
        <p className="text-sm text-foreground-600">Até {MAX_MOMENTOS}. Ficam só no seu celular.</p>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {midias.map((m) => (
            <div key={m.id} className="relative aspect-square overflow-hidden rounded-xl bg-black">
              {m.tipo === 'foto' ? <img src={m.url} alt="Foto do treino" className="h-full w-full object-cover" /> : <video src={m.url} muted playsInline className="h-full w-full object-cover" aria-label="Vídeo do treino" />}
              {m.tipo === 'video' && <i className="ri-play-circle-fill absolute left-1.5 top-1.5 text-2xl text-white drop-shadow"></i>}
              <button type="button" onClick={async () => { await apagarMomento(m.id); setMomentos(await listarMomentos()); setPronto(null); }} aria-label="Tirar esta mídia" className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white"><i className="ri-close-line text-xl"></i></button>
            </div>
          ))}
          {midias.length < MAX_MOMENTOS && (
            <button type="button" onClick={() => entrada.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-primary-300 bg-primary-50 text-primary-700" data-testid="adicionar-midia">
              <i className="ri-image-add-line text-3xl"></i>
              <span className="text-sm font-semibold">Adicionar</span>
            </button>
          )}
        </div>
        <input ref={entrada} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { void adicionar(e.target.files); e.target.value = ''; }} data-testid="entrada-midia" />
      </section>

      <section>
        <h2 className="text-lg font-bold text-foreground-950">2. Formato</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(Object.keys(TAMANHO) as Formato[]).map((f) => (
            <button key={f} type="button" aria-pressed={formato === f} onClick={() => { setFormato(f); setPronto(null); }} className={`rounded-xl border-2 px-3 py-3 text-base font-semibold ${formato === f ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-background-200 text-foreground-700'}`}>
              <i className={`${f === 'story' ? 'ri-smartphone-line' : 'ri-layout-grid-line'} mr-1`}></i>{TAMANHO[f].rotulo}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold text-foreground-950">3. Texto</h2>
        <label className="mt-2 block text-sm font-semibold text-foreground-700">Título
          <input value={titulo} onChange={(e) => { setTitulo(e.target.value); setPronto(null); }} maxLength={40} className="mt-1 w-full rounded-xl border-2 border-background-200 bg-background-50 px-3 py-3 text-base font-normal text-foreground-950" />
        </label>
        <label className="mt-3 block text-sm font-semibold text-foreground-700">Frase
          <input value={frase} onChange={(e) => { setFrase(e.target.value); setPronto(null); }} maxLength={60} className="mt-1 w-full rounded-xl border-2 border-background-200 bg-background-50 px-3 py-3 text-base font-normal text-foreground-950" />
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {FRASES.map((f) => <button key={f} type="button" onClick={() => { setFrase(f); setPronto(null); }} className="rounded-full border border-background-200 bg-background-100 px-3 py-2 text-sm text-foreground-800">{f}</button>)}
        </div>
        {!!inicial.numeros?.length && (
          <label className="mt-3 flex items-center gap-3 text-base text-foreground-800">
            <input type="checkbox" checked={comNumeros} onChange={(e) => { setComNumeros(e.target.checked); setPronto(null); }} className="h-6 w-6" />
            Mostrar os números do treino ({inicial.numeros.map((n) => `${n.valor} ${n.rotulo}`).join(' · ')})
          </label>
        )}
      </section>

      {midias.length > 0 && !pronto && (
        <section>
          <h2 className="text-lg font-bold text-foreground-950">Prévia</h2>
          <canvas ref={previa} className={`mx-auto mt-2 block rounded-xl shadow-lg ${formato === 'story' ? 'w-56' : 'w-64'}`} aria-label="Prévia do post" data-testid="previa-post" />
          <p className="mt-1 text-center text-sm text-foreground-500">A marca Body Coach fica pequena no canto.</p>
        </section>
      )}
      <canvas ref={trabalho} className="hidden" />

      {msg && <p role="status" className="rounded-xl bg-secondary-50 px-3 py-2 text-sm text-secondary-900">{msg}</p>}

      {pronto ? (
        <section className="space-y-3" data-testid="post-pronto">
          {pronto.video
            ? <video src={pronto.url} controls autoPlay muted loop playsInline className={`mx-auto block rounded-xl bg-black shadow-lg ${formato === 'story' ? 'w-60' : 'w-72'}`} aria-label="Seu vídeo pronto" />
            : <img src={pronto.url} alt="Seu post pronto" className={`mx-auto block rounded-xl shadow-lg ${formato === 'story' ? 'w-60' : 'w-72'}`} />}
          <button type="button" onClick={() => void enviar()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 via-orange-500 to-amber-400 py-4 text-base font-bold text-white" data-testid="compartilhar-post">
            <i className="ri-instagram-line text-xl"></i>Postar no Instagram
          </button>
          <button type="button" onClick={() => setPronto(null)} className="w-full rounded-2xl border-2 border-background-200 py-3 text-base font-semibold text-foreground-700">Mudar alguma coisa</button>
        </section>
      ) : (
        <section className="space-y-2">
          {podeVideo && (
            <button type="button" disabled={!midias.length || !!gerando} onClick={() => void criar('video')} className="w-full rounded-2xl bg-foreground-950 py-4 text-base font-bold text-background-50 disabled:opacity-40" data-testid="criar-video">
              {gerando === 'video' ? `Criando o vídeo... ${Math.round(progresso * 100)}%` : <><i className="ri-movie-2-line mr-1"></i>Criar vídeo{midias.length ? ` (${seg} s)` : ''}</>}
            </button>
          )}
          <button type="button" disabled={!midias.length || !!gerando} onClick={() => void criar('imagem')} className={`w-full rounded-2xl py-4 text-base font-bold disabled:opacity-40 ${podeVideo ? 'border-2 border-background-200 text-foreground-800' : 'bg-foreground-950 text-background-50'}`} data-testid="criar-imagem">
            {gerando === 'imagem' ? 'Criando a imagem...' : <><i className="ri-image-line mr-1"></i>Criar imagem{midias.length > 1 ? ' (colagem)' : ''}</>}
          </button>
          {!midias.length && <p className="text-center text-sm text-foreground-500">Adicione pelo menos uma foto ou vídeo.</p>}
          {gerando === 'video' && <p className="text-center text-sm text-foreground-500">Deixe esta tela aberta enquanto o vídeo é montado.</p>}
          {temVideo && !podeVideo && <p className="text-center text-sm text-foreground-500">Este navegador não monta vídeo; a imagem usa um quadro do seu vídeo.</p>}
        </section>
      )}
    </div>
  );
}
