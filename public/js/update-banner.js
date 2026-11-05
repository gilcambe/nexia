// #2917: aviso único "Tem atualização nova 🎉 — Toque para atualizar" para todos os apps (PWA).
// Uso: <script src="/js/update-banner.js" defer></script>. Sem dependências. Grátis.
(function () {
  if (window.__kxUpdateBanner) return;
  window.__kxUpdateBanner = true;
  var recarregou = false;
  var tinhaControle = !!navigator.serviceWorker.controller; // na 1ª instalação não recarrega

  function mostrar(worker) {
    if (document.getElementById("kx-atualizar")) return;
    var b = document.createElement("div");
    b.id = "kx-atualizar";
    b.setAttribute("role", "status");
    b.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483647;display:flex;align-items:center;gap:12px;" +
      "padding:12px 14px;border-radius:14px;background:#111827;color:#fff;font:15px/1.3 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);max-width:520px;margin:0 auto";
    b.innerHTML = '<span style="flex:1">Tem atualização nova 🎉 — Toque para atualizar</span>' +
      '<button type="button" style="border:0;border-radius:10px;padding:10px 14px;font:600 15px system-ui,sans-serif;background:#e5e7eb;color:#1f2937;cursor:pointer">Toque para atualizar</button>' +
      '<button type="button" aria-label="Fechar" style="border:0;background:none;color:#9ca3af;font-size:20px;cursor:pointer">×</button>';
    var bts = b.querySelectorAll("button");
    bts[0].onclick = function () {
      bts[0].disabled = true; bts[0].textContent = "Atualizando…";
      if (worker) worker.postMessage({ tipo: "atualizar" });
      setTimeout(function () { location.reload(); }, 3000); // reserva, se o worker não responder
    };
    bts[1].onclick = function () { b.remove(); };
    (document.body || document.documentElement).appendChild(b);
  }

  function vigiar(reg) {
    if (!reg) return;
    if (reg.waiting && navigator.serviceWorker.controller) mostrar(reg.waiting);
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

  navigator.serviceWorker.addEventListener("controllerchange", function () {
    if (recarregou || !tinhaControle) return; // Na 1ª instalação não recarrega automaticamente
    recarregou = true;
    location.reload();
  });
  navigator.serviceWorker.ready.then(function () { return navigator.serviceWorker.getRegistration(); }).then(vigiar).catch(function () {});

  // Extra: busca /version.json?t=agora e compara se mudou se não houver SW
  if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) {
    var versaoKey = "__kx_app_ver";
    fetch("/version.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var v = data && (data.version || data.hash || data.build);
        if (!v) return;
        var salva = localStorage.getItem(versaoKey);
        if (!salva) {
          localStorage.setItem(versaoKey, v);
        } else if (salva !== v) {
          if (!document.getElementById("kx-atualizar")) {
            var b = document.createElement("div");
            b.id = "kx-atualizar";
            b.setAttribute("role", "status");
            b.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483647;display:flex;align-items:center;gap:12px;" +
              "padding:12px 14px;border-radius:14px;background:#111827;color:#fff;font:15px/1.3 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);max-width:520px;margin:0 auto";
            b.innerHTML = '<span style="flex:1">Tem atualização nova 🎉 — Toque para atualizar</span>' +
              '<button type="button" style="border:0;border-radius:10px;padding:10px 14px;font:600 15px system-ui,sans-serif;background:#e5e7eb;color:#1f2937;cursor:pointer">Toque para atualizar</button>' +
              '<button type="button" aria-label="Fechar" style="border:0;background:none;color:#9ca3af;font-size:20px;cursor:pointer">×</button>';
            var bts = b.querySelectorAll("button");
            bts[0].onclick = function () {
              localStorage.setItem(versaoKey, v);
              location.reload();
            };
            bts[1].onclick = function () { b.remove(); };
            (document.body || document.documentElement).appendChild(b);
          }
        }
      })
      .catch(function () {});
  }
})();
