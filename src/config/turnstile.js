// src/config/turnstile.js
export const TURNSTILE_SITE_KEY = process.env.TURNSTILE_SITE_KEY || "1x00000000000000000000AA";

export function initTurnstile(containerId, callback) {
  if (typeof window === "undefined") return;
  
  const renderWidget = () => {
    if (window.turnstile) {
      try {
        window.turnstile.render(containerId, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: callback,
        });
      } catch (e) {
        console.error("Erro ao renderizar Turnstile:", e);
      }
    } else {
      setTimeout(renderWidget, 100);
    }
  };

  if (!document.getElementById("turnstile-script")) {
    const script = document.createElement("script");
    script.id = "turnstile-script";
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = renderWidget;
    document.head.appendChild(script);
  } else {
    renderWidget();
  }
}
