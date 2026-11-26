// #2917: aviso único "Tem atualização nova 🎉 — Toque para atualizar" para todos os apps (PWA).
// Implementação: atualiza via SW, visibilitychange, intervalo e fallback por version.json.
// Uso: <script src="/js/update-banner.js" defer></script>. Sem dependências.
(function () {
  if (window.__kxUpdateBanner) return;
  window.__kxUpdateBanner = true;
  var recarregou = false;
  var tinhaControle = "serviceWorker" in navigator && !!navigator.serviceWorker.controller;

  function mostrar(worker) {
    if (document.getElementById("kx-atualizar")) return;
    var b = document.createElement("div");
    b.id = "kx-atualizar";
    b.setAttribute("role", "region");
    b.setAttribute("aria-live", "polite");
    b.setAttribute("aria-label", "Aviso de atualização");
    b.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483647;display:flex;align-items:center;gap:12px;" +
      "padding:12px 14px;border-radius:14px;background:#111827;color:#fff;font:15px/1.3 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);max-width:520px;margin:0 auto";
    b.innerHTML = '<button type="button" style="flex:1;cursor:pointer;background:none;border:none;color:white;text-align:left;font:bold 15px/1.3 system-ui,sans-serif">Tem atualização nova 🎉 — Toque para atualizar</button>' +
      '<button type="button" aria-label="Fechar" style="border:0;background:none;color:#9ca3af;font-size:20px;cursor:pointer;margin-left:10px">×</button>';
    var btnAtualizar = b.querySelector('button');
    var btnFechar = b.querySelectorAll('button')[1];
    btnAtualizar.onclick = function () {
      btnAtualizar.textContent = "Atualizando…";
      if (worker) worker.postMessage({ tipo: "atualizar" });
      setTimeout(function () { location.reload(); }, 3000);
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
    setInterval(checar, 30 * 60 * 1000);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") checar(); });
    checar();
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (recarregou || !tinhaControle) return;
      recarregou = true;
      location.reload();
    });
    navigator.serviceWorker.ready.then(function () { return navigator.serviceWorker.getRegistration(); }).then(vigiar).catch(function () {});
  }

  function verificarVersao() {
    fetch("/version.json?t=" + Date.now()).then(function (res) {
      if (!res.ok) return;
      return res.json();
    }).then(function (data) {
      if (!data || !data.version) return;
      var chave = "kx_ver";
      var atual = localStorage.getItem(chave);
      if (atual && atual !== data.version) {
        if (!document.getElementById("kx-atualizar")) {
          var b = document.createElement("div");
          b.id = "kx-atualizar";
          b.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483647;display:flex;align-items:center;gap:12px;" +
            "padding:12px 14px;border-radius:14px;background:#111827;color:#fff;font:15px/1.3 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);max-width:520px;margin:0 auto";
          b.innerHTML = '<button type="button" style="flex:1;cursor:pointer;background:none;border:none;color:white;text-align:left;font:bold 15px/1.3 system-ui,sans-serif" onclick="location.reload()">Atualização disponível — Toque para recarregar</button>';
          (document.body || document.documentElement).appendChild(b);
        }
      }
      localStorage.setItem(chave, data.version);
    }).catch(function () {});
  }
  if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) {
    verificarVersao();
  }
})();
