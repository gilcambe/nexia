// Entretenimento no cardio sem custo: abre o app de vídeo/áudio do aluno (Netflix, Prime Video,
// YouTube, Disney+, Max, Globoplay, podcasts) já na busca da série dele. Nenhuma chave, nenhum login no NEXIA.
// Ideia de "série só no cardio" (temptation bundling): o episódio vira recompensa por pedalar/correr.
export interface AppTela { id: string; nome: string; icone: string; cor: string; inicio: string; busca: (q: string) => string }

export const APPS_TELA: AppTela[] = [
  { id: 'netflix', nome: 'Netflix', icone: 'ri-netflix-fill', cor: '#E50914', inicio: 'https://www.netflix.com/browse', busca: (q) => `https://www.netflix.com/search?q=${encodeURIComponent(q)}` },
  { id: 'prime', nome: 'Prime Video', icone: 'ri-amazon-fill', cor: '#00A8E1', inicio: 'https://www.primevideo.com/', busca: (q) => `https://www.primevideo.com/search?phrase=${encodeURIComponent(q)}` },
  { id: 'youtube', nome: 'YouTube', icone: 'ri-youtube-fill', cor: '#FF0000', inicio: 'https://www.youtube.com/', busca: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` },
  { id: 'disney', nome: 'Disney+', icone: 'ri-star-smile-fill', cor: '#113CCF', inicio: 'https://www.disneyplus.com/', busca: (q) => `https://www.disneyplus.com/search?q=${encodeURIComponent(q)}` },
  { id: 'max', nome: 'Max', icone: 'ri-movie-2-fill', cor: '#7B2FF7', inicio: 'https://play.max.com/', busca: (q) => `https://play.max.com/search?q=${encodeURIComponent(q)}` },
  { id: 'globoplay', nome: 'Globoplay', icone: 'ri-tv-2-fill', cor: '#FB0234', inicio: 'https://globoplay.globo.com/', busca: (q) => `https://globoplay.globo.com/busca/?q=${encodeURIComponent(q)}` },
  { id: 'podcast', nome: 'Podcasts', icone: 'ri-mic-fill', cor: '#1DB954', inicio: 'https://open.spotify.com/genre/podcasts-web', busca: (q) => `https://open.spotify.com/search/${encodeURIComponent(q)}/podcasts` },
];

// Ideias prontas (abrem no YouTube, grátis): o aparelho de cardio vira passeio, aula ou jogo.
export const IDEIAS = [
  { id: 'esteira', titulo: 'Corrida virtual em 4K', sub: 'Paisagens do mundo para a esteira', icone: 'ri-road-map-line', busca: 'virtual run treadmill 4K scenery' },
  { id: 'bike', titulo: 'Pedal com paisagem', sub: 'Passeios de bike em primeira pessoa', icone: 'ri-riding-line', busca: 'virtual cycling 4K scenery indoor bike' },
  { id: 'aula', titulo: 'Aula de bike/HIIT guiada', sub: 'Siga o instrutor no ritmo', icone: 'ri-timer-flash-line', busca: 'aula spinning completa 30 minutos' },
  { id: 'futebol', titulo: 'Melhores momentos', sub: 'Gols e resumos da rodada', icone: 'ri-football-line', busca: 'melhores momentos gols rodada' },
  { id: 'aprender', titulo: 'Aprender algo', sub: 'Inglês, finanças, documentários curtos', icone: 'ri-lightbulb-flash-line', busca: 'documentário curto' },
  { id: 'comedia', titulo: 'Rir pedalando', sub: 'Stand-up e humor', icone: 'ri-emotion-laugh-line', busca: 'stand up comedy brasileiro' },
];

// Quanto de série cabe no cardio de hoje (episódio de ~22 min para comédias, ~45 para dramas).
export function episodiosNoCardio(min: number): string {
  if (!(min > 0)) return '';
  if (min < 20) return 'Dá para ver um resumo ou um vídeo curto.';
  if (min < 40) return `Cabe ${min >= 22 ? '1 episódio de comédia' : 'meio episódio'} (~22 min).`;
  if (min < 90) return `Cabe 1 episódio de drama (~45 min)${min >= 66 ? ' ou 3 de comédia' : ''}.`;
  return 'Dá para ver um filme inteiro.';
}

export function abrirTela(app: string, serie?: string): string {
  const a = APPS_TELA.find((x) => x.id === app) ?? APPS_TELA[0];
  const q = (serie ?? '').trim().slice(0, 80);
  return q ? a.busca(q) : a.inicio;
}

export const youtube = (q: string) => APPS_TELA[2].busca(q);

// "Opcional após força, 10–15 min" -> 15 (o maior número antes de "min").
export function minutosDoTexto(t?: string): number {
  const m = (t ?? '').match(/(\d{1,3})\s*(?:min|minutos)\b/i);
  return m ? Math.min(180, Number(m[1])) : 0;
}
