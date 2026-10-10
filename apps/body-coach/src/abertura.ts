// Abertura NEXIA (assinatura da marca, só nos apps): ~3 s, fundo preto, no estilo de abertura de TV.
// 1) faíscas prateadas convergem para o centro; 2) um feixe de luz horizontal acende e "abre" o N metálico,
//    com onda de choque; 3) as letras NEXIA chegam de longe e se juntam; 4) um brilho de metal varre a marca
//    e uma estrela de luz pisca na ponta do N; 5) tudo se apaga num zoom suave. Toque para pular.
// Quem pediu menos animação vê a marca parada por 0,8 s.
export function mostrarAbertura(): void {
  try {
    if (sessionStorage.getItem('nexia_splash')) return;
    sessionStorage.setItem('nexia_splash', '1');
  } catch { /* sem armazenamento: mostra mesmo assim */ }
  const calmo = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const DURACAO = calmo ? 800 : 3000;
  const prata = 'linear-gradient(100deg,#5d6168 0%,#c9ccd1 20%,#ffffff 30%,#8f959c 42%,#eceef0 56%,#71767e 70%,#f7f8f9 84%,#8a8f96 100%)';

  const el = document.createElement('div');
  el.id = 'nexia-abertura';
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = 'position:fixed;inset:0;z-index:99999;overflow:hidden;background:#000;cursor:pointer;transition:opacity .45s ease,transform .45s ease;font-family:system-ui,-apple-system,"Segoe UI",sans-serif';

  // faíscas: começam espalhadas e voam para o centro
  let faiscas = '';
  if (!calmo) {
    for (let i = 0; i < 28; i++) {
      const ang = (i / 28) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 38 + Math.random() * 30; // em vmax
      const x = Math.cos(ang) * dist, y = Math.sin(ang) * dist;
      const tam = 1.5 + Math.random() * 2.5;
      faiscas += `<i class="nx-f" style="--x:${x.toFixed(1)}vmax;--y:${y.toFixed(1)}vmax;width:${tam}px;height:${tam}px;animation-delay:${(Math.random() * 0.25).toFixed(2)}s"></i>`;
    }
  }
  const letras = 'NEXIA'.split('').map((l, i) => `<span class="nx-l" style="--i:${i - 2}">${l}</span>`).join('');
  el.innerHTML =
    `<div class="nx-fundo"></div>${faiscas}<div class="nx-feixe"></div><div class="nx-onda"></div>` +
    '<div class="nx-centro">' +
    '<div class="nx-marca"><svg class="nx-n" width="104" height="104" viewBox="0 0 104 104" fill="none">' +
    '<defs><linearGradient id="nx-g" x1="0" y1="0" x2="104" y2="104" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffffff"/><stop offset=".3" stop-color="#9aa0a6"/><stop offset=".55" stop-color="#f4f5f6"/><stop offset=".8" stop-color="#6b7078"/><stop offset="1" stop-color="#d9dce0"/></linearGradient>' +
    '<linearGradient id="nx-c" x1="0" y1="0" x2="0" y2="104" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#1d2024"/><stop offset="1" stop-color="#050506"/></linearGradient></defs>' +
    '<rect x="2" y="2" width="100" height="100" rx="28" fill="url(#nx-c)" stroke="url(#nx-g)" stroke-width="2.5"/>' +
    '<path d="M33 74V30l38 44V30" stroke="url(#nx-g)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" class="nx-traco"/>' +
    '</svg><i class="nx-estrela"></i></div>' +
    `<div class="nx-nome">${letras}</div><div class="nx-sub">BODY COACH</div>` +
    '</div>';

  const st = document.createElement('style');
  st.textContent = calmo
    ? `.nx-centro{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px}.nx-feixe,.nx-onda,.nx-fundo,.nx-estrela{display:none}` +
      `.nx-nome{font-weight:800;font-size:30px;letter-spacing:.42em;padding-left:.42em;background:${prata};-webkit-background-clip:text;background-clip:text;color:transparent}.nx-sub{font-size:11px;letter-spacing:.5em;color:#8a8f96;padding-left:.5em}`
    : `.nx-fundo{position:absolute;inset:-20%;background:radial-gradient(circle at 50% 47%,rgba(190,198,208,.16) 0%,rgba(20,22,25,.0) 38%);opacity:0;animation:nx-aparece .9s .55s ease-out forwards}` +
      `.nx-f{position:absolute;left:50%;top:47%;border-radius:50%;background:#e9ecef;box-shadow:0 0 8px 2px rgba(230,235,240,.7);transform:translate(var(--x),var(--y));opacity:0;animation:nx-voa .7s cubic-bezier(.7,0,.9,.4) forwards}` +
      `.nx-feixe{position:absolute;left:50%;top:47%;width:0;height:2px;transform:translate(-50%,-50%);background:linear-gradient(90deg,transparent,#fff 45%,#fff 55%,transparent);box-shadow:0 0 18px 4px rgba(255,255,255,.55),0 0 60px 10px rgba(180,190,200,.25);opacity:0;animation:nx-feixe 1s .5s cubic-bezier(.2,.8,.2,1) forwards}` +
      `.nx-onda{position:absolute;left:50%;top:47%;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;border:1.5px solid rgba(235,238,242,.7);opacity:0;animation:nx-onda .9s .75s ease-out forwards}` +
      `.nx-centro{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding-bottom:6vh}` +
      `.nx-marca{position:relative;opacity:0;transform:scale(1.6);filter:blur(10px) brightness(2.2);animation:nx-marca .75s .7s cubic-bezier(.16,1,.3,1) forwards}` +
      `.nx-n{display:block;filter:drop-shadow(0 0 22px rgba(220,226,232,.28))}` +
      `.nx-traco{stroke-dasharray:160;stroke-dashoffset:160;animation:nx-traca .65s .8s cubic-bezier(.6,0,.2,1) forwards}` +
      `.nx-estrela{position:absolute;right:20px;top:24px;width:4px;height:4px;border-radius:50%;background:#fff;opacity:0;box-shadow:0 0 10px 4px #fff,0 0 30px 10px rgba(255,255,255,.5);animation:nx-estrela .6s 1.95s ease-out forwards}` +
      `.nx-estrela::before,.nx-estrela::after{content:"";position:absolute;left:50%;top:50%;width:70px;height:1.5px;background:linear-gradient(90deg,transparent,#fff,transparent);transform:translate(-50%,-50%)}.nx-estrela::after{transform:translate(-50%,-50%) rotate(90deg);width:40px}` +
      `.nx-nome{display:flex;font-weight:800;font-size:32px;letter-spacing:.38em;padding-left:.38em}` +
      `.nx-l{display:inline-block;background:${prata};background-size:300% 100%;background-position:100% 0;-webkit-background-clip:text;background-clip:text;color:transparent;opacity:0;transform:translateX(calc(var(--i) * 46px)) scale(1.3);filter:blur(8px);animation:nx-letra .7s 1.1s cubic-bezier(.16,1,.3,1) forwards,nx-brilho 1.1s 1.7s ease-in-out forwards}` +
      `.nx-sub{font-size:11px;font-weight:600;letter-spacing:.6em;padding-left:.6em;color:#8a8f96;opacity:0;animation:nx-sub .6s 1.6s ease-out forwards}` +
      `@keyframes nx-voa{0%{opacity:0}20%{opacity:1}100%{opacity:0;transform:translate(0,0)}}` +
      `@keyframes nx-feixe{0%{opacity:0;width:0}35%{opacity:1;width:120vw;height:2px}70%{opacity:.9;height:1px}100%{opacity:0;width:120vw;height:1px}}` +
      `@keyframes nx-onda{0%{opacity:.9;transform:scale(.5)}100%{opacity:0;transform:scale(14)}}` +
      `@keyframes nx-aparece{to{opacity:1}}` +
      `@keyframes nx-marca{to{opacity:1;transform:scale(1);filter:blur(0) brightness(1)}}` +
      `@keyframes nx-traca{to{stroke-dashoffset:0}}` +
      `@keyframes nx-estrela{0%{opacity:0;transform:scale(.2) rotate(0)}40%{opacity:1;transform:scale(1.3) rotate(45deg)}100%{opacity:0;transform:scale(.6) rotate(90deg)}}` +
      `@keyframes nx-letra{to{opacity:1;transform:none;filter:blur(0)}}` +
      `@keyframes nx-brilho{to{background-position:0 0}}` +
      `@keyframes nx-sub{from{opacity:0;letter-spacing:1.2em}to{opacity:1;letter-spacing:.6em}}`;
  document.head.appendChild(st);
  document.body.appendChild(el);

  let saiu = false;
  const sair = () => {
    if (saiu) return;
    saiu = true;
    el.style.opacity = '0';
    el.style.transform = 'scale(1.06)';
    setTimeout(() => { el.remove(); st.remove(); }, 470);
  };
  el.addEventListener('click', sair);
  setTimeout(sair, DURACAO);
}
