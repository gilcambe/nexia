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

// Abertura NEXIA (assinatura da marca): logo e nome por ~1,6 s, uma vez a cada abertura do app.
// Não bloqueia toques e some sozinha; respeita quem pediu menos animação.
(() => {
  try {
    if (sessionStorage.getItem('nexia_splash')) return;
    sessionStorage.setItem('nexia_splash', '1');
  } catch { /* sem armazenamento: mostra mesmo assim */ }
  const calmo = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#0f1a14;color:#fff;pointer-events:none;transition:opacity .4s ease;font-family:system-ui,sans-serif';
  el.innerHTML = '<div style="width:72px;height:72px;border-radius:20px;background:#2f9e6a;display:flex;align-items:center;justify-content:center;font-size:38px;font-weight:800;' + (calmo ? '' : 'animation:nx-pop .7s cubic-bezier(.2,1.4,.4,1) both;') + '">N</div><div style="letter-spacing:.42em;font-weight:700;font-size:22px;padding-left:.42em;' + (calmo ? '' : 'animation:nx-pop .7s .15s cubic-bezier(.2,1.4,.4,1) both;') + '">NEXIA</div>';
  const st = document.createElement('style');
  st.textContent = '@keyframes nx-pop{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}';
  document.head.appendChild(st);
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; }, 1300);
  setTimeout(() => { el.remove(); st.remove(); }, 1750);
})();
