import { useState } from 'react';
import { useAuth } from '@/components/feature/AuthContext';
import { setUserDoc } from '@/lib/userData';
import { APPS_MUSICA, ESTILOS, buscaTreino, linkPlaylist } from '@/lib/musica';

// Botão "Música" do treino: abre o app de música escolhido por cima do NEXIA; a música continua
// tocando enquanto o aluno volta para registrar as séries.
export default function MusicaTreino({ compacto = false }: { compacto?: boolean }) {
  const { user, profile, refreshProfile } = useAuth();
  const pref = profile?.musica ?? {};
  const [aberto, setAberto] = useState(false);
  const [app, setApp] = useState(pref.app ?? 'spotify');
  const [estilo, setEstilo] = useState(pref.estilo ?? 'Academia');
  const [link, setLink] = useState(pref.link ?? '');
  const [erro, setErro] = useState<string | null>(null);

  const salvar = (mais: { app?: string; estilo?: string; link?: string }) => {
    if (!user) return;
    void setUserDoc(user.id, 'profile', 'main', { musica: { app, estilo, link: pref.link ?? '', ...mais } }, true).then(refreshProfile).catch(() => {});
  };
  const abrir = (url: string) => { window.open(url, '_blank', 'noopener'); setAberto(false); };

  const tocarMinha = () => {
    const l = linkPlaylist(link);
    if (!l) { setErro('Cole o link de compartilhar da playlist (Spotify, Deezer, YouTube Music ou Apple Music).'); return; }
    setErro(null);
    setApp(l.app);
    salvar({ link: l.url, app: l.app });
    abrir(l.url);
  };

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className={`inline-flex items-center gap-1.5 rounded-full border border-background-200 bg-background-50 font-semibold text-foreground-700 ${compacto ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'}`} data-testid="musica-botao">
        <i className="ri-music-2-line text-primary-500"></i>Música
      </button>
      {aberto && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setAberto(false)} role="dialog" aria-modal="true" aria-label="Música no treino">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-background-50 p-4 pb-8 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-lg font-bold text-foreground-950">Música no treino</h3>
              <button type="button" onClick={() => setAberto(false)} className="rounded-full p-2 text-foreground-500" aria-label="Fechar"><i className="ri-close-line text-xl"></i></button>
            </div>
            <p className="text-xs text-foreground-500">O app de música abre por cima. Dê play e volte para o NEXIA: a música continua.</p>

            <p className="mt-3 text-sm font-semibold text-foreground-800">Seu app</p>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {APPS_MUSICA.map((a) => (
                <button key={a.id} type="button" onClick={() => { setApp(a.id); salvar({ app: a.id }); }} aria-pressed={app === a.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${app === a.id ? 'border-primary-500 bg-primary-50 text-foreground-950' : 'border-background-200 text-foreground-700'}`}>
                  <i className={`${a.icone} text-lg`} style={{ color: a.cor }}></i>{a.nome}
                </button>
              ))}
            </div>

            {pref.link && (
              <button type="button" onClick={() => abrir(pref.link as string)} className="mt-3 w-full rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white" data-testid="musica-minha">
                <i className="ri-play-fill mr-1"></i>Tocar minha playlist
              </button>
            )}

            <p className="mt-4 text-sm font-semibold text-foreground-800">Playlists de treino</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {ESTILOS.map((e) => (
                <button key={e} type="button" onClick={() => setEstilo(e)} aria-pressed={estilo === e} className={`rounded-full border px-3 py-1 text-xs font-medium ${estilo === e ? 'border-primary-500 bg-primary-100 text-primary-700' : 'border-background-200 text-foreground-600'}`}>{e}</button>
              ))}
            </div>
            <button type="button" onClick={() => { salvar({ estilo }); abrir(buscaTreino(app, estilo)); }} className="mt-2 w-full rounded-xl border border-primary-500 px-4 py-2.5 text-sm font-semibold text-primary-700" data-testid="musica-buscar">
              Abrir playlists de {estilo.toLowerCase()} no {APPS_MUSICA.find((a) => a.id === app)?.nome}
            </button>

            <p className="mt-4 text-sm font-semibold text-foreground-800">{pref.link ? 'Trocar minha playlist' : 'Usar minha playlist'}</p>
            <p className="text-[11px] text-foreground-500">No app de música: playlist &gt; Compartilhar &gt; Copiar link. Cole aqui.</p>
            <div className="mt-1.5 flex gap-2">
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://open.spotify.com/playlist/..." className="min-w-0 flex-1 rounded-lg border border-background-200 bg-background-50 px-3 py-2 text-sm" aria-label="Link da playlist" />
              <button type="button" onClick={tocarMinha} className="rounded-lg bg-background-100 px-3 py-2 text-sm font-semibold text-foreground-800">Salvar e tocar</button>
            </div>
            {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}
          </div>
        </div>
      )}
    </>
  );
}
