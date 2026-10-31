/* Viajante Pro — logo oficial em todas as páginas, com o avião do logo decolando
   (2,6 s ao abrir, depois da abertura Kernex, e de novo a cada 5 min). Respeita "reduzir movimento".
   Uso: <script src="/viajante-pro/vp-marca.js" defer></script> */
(function () {
  'use strict';
  var LOGO = '/viajante-pro/img/vp-oficial.jpg';
  var calmo = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var st = document.createElement('style');
  st.textContent =
    '.vp-logo-anim{position:relative;display:inline-block;overflow:hidden;line-height:0;border-radius:inherit}' +
    '.vp-logo-anim img{display:block;width:100%;height:100%;object-fit:cover}' +
    // camada 1: logo sem a faixa do avião; camada 2: só o avião
    '.vp-logo-anim .vp-corpo{position:absolute;inset:0;clip-path:polygon(evenodd,0 0,100% 0,100% 100%,0 100%,0 0,18% 27%,82% 27%,82% 47%,18% 47%,18% 27%)}' +
    '.vp-logo-anim .vp-aviao{position:absolute;inset:0;clip-path:inset(27% 18% 53% 18%);transform-origin:50% 37%}' +
    '.vp-logo-anim.voando .vp-aviao{animation:vp-decola 2.6s cubic-bezier(.45,0,.2,1) both}' +
    '@keyframes vp-decola{0%{transform:none;opacity:1}12%{transform:translateY(2%) scale(1.02)}' +
    '55%{transform:translate(8%,-42%) scale(.55) rotate(-10deg);opacity:0}' +
    '56%{transform:translate(-8%,30%) scale(.7);opacity:0}100%{transform:none;opacity:1}}' +
    '.vp-logo-fixo{position:fixed;top:10px;right:10px;z-index:9000;width:48px;height:48px;border-radius:12px;box-shadow:0 6px 18px rgba(0,0,0,.25);background:#ddd}';
  document.head.appendChild(st);

  function animar(img) {
    if (img.dataset.vpAnim) return;
    img.dataset.vpAnim = '1';
    var w = img.getAttribute('width'), h = img.getAttribute('height');
    var caixa = document.createElement('span');
    caixa.className = 'vp-logo-anim ' + (img.className || '');
    var cs = getComputedStyle(img);
    caixa.style.width = img.offsetWidth ? img.offsetWidth + 'px' : (w ? w + 'px' : cs.width);
    caixa.style.height = img.offsetHeight ? img.offsetHeight + 'px' : (h ? h + 'px' : cs.height);
    caixa.setAttribute('role', 'img');
    caixa.setAttribute('aria-label', img.alt || 'Viajante Pro');
    img.parentNode.insertBefore(caixa, img);
    img.className = 'vp-corpo';
    img.alt = '';
    var aviao = img.cloneNode();
    aviao.className = 'vp-aviao';
    caixa.appendChild(img);
    caixa.appendChild(aviao);
    img.style.position = 'absolute'; img.style.inset = '0';
    return caixa;
  }

  function decolar() {
    if (calmo) return;
    document.querySelectorAll('.vp-logo-anim').forEach(function (c) {
      c.classList.remove('voando'); void c.offsetWidth; c.classList.add('voando');
    });
  }

  function iniciar() {
    var logos = [].slice.call(document.querySelectorAll('img')).filter(function (i) { return /vp-oficial/.test(i.getAttribute('src') || ''); });
    if (!logos.length) {
      // página sem logo: põe o logo oficial no canto (volta para o início do site ao clicar)
      var a = document.createElement('a');
      a.href = '/viajante-pro/'; a.setAttribute('aria-label', 'Viajante Pro — início');
      var im = document.createElement('img');
      im.src = LOGO; im.alt = 'Viajante Pro'; im.className = 'vp-logo-fixo'; im.width = 48; im.height = 48;
      a.appendChild(im); document.body.appendChild(a);
      logos = [im];
    }
    logos.forEach(function (img) {
      if (img.complete && img.naturalWidth) animar(img);
      else img.addEventListener('load', function () { animar(img); }, { once: true });
    });
    var abertura = document.getElementById('nexia-abertura');
    if (abertura) window.addEventListener('kernex-fim', function () { setTimeout(decolar, 150); }, { once: true });
    else setTimeout(decolar, 400);
    setInterval(decolar, 5 * 60 * 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
