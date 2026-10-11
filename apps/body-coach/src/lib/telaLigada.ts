import { useEffect } from 'react';

// Mantém a tela acesa durante o treino (Wake Lock, grátis no Chrome e no iPhone com iOS 16.4+):
// o descanso conta, o bip toca e o aluno não precisa desbloquear o celular a cada série.
type Trava = { release: () => Promise<void> };
export function useTelaLigada(ativo: boolean) {
  useEffect(() => {
    if (!ativo) return;
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Trava> } }).wakeLock;
    if (!wl) return;
    let trava: Trava | null = null;
    let vivo = true;
    const pedir = () => { if (document.visibilityState === 'visible') wl.request('screen').then((t) => { if (vivo) trava = t; else void t.release(); }).catch(() => undefined); };
    pedir();
    document.addEventListener('visibilitychange', pedir); // o navegador solta a trava quando a tela sai do app
    return () => { vivo = false; document.removeEventListener('visibilitychange', pedir); void trava?.release().catch(() => undefined); };
  }, [ativo]);
}
