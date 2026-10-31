// Viajante Pro — site: aplica textos/fotos/contatos editados no painel e envia o pedido de orçamento para a agência.
(function () {
  'use strict';
  const API = window.VP_API || 'https://nexia.gcbezerra.workers.dev/api/viagem';
  const SITE = 'viajantepro';
  let whats = '5511941247074';
  const post = b => fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ site: SITE, ...b }) })
    .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'erro'); return j; });

  function botaoWhats() {
    let a = document.getElementById('vp-whats');
    if (!a) {
      a = document.createElement('a'); a.id = 'vp-whats'; a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('aria-label', 'Falar no WhatsApp');
      a.textContent = 'WhatsApp';
      a.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:50;background:#25d366;color:#fff;font-weight:700;padding:12px 18px;border-radius:999px;text-decoration:none;box-shadow:0 8px 24px rgba(0,0,0,.25)';
      document.body.appendChild(a);
    }
    a.href = `https://wa.me/${whats}?text=${encodeURIComponent('Olá! Vim pelo site da Viajante Pro e quero um orçamento.')}`;
  }

  post({ acao: 'site_obter' }).then(({ site }) => {
    site = site || {};
    Object.entries(site.textos || {}).forEach(([k, v]) => { if (!v) return; document.querySelectorAll(`[data-editar="${k}"]`).forEach(el => { el.textContent = v; }); });
    if (site.email) document.querySelectorAll('[data-contato="email"]').forEach(el => { el.textContent = site.email; });
    if (site.whatsapp) whats = site.whatsapp;
    const foto = (site.fotos || {}).capa;
    if (foto) { const m = document.querySelector('.hero__media'); if (m) { m.innerHTML = ''; const img = document.createElement('img'); img.src = foto; img.alt = ''; m.appendChild(img); } }
    botaoWhats();
  }).catch(botaoWhats);

  window.submitLead = async function (form) {
    const btn = document.getElementById('btnSiteSubmit');
    const ok = document.getElementById('siteFormOk');
    btn.disabled = true;
    try {
      await post({ acao: 'lead_criar', nome: form.nome.value, whatsapp: form.telefone.value, email: form.email.value, mensagem: form.mensagem.value });
      ok.hidden = false; ok.textContent = 'Recebemos sua solicitação! Vamos responder em breve.';
      form.reset();
    } catch (e) {
      ok.hidden = false;
      ok.innerHTML = 'Não consegui enviar agora. <a href="https://wa.me/' + whats + '?text=' + encodeURIComponent('Orçamento: ' + form.mensagem.value) + '" target="_blank" rel="noopener">Mande pelo WhatsApp</a>.';
    } finally { btn.disabled = false; }
  };
})();
