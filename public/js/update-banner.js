// Aviso de atualização (PWA/web). Uso: <script src="/js/update-banner.js" defer></script>.
// JS puro, sem dependência (~60 linhas): faixa fixa embaixo quando há versão nova.
// JS puro, sem dependência. Mostra faixa fixa embaixo quando há versão nova.
(function (global) {
  if (global.__kxUpdateBanner) return;
  global.__kxUpdateBanner = true;

  var recarregou = false;
  var temporizador = null;

  function mostrar(worker) {
    if (document.getElementById("kx-atualizar")) return;
    var b = document.createElement("div");
    b.id = "kx-atualizar";
    b.setAttribute("role", "region");
    b.setAttribute("aria-live", "polite");
    b.setAttribute("aria-label", "Aviso de atualização");
    b.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483647;width:calc(100% - 24px);max-width:520px;margin:0 auto";
    b.innerHTML = '<button id="kx-atualizar-btn" type="button" style="width:100%;min-height:48px;cursor:pointer;background:#f3f4f6;color:#111827;border:1px solid #d1d5db;border-radius:14px;padding:14px 16px;font:bold 16px/1.35 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.2)">Tem atualização nova 🎉 — Toque para atualizar</button>';
    var btn = b.querySelector("#kx-atualizar-btn");
    btn.onclick = function () {
      btn.disabled = true;
      btn.textContent = "Aguarde…";
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
    // Mostra a faixa sempre que houver worker esperando (reg.waiting).
    if (reg.waiting) mostrar(reg.waiting);
    if (reg.__kxVigiado) return;
    reg.__kxVigiado = true;
    reg.addEventListener("updatefound", function () {
      var novo = reg.installing;
      if (!novo) return;
      novo.addEventListener("statechange", function () {
        if (novo.state === "installed" && navigator.serviceWorker.controller) mostrar(novo);
      });
    });
    var checar = function () { reg.update().catch(function () {}); };
    if (temporizador) clearInterval(temporizador);
    temporizador = setInterval(checar, 30 * 60 * 1000);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") checar(); });
    checar();
  }

  // Extra: sem service worker, compara /version.json com a versão salva.
  function checarVersao() {
    fetch("/version.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.version) return;
        var atual = null;
        try { atual = localStorage.getItem("kx_ver"); localStorage.setItem("kx_ver", d.version); } catch (e) {}
        if (atual !== null && atual !== d.version) mostrar(null);
      }).catch(function () {});
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
    navigator.serviceWorker.getRegistration().then(vigiar).catch(function () {});
  } else {
    // Sem service worker no navegador: usa o fallback /version.json.
    checarVersao();
  }

  // Extra: sem service worker, compara /version.json com a versão salva.
  function checarVersao() {
    fetch("/version.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.version) return;
        var atual = null;
        try { atual = localStorage.getItem("kx_ver"); localStorage.setItem("kx_ver", d.version); } catch (e) {}
        if (atual !== null && atual !== d.version) mostrar(null);
      }).catch(function () {});
  }

})(typeof window !== "undefined" ? window : this);

