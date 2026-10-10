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

// Abertura NEXIA (assinatura da marca): fundo preto, o "N" é desenhado em traço prateado, as letras de NEXIA
// surgem do desfoque e um brilho de metal passa por cima. ~1,6 s, uma vez a cada abertura do app.
// Toque para pular; quem pediu menos animação vê a marca parada por meio segundo.
(() => {
  try {
    if (sessionStorage.getItem('nexia_splash')) return;
    sessionStorage.setItem('nexia_splash', '1');
  } catch { /* sem armazenamento: mostra mesmo assim */ }
  const calmo = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const prata = 'linear-gradient(100deg,#6b6f76 0%,#c9ccd1 22%,#ffffff 32%,#9aa0a6 44%,#e6e8eb 58%,#7d828a 72%,#f4f5f6 86%,#8c9198 100%)';
  const el = document.createElement('div');
  el.id = 'nexia-abertura';
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:radial-gradient(ellipse at 50% 45%,#16181b 0%,#050506 55%,#000 100%);cursor:pointer;transition:opacity .35s ease,transform .35s ease;font-family:system-ui,-apple-system,"Segoe UI",sans-serif';
  const letras = 'NEXIA'.split('').map((l, i) => `<span class="nx-l" style="animation-delay:${0.45 + i * 0.07}s">${l}</span>`).join('');
  el.innerHTML =
    '<svg class="nx-n" width="84" height="84" viewBox="0 0 84 84" fill="none">' +
    '<defs><linearGradient id="nx-prata" x1="0" y1="0" x2="84" y2="84" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#f4f5f6"/><stop offset=".35" stop-color="#9aa0a6"/><stop offset=".6" stop-color="#ffffff"/><stop offset="1" stop-color="#6b6f76"/></linearGradient></defs>' +
    '<rect x="3" y="3" width="78" height="78" rx="22" stroke="url(#nx-prata)" stroke-width="2" class="nx-caixa"/>' +
    '<path d="M27 60V24l30 36V24" stroke="url(#nx-prata)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" class="nx-traco"/>' +
    '</svg>' +
    `<div class="nx-nome">${letras}</div><div class="nx-linha"></div>`;
  const st = document.createElement('style');
  st.textContent = calmo
    ? `.nx-nome{font-weight:800;font-size:26px;letter-spacing:.38em;padding-left:.38em;background:${prata};-webkit-background-clip:text;background-clip:text;color:transparent}.nx-linha{display:none}`
    : `.nx-traco{stroke-dasharray:130;stroke-dashoffset:130;animation:nx-desenha .6s .05s cubic-bezier(.6,0,.2,1) forwards}` +
      `.nx-caixa{stroke-dasharray:300;stroke-dashoffset:300;opacity:.55;animation:nx-desenha .7s .15s ease-out forwards}` +
      `.nx-n{animation:nx-chega .6s cubic-bezier(.2,1,.3,1) both;filter:drop-shadow(0 0 14px rgba(220,225,230,.18))}` +
      `.nx-nome{display:flex;font-weight:800;font-size:26px;letter-spacing:.38em;padding-left:.38em}` +
      `.nx-l{display:inline-block;background:${prata};background-size:260% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;opacity:0;animation:nx-letra .45s cubic-bezier(.2,1,.3,1) forwards,nx-brilho 1s .9s ease-in-out forwards}` +
      `.nx-linha{height:1px;width:0;background:linear-gradient(90deg,transparent,#d9dce0,transparent);animation:nx-linha .6s .8s ease-out forwards}` +
      `@keyframes nx-desenha{to{stroke-dashoffset:0}}` +
      `@keyframes nx-chega{from{opacity:0;transform:scale(.82)}to{opacity:1;transform:scale(1)}}` +
      `@keyframes nx-letra{from{opacity:0;transform:translateY(10px);filter:blur(6px)}to{opacity:1;transform:none;filter:blur(0)}}` +
      `@keyframes nx-brilho{from{background-position:100% 0}to{background-position:0 0}}` +
      `@keyframes nx-linha{to{width:120px}}`;
  document.head.appendChild(st);
  document.body.appendChild(el);
  let saiu = false;
  const sair = () => {
    if (saiu) return;
    saiu = true;
    el.style.opacity = '0';
    el.style.transform = 'scale(1.04)';
    setTimeout(() => { el.remove(); st.remove(); }, 360);
  };
  el.addEventListener('click', sair);
  setTimeout(sair, calmo ? 500 : 1650);
})();
