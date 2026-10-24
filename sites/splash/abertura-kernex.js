/* Abertura Kernex de 2 s (mesma vinheta do Body Coach e do Cortex: src/lib/abertura-nexia.ts).
   Uso: <script src="abertura-kernex.js" data-produto="SPLASH" defer></script>
   Uma vez por sessão (chave nexia_splash), sem som, um toque pula, não aparece dentro de iframe
   (o "Editar site" do painel) nem em navegador automatizado (testes). */
(function () {
  'use strict';
  var DURACAO_MS = 2000;
  var MARCA = 'KERNEX';
  var FRASE = 'Inteligência que resolve.';
  var SIMBOLO =
  '<svg class="nx-n" width="96" height="96" viewBox="20 12 160 176" fill="none" aria-hidden="true">' +
  '<path d="M100,36L155.4,68L155.4,132L100,164L44.6,132L44.6,68Z" stroke="#1d5fd0" stroke-width="16" stroke-linejoin="round"/>' +
  '<path d="M69.7,121.2A37,37 0 1 0 69.7,78.8" stroke="#1d5fd0" stroke-width="10" stroke-linecap="round"/>' +
  '<line x1="132" y1="81.5" x2="155.4" y2="68" stroke="#1d5fd0" stroke-width="9" stroke-linecap="round"/>' +
  '<line x1="132" y1="118.5" x2="155.4" y2="132" stroke="#1d5fd0" stroke-width="9" stroke-linecap="round"/>' +
  '<circle cx="100" cy="36" r="15" fill="#6fb8ff"/><circle cx="155.4" cy="68" r="15" fill="#2fd3c7"/>' +
  '<circle cx="155.4" cy="132" r="12" fill="#6b7d96"/><circle cx="100" cy="164" r="14" fill="#0a2468"/>' +
  '<circle cx="44.6" cy="132" r="14" fill="#0a2468"/><circle cx="44.6" cy="68" r="14" fill="#1d5fd0"/>' +
  '<circle cx="100" cy="100" r="25" fill="#1d5fd0"/><circle cx="93" cy="92" r="8" fill="#6fb8ff" opacity=".7"/>' +
  '</svg>';


  function html(produto) {
    var letras = MARCA.split('').map(function (l, i) { return '<span class="nx-l" style="--i:' + (i - 2.5) + '">' + l + '</span>'; }).join('');
    return '<div class="nx-fundo"></div><div class="nx-centro">' +
      '<div class="nx-marca">' + SIMBOLO + '</div>' +
      '<div class="nx-nome">' + letras + '</div>' +
      '<div class="nx-frase">' + FRASE + '</div>' +
      '<div class="nx-sub">' + String(produto).replace(/[<>&]/g, '') + '</div>' +
      '</div>';
  }

  function mostrar(produto) {
    try { if (window.self !== window.top || navigator.webdriver) return; } catch (e) { return; }
    try {
      // data-sempre: aparece em toda abertura da página (site do cliente); sem ele, 1 vez por sessão (painel).
      if (!sempre && sessionStorage.getItem('nexia_splash')) return;
      sessionStorage.setItem('nexia_splash', '1');
    } catch (e) { /* sem armazenamento: mostra mesmo assim */ }
    var calmo = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var SAIDA = 350;
    var DURACAO = calmo ? 800 : DURACAO_MS - SAIDA; // com a saída, o total fica em 2 s

    var el = document.createElement('div');
    el.id = 'nexia-abertura';
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = `position:fixed;inset:0;z-index:99999;overflow:hidden;background:#060d1c;cursor:pointer;transition:opacity ${SAIDA}ms ease,transform ${SAIDA}ms ease;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif`;
    el.innerHTML = html(produto);

    var st = document.createElement('style');
    var base =
      `.nx-centro{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding-bottom:6vh}` +
      `.nx-nome{display:flex;font-weight:600;font-size:32px;letter-spacing:.32em;padding-left:.32em;color:#e2e8f2}` +
      `.nx-frase{font-size:13px;color:#2fd3c7;letter-spacing:.04em}` +
      `.nx-sub{font-size:11px;font-weight:600;letter-spacing:.5em;padding-left:.5em;color:#6b7d96}`;
    st.textContent = calmo
      ? base + `.nx-fundo{display:none}`
      : base +
        `.nx-fundo{position:absolute;inset:-20%;background:radial-gradient(circle at 50% 45%,rgba(29,95,208,.28) 0%,rgba(6,13,28,0) 40%);opacity:0;animation:nx-aparece .6s .1s ease-out forwards}` +
        `.nx-marca{opacity:0;transform:scale(1.4);filter:blur(8px);animation:nx-marca .55s .05s cubic-bezier(.16,1,.3,1) forwards}` +
        `.nx-n{display:block;filter:drop-shadow(0 0 18px rgba(47,211,199,.25))}` +
        `.nx-l{display:inline-block;opacity:0;transform:translateX(calc(var(--i) * 30px)) scale(1.2);filter:blur(6px);animation:nx-letra .5s .4s cubic-bezier(.16,1,.3,1) forwards}` +
        `.nx-frase,.nx-sub{opacity:0;animation:nx-aparece .4s .85s ease-out forwards}` +
        `@keyframes nx-aparece{to{opacity:1}}` +
        `@keyframes nx-marca{to{opacity:1;transform:none;filter:blur(0)}}` +
        `@keyframes nx-letra{to{opacity:1;transform:none;filter:blur(0)}}`;
    document.head.appendChild(st);
    document.body.appendChild(el);

    var saiu = false;
    function sair() {
      if (saiu) return;
      saiu = true;
      el.style.opacity = '0';
      el.style.transform = 'scale(1.04)';
      setTimeout(function () { el.remove(); st.remove(); try { window.dispatchEvent(new Event('kernex-fim')); } catch (e) {} }, SAIDA + 20);
    }
    el.addEventListener('click', sair);
    setTimeout(sair, DURACAO);
  }

  var eu = document.currentScript;
  var produto = (eu && eu.getAttribute('data-produto')) || '';
  var sempre = !!(eu && eu.hasAttribute('data-sempre'));
  window.KernexAbertura = { mostrar: mostrar, html: html, DURACAO_MS: DURACAO_MS };
  if (document.body) mostrar(produto);
  else document.addEventListener('DOMContentLoaded', function () { mostrar(produto); });
})();
