// Música no treino sem custo: abre o app de música do aluno (Spotify, Deezer, YouTube Music, Apple Music)
// na playlist dele ou numa busca de playlists de treino. Nenhuma chave, nenhum login no NEXIA.
export const APPS_MUSICA = [
  { id: 'spotify', nome: 'Spotify', icone: 'ri-spotify-fill', cor: '#1DB954', busca: (q: string) => `https://open.spotify.com/search/${encodeURIComponent(q)}/playlists` },
  { id: 'deezer', nome: 'Deezer', icone: 'ri-music-2-fill', cor: '#A238FF', busca: (q: string) => `https://www.deezer.com/br/search/${encodeURIComponent(q)}/playlist` },
  { id: 'youtube', nome: 'YouTube Music', icone: 'ri-youtube-fill', cor: '#FF0000', busca: (q: string) => `https://music.youtube.com/search?q=${encodeURIComponent(q)}` },
  { id: 'apple', nome: 'Apple Music', icone: 'ri-apple-fill', cor: '#FA2D48', busca: (q: string) => `https://music.apple.com/br/search?term=${encodeURIComponent(q)}` },
] as const;

export const ESTILOS = ['Academia', 'Funk', 'Eletrônica', 'Rock', 'Hip hop', 'Sertanejo', 'Pagode', 'Gospel', 'Pop', 'Corrida'] as const;

const DOMINIOS = ['open.spotify.com', 'spotify.link', 'deezer.com', 'www.deezer.com', 'link.deezer.com', 'deezer.page.link', 'music.youtube.com', 'www.youtube.com', 'youtube.com', 'youtu.be', 'music.apple.com'];

// Aceita só link https de um app de música conhecido; devolve o app reconhecido.
export function linkPlaylist(texto: string): { url: string; app: string } | null {
  const m = texto.match(/https:\/\/[^\s]+/);
  if (!m) return null;
  try {
    const u = new URL(m[0]);
    if (!DOMINIOS.includes(u.hostname)) return null;
    const app = /spotify/.test(u.hostname) ? 'spotify' : /deezer/.test(u.hostname) ? 'deezer' : /apple/.test(u.hostname) ? 'apple' : 'youtube';
    return { url: u.toString(), app };
  } catch { return null; }
}

export function buscaTreino(app: string, estilo: string): string {
  const a = APPS_MUSICA.find((x) => x.id === app) ?? APPS_MUSICA[0];
  return a.busca(estilo === 'Academia' ? 'treino academia' : `treino ${estilo.toLowerCase()}`);
}
