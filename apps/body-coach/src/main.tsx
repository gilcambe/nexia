import { StrictMode } from 'react'
import './i18n'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Atualização automática: ao abrir o app, ao voltar para ele e a cada 10 minutos, vê se saiu versão nova
// (comparando o arquivo principal do index.html). Se saiu, recarrega sozinho; no meio do treino espera sair da tela.
const arquivoAtual = Array.from(document.scripts).map((sc) => sc.src).find((u) => /\/assets\/index-[^/]+\.js/.test(u));
async function haVersaoNova(): Promise<boolean> {
  if (!arquivoAtual) return false;
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}index.html?v=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return false;
    const m = /\/assets\/index-[^"'/]+\.js/.exec(await r.text());
    return !!m && !arquivoAtual.endsWith(m[0]);
  } catch { return false; }
}
async function conferirAtualizacao() {
  if (document.visibilityState !== 'visible' || /\/workout/.test(location.pathname)) return;
  if (await haVersaoNova()) {
    try { const regs = await navigator.serviceWorker?.getRegistrations(); await Promise.all((regs ?? []).map((g) => g.update())); } catch { /* sem SW */ }
    location.reload();
  }
}

if ('serviceWorker' in navigator && !import.meta.env.DEV) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL, updateViaCache: 'none' }).catch(() => {});
    void conferirAtualizacao();
    setInterval(() => { void conferirAtualizacao(); }, 10 * 60 * 1000);
  });
  document.addEventListener('visibilitychange', () => { void conferirAtualizacao(); });
}
