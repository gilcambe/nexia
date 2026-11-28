// Aviso de atualização (PWA/web). Uso: <script src="/js/update-banner.js" defer></script>.
// JS puro, sem dependência. Mostra faixa fixa embaixo quando há versão nova.
(function (global) {
  var recarregou = false;
  var temporizador = null;

  function mostrar(worker) {
    if (document.getElementById("kx-atualizar")) return;
    var b = document.createElement("div");
    b.id = "kx-atualizar";
    b.setAttribute("role", "region");
    b.setAttribute("aria-live", "polite");
    b.setAttribute("aria-label", "Aviso de atualização");
    b.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483647;display:flex;gap:12px;" +
      "padding:12px 14px;border-radius:14px;background:#f3f4f6;color:#111827;font:16px/1.35 system-ui,sans-serif;" +
      "box-shadow:0 8px 24px rgba(0,0,0,.2);width:calc(100% - 24px);max-width:520px;margin:0 auto;border:1px solid #d1d5db";
    b.innerHTML = '<button type="button" style="flex:1;min-height:48px;cursor:pointer;background:#111827;color:#fff;border:0;border-radius:10px;padding:12px 14px;text-align:left;font:bold 16px/1.35 system-ui,sans-serif">Tem atualização nova 🎉 — Toque para atualizar</button>';
    var btn = b.querySelector("button");
    btn.onclick = function () {
      btn.disabled = true;
      btn.textContent = "Atualizando…";
      if (worker) {
        worker.postMessage({ tipo: "atualizar" });
        // Reserva: se o worker não trocar o controller em 3s, recarrega uma vez.
        setTimeout(recarregarUmaVez, 3000);
      } else {
        // Sem service worker: fallback com a MESMA trava de reload único.
        recarregarUmaVez();
      }
    };
    (document.body || document.documentElement).appendChild(b);
    // Foco no botão para teclado e leitor de tela.
    try { btn.focus({ preventScroll: false }); } catch (e) { try { btn.focus(); } catch (e2) {} }
  }

  // Recarrega a página UMA única vez (trava compartilhada por todos os caminhos).
  function recarregarUmaVez() {
    if (recarregou) return;
    recarregou = true;
    location.reload();
  }

  function vigiar(reg) {
    if (!reg) return;
    // Só avisa em atualização real: precisa haver controlador (app já instalado)
    // e opt-in do app em window.KxUpdateBannerAtivo !== false.
    var ativo = global.KxUpdateBannerAtivo !== false;
    var temController = !!navigator.serviceWorker.controller;
    if (reg.waiting && temController && ativo) mostrar(reg.waiting);
    if (reg.__kxVigiado) return;
    reg.__kxVigiado = true;
    reg.addEventListener("updatefound", function () {
      var novo = reg.installing;
      if (!novo) return;
      novo.addEventListener("statechange", function () {
        if (novo.state === "installed" && navigator.serviceWorker.controller && global.KxUpdateBannerAtivo !== false) mostrar(novo);
      });
    });
    var checar = function () { reg.update().catch(function () {}); };
    if (temporizador) clearInterval(temporizador);
    temporizador = setInterval(checar, 30 * 60 * 1000);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") checar(); });
    checar();
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      // Recarrega uma única vez e só se o app já tinha controlador antes da troca
      // (evita recarregar apps no ar na primeira instalação).
      if (recarregou) return;
      if (!global.__kxTinhaController) return;
      recarregou = true;
      location.reload();
    });
    global.__kxTinhaController = !!navigator.serviceWorker.controller;
    // Sem fallback por tempo: a página só recarrega no controllerchange (uma vez),
    // para não recarregar sozinha quando o app ainda não tinha controlador.
    navigator.serviceWorker.getRegistration().then(vigiar).catch(function () { checarVersao(); });
  } else {
    checarVersao();
  }

  // Sem service worker: compara /version.json com a versão salva.
  // Sem valor salvo (primeira visita) só grava a versão, sem faixa.
  // Se a versão mudou desde a última visita, mostra a faixa; ao tocar,
  // recarrega uma vez (mesma tecla do fluxo com service worker).
  function checarVersao() {
    fetch("/version.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.version) return;
        var atual = null;
        try { atual = localStorage.getItem("kx_ver"); } catch (e) {}
        try { localStorage.setItem("kx_ver", d.version); } catch (e) {}
        if (atual !== null && atual !== d.version) mostrar(null);
      }).catch(function () {});
  }

  // Guarda o registro do service worker para apps que queiram reutilizar.
  global.KxUpdateBannerRegistro = null;
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistration().then(function (reg) {
      global.KxUpdateBannerRegistro = reg || null;
    }).catch(function () {});
  }

  global.KxUpdateBanner = {
    mostrar: mostrar,
    vigiar: vigiar,
    get temporizador() { return temporizador; },
    parar: function () { if (temporizador) { clearInterval(temporizador); temporizador = null; } }
  };
  // Pronto para uso: <script src="/js/update-banner.js" defer></script>
})(typeof window !== "undefined" ? window : this);
