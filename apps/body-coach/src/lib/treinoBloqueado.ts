// "Treino com a tela bloqueada": o aluno bloqueia o celular e o treino continua.
// Como funciona (grátis, sem app nativo): um áudio mudo em repetição mantém a página viva no fundo,
// e o controle de mídia da tela de bloqueio mostra o exercício e o descanso com barra de tempo.
// Assim o bip e a voz do fim do descanso tocam mesmo com a tela apagada.

const CHAVE = 'bc_treino_bloqueado';
let audio: HTMLAudioElement | null = null;
let urlMudo = '';

export function bloqueadoLigado(): boolean {
  try { return localStorage.getItem(CHAVE) === '1'; } catch { return false; }
}

export const bloqueadoAtivo = () => !!audio && !audio.paused;

// WAV de 1 s em silêncio (8 kHz, 8 bits), gerado na hora: nada para baixar.
function wavMudo(): string {
  if (urlMudo) return urlMudo;
  const n = 8000;
  const b = new ArrayBuffer(44 + n);
  const v = new DataView(b);
  const txt = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  txt(0, 'RIFF'); v.setUint32(4, 36 + n, true); txt(8, 'WAVE'); txt(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); txt(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  urlMudo = URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
  return urlMudo;
}

// Precisa ser chamado dentro de um toque (o navegador só deixa tocar áudio assim).
export async function ligarBloqueado(): Promise<boolean> {
  try { localStorage.setItem(CHAVE, '1'); } catch { /* sem armazenamento */ }
  try {
    audio = audio ?? new Audio(wavMudo());
    audio.loop = true;
    audio.volume = 0.01;
    await audio.play();
    const ms = navigator.mediaSession;
    if (ms) {
      ms.playbackState = 'playing';
      // "pausar" na tela de bloqueio não deve parar o treino sem querer: só volta a tocar.
      try { ms.setActionHandler('pause', () => { void audio?.play(); }); } catch { /* sem suporte */ }
    }
    return true;
  } catch { return false; }
}

export function desligarBloqueado(lembrar = true): void {
  if (lembrar) { try { localStorage.setItem(CHAVE, '0'); } catch { /* ok */ } }
  try { audio?.pause(); } catch { /* ok */ }
  try { if (navigator.mediaSession) { navigator.mediaSession.metadata = null; navigator.mediaSession.playbackState = 'none'; } } catch { /* ok */ }
}

// Mostra na tela de bloqueio o que está acontecendo. Com descanso, aparece a barra de tempo.
export function mostrarNaTelaBloqueada(titulo: string, linha: string, descanso?: { total: number; passou: number }): void {
  if (!bloqueadoAtivo() || !navigator.mediaSession || typeof MediaMetadata === 'undefined') return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: titulo, artist: linha, album: 'Body Coach',
      artwork: [{ src: '/body-coach/icon-512.png', sizes: '512x512', type: 'image/png' }],
    });
    if (descanso && descanso.total > 0) {
      navigator.mediaSession.setPositionState?.({ duration: descanso.total, position: Math.min(descanso.total, Math.max(0, descanso.passou)), playbackRate: 1 });
    } else {
      navigator.mediaSession.setPositionState?.();
    }
  } catch { /* navegador sem suporte: segue sem */ }
}
