/* Viajante Pro — logo oficial em todas as páginas, com o avião do logo decolando
   (2,6 s ao abrir, depois da abertura Kernex, e de novo a cada 5 min). Respeita "reduzir movimento".
   Uso: <script src="/viajante-pro/vp-marca.js" defer></script> */
(function () {
  'use strict';
  var LOGO = '/viajante-pro/img/vp-oficial.jpg';
  var calmo = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var st = document.createElement('style');
  st.textContent =
    'html,body{overflow-x:clip}' +
    '.vp-logo-anim{position:relative;display:inline-block;overflow:visible;line-height:0;border-radius:inherit}' +
    '.vp-logo-anim img{display:block;width:100%;height:100%;object-fit:cover}' +
    // camada 1: logo com o avião apagado (vp-sem-aviao.jpg); camada 2: só o avião, fundo transparente (vp-aviao.png)
    '.vp-logo-anim .vp-corpo{position:absolute;inset:0}' +
    '.vp-logo-anim .vp-aviao{position:absolute;inset:0;transform-origin:50% 39%;pointer-events:none}' +
    '.vp-logo-anim.voando .vp-aviao{animation:vp-decola 3.6s cubic-bezier(.45,0,.2,1) both;z-index:5}' +
    '@keyframes vp-decola{0%{transform:none;opacity:1;filter:none}8%{transform:translateX(6%) scale(1.05)}'+
    '18%{transform:translate(40%,-8%) scale(1.6) rotate(-6deg);filter:invert(1) drop-shadow(0 0 4px #d4af37)}'+
    '55%{transform:translate(780%,-30%) scale(2.2) rotate(-10deg);opacity:1;filter:invert(1) drop-shadow(0 0 6px #d4af37)}'+
    '68%{transform:translate(1100%,-60%) scale(1.4) rotate(-14deg);opacity:0;filter:invert(1)}'+
    '69%{transform:translateY(25%) scale(.8);opacity:0;filter:none}100%{transform:none;opacity:1;filter:none}}' +
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
    aviao.removeAttribute('onerror');
    img.removeAttribute('onerror');
    img.src = '/viajante-pro/img/vp-sem-aviao.jpg';
    aviao.src = '/viajante-pro/img/vp-aviao.png';
    aviao.style.objectFit = getComputedStyle(img).objectFit || 'cover';
    caixa.appendChild(img);
    caixa.appendChild(aviao);
    img.style.position = 'absolute'; img.style.inset = '0';
    return caixa;
  }

  // Controle de estado para evitar múltiplas animações
  var voando = false;
  var ultimaAnimacao = 0;
  
  function decolar() {
    if (calmo || voando) return;
    
    // Verifica se a aba está visível e se passaram 5 min desde a última animação
    var agora = Date.now();
    if (document.visibilityState !== 'visible' || (agora - ultimaAnimacao < 5 * 60 * 1000)) {
      return;
    }
    
    voando = true;
    ultimaAnimacao = agora;
    
    document.querySelectorAll('.vp-logo-anim').forEach(function (c) {
      c.classList.remove('voando'); void c.offsetWidth; c.classList.add('voando');
    });
    
    // Reseta o estado após a animação
    setTimeout(function() {
      voando = false;
    }, 2500);
  }

  function iniciar() {
    [].forEach.call(document.images, function (img) {
      if (img.complete && !img.naturalWidth && img.src && !img.dataset.vpFundo && !/vp-oficial|kernex|vp\.svg/.test(img.src)) { img.dataset.vpFundo = '1'; img.src = fundo(img.alt); }
    });
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
    
    // Listener para visibility change - ao voltar da aba, tenta animar se passaram 5 min
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible') {
        decolar();
      }
    });
    // decola também quando o logo aparece na tela (ex.: depois de fechar um aviso ou rolar a página)
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting && !calmo && !document.getElementById('nexia-abertura') && !voando) { decolar(); } });
      }, { threshold: 0.6 });
      setTimeout(function () { document.querySelectorAll('.vp-logo-anim').forEach(function (c) { io.observe(c); }); }, 300);
    }
  }

  // foto que não carregar vira um fundo bonito com o nome do lugar (nunca ícone de imagem quebrada)
  function fundo(txt) {
    var t = String(txt || 'Viajante Pro').replace(/[<>&"]/g, '').slice(0, 40);
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b2a4a"/><stop offset="1" stop-color="#c9a227"/></linearGradient></defs><rect width="800" height="500" fill="url(#g)"/><text x="400" y="270" font-family="Georgia,serif" font-size="44" fill="#fff" text-anchor="middle">' + t + '</text></svg>');
  }
  document.addEventListener('error', function (e) {
    var img = e.target;
    if (!img || img.tagName !== 'IMG' || img.dataset.vpFundo || /vp-oficial|kernex|vp\.svg/.test(img.src)) return;
    img.dataset.vpFundo = '1';
    img.src = fundo(img.alt);
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
