import { useEffect } from 'react';

// Mantém a tela acesa enquanto `ativo` (durante o treino), para não apagar com a mão suada.
// Sem suporte do navegador, simplesmente não faz nada.
export function useWakeLock(ativo: boolean) {
  useEffect(() => {
    if (!ativo || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelado = false;
    const pedir = () => {
      navigator.wakeLock.request('screen').then((l) => {
        if (cancelado) { void l.release(); return; }
        lock = l;
      }).catch(() => { /* negado ou aba oculta */ });
    };
    pedir();
    const voltou = () => { if (document.visibilityState === 'visible') pedir(); };
    document.addEventListener('visibilitychange', voltou);
    return () => {
      cancelado = true;
      document.removeEventListener('visibilitychange', voltou);
      void lock?.release();
    };
  }, [ativo]);
}
