// Aviso de atualização (PWA/web). Uso: <script src="/js/update-banner.js" defer></script>.
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
    b.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483647;display:flex;align-items:center;gap:12px;" +
      "padding:12px 14px;border-radius:14px;background:#f3f4f6;color:#111827;font:16px/1.35 system-ui,sans-serif;" +
      "box-shadow:0 8px 24px rgba(0,0,0,.2);width:calc(100% - 24px);max-width:520px;margin:0 auto;border:1px solid #d1d5db";
    b.innerHTML = '<button type="button" style="flex:1;min-height:48px;cursor:pointer;background:#111827;color:#fff;border:0;border-radius:10px;padding:12px 14px;text-align:left;font:bold 16px/1.35 system-ui,sans-serif;outline-offset:3px">Tem atualização nova 🎉 — Toque para atualizar</button>' +
      '<button type="button" aria-label="Fechar aviso" style="border:0;background:none;color:#4b5563;font-size:22px;cursor:pointer;margin-left:10px;min-width:44px;min-height:44px">×</button>';
    var btnAtualizar = b.querySelector('button');
    var btnFechar = b.querySelectorAll('button')[1];
    btnAtualizar.onclick = function () {
      btnAtualizar.disabled = true;
      btnAtualizar.textContent = "Atualizando…";
      if (worker) {
        worker.postMessage({ tipo: "atualizar" });
      } else {
        location.reload();
      }
    };
    btnFechar.onclick = function (e) { e.stopPropagation(); b.remove(); };
    (document.body || document.documentElement).appendChild(b);
  }

  function vigiar(reg) {
    if (!reg) return;
    if (reg.waiting) mostrar(reg.waiting);
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

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (recarregou) return;
      recarregou = true;
      location.reload();
    });
    navigator.serviceWorker.getRegistration().then(vigiar).catch(function () {});
  }

  function verificarVersao() {
    fetch("/version.json?t=" + Date.now(), { cache: "no-store" }).then(function (res) {
      if (!res.ok) return;
      return res.json();
    }).then(function (data) {
      if (!data || !data.version) return;
      var chave = "kx_ver";
      var atual = localStorage.getItem(chave);
      if (atual && atual !== data.version) {
        mostrar(null);
      }
      localStorage.setItem(chave, data.version);
    }).catch(function () {});
  }
  if (!("serviceWorker" in navigator)) {
    verificarVersao();
  }

  // Hook mínimo para testes: window.KxUpdateBanner = { mostrar, vigiar, verificarVersao }.
  global.KxUpdateBanner = { mostrar: mostrar, vigiar: vigiar, verificarVersao: verificarVersao };
})(typeof window !== "undefined" ? window : this);
