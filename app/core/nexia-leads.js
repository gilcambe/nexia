/* NEXIA Leads — formulário de captura para QUALQUER site (grátis).
 *
 * Como usar em uma página:
 *   <div data-nexia-leads data-produto="body-coach" data-titulo="Quero testar grátis"
 *        data-whatsapp="5511999999999"></div>
 *   <script src="https://nexia.gcbezerra.workers.dev/core/nexia-leads.js" defer></script>
 *
 * - Grava em /api/leads do mesmo servidor de onde este arquivo veio (aparece no painel /leads).
 * - Guarda de onde a pessoa veio (utm_source, utm_campaign... do link do anúncio ou do post).
 * - Pede consentimento (LGPD) e tem armadilha para robôs.
 * - Formulário próprio? Chame window.NexiaLeads.send({ nome, whatsapp, email, mensagem, produto }).
 */
(function () {
  'use strict';
  var me = document.currentScript;
  var API = (me && me.src ? new URL(me.src).origin : location.origin) + '/api/leads';
  var UTM_KEY = 'nexia_utm';

  // Primeira origem da visita (o anúncio ou post que trouxe a pessoa), mesmo se ela navegar no site.
  function utm() {
    var saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(UTM_KEY) || 'null'); } catch (e) { saved = null; }
    var q = new URLSearchParams(location.search), out = {};
    ['source', 'medium', 'campaign', 'content', 'term'].forEach(function (k) { var v = q.get('utm_' + k); if (v) out[k] = v.slice(0, 120); });
    if (!Object.keys(out).length && document.referrer) {
      try { var h = new URL(document.referrer).hostname; if (h && h !== location.hostname) out = { source: h, medium: 'referral' }; } catch (e) { /* sem referrer */ }
    }
    if (saved) return saved;
    if (Object.keys(out).length) { try { sessionStorage.setItem(UTM_KEY, JSON.stringify(out)); } catch (e) { /* modo privado */ } }
    return out;
  }
  utm();

  function send(data) {
    var body = Object.assign({ consentimento: true, site: location.hostname, pagina: location.pathname, utm: utm() }, data || {});
    // text/plain = pedido "simples": funciona de qualquer domínio sem preflight.
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Não foi possível enviar.'); return j; }); });
  }

  var CSS = '.nxl{display:grid;gap:.6rem;max-width:420px;font:inherit}.nxl input,.nxl textarea{width:100%;box-sizing:border-box;padding:.75rem .9rem;border:1px solid rgba(127,127,127,.4);border-radius:10px;font:inherit;background:transparent;color:inherit}'
    + '.nxl label.nxl-c{display:flex;gap:.5rem;align-items:flex-start;font-size:.85rem;opacity:.85}.nxl label.nxl-c input{width:auto;margin-top:.2rem}'
    + '.nxl button{padding:.85rem 1rem;border:0;border-radius:999px;font:inherit;font-weight:600;cursor:pointer;background:#00d4ff;color:#04121a}.nxl button[disabled]{opacity:.6;cursor:wait}'
    + '.nxl-hp{position:absolute!important;left:-9999px!important;height:0;overflow:hidden}.nxl-msg{font-size:.9rem}.nxl-err{color:#ff6b6b}.nxl-ok a{color:inherit;font-weight:600}';

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text) e.textContent = text;
    return e;
  }

  function mount(box) {
    if (box.dataset.nxlReady) return;
    box.dataset.nxlReady = '1';
    var f = el('form', { class: 'nxl', novalidate: '' });
    if (box.dataset.titulo) f.appendChild(el('strong', {}, box.dataset.titulo));
    var nome = el('input', { name: 'nome', placeholder: 'Seu nome', autocomplete: 'name', required: '', minlength: '2', 'aria-label': 'Seu nome' });
    var tel = el('input', { name: 'whatsapp', type: 'tel', inputmode: 'tel', placeholder: 'WhatsApp com DDD', autocomplete: 'tel', 'aria-label': 'WhatsApp com DDD' });
    var mail = el('input', { name: 'email', type: 'email', placeholder: 'E-mail (opcional)', autocomplete: 'email', 'aria-label': 'E-mail' });
    var hp = el('div', { class: 'nxl-hp', 'aria-hidden': 'true' }); hp.appendChild(el('input', { name: 'site_url', tabindex: '-1', autocomplete: 'off' }));
    var c = el('label', { class: 'nxl-c' }); var ck = el('input', { type: 'checkbox', required: '' });
    c.appendChild(ck); c.appendChild(document.createTextNode('Aceito receber contato por WhatsApp ou e-mail sobre este assunto.'));
    var btn = el('button', { type: 'submit' }, box.dataset.botao || 'Quero saber mais');
    var msg = el('p', { class: 'nxl-msg', role: 'status', 'aria-live': 'polite' });
    [nome, tel, mail, hp, c, btn, msg].forEach(function (x) { f.appendChild(x); });
    box.appendChild(f);

    f.addEventListener('submit', function (e) {
      e.preventDefault();
      msg.className = 'nxl-msg nxl-err';
      if (nome.value.trim().length < 2) { msg.textContent = 'Informe seu nome.'; nome.focus(); return; }
      if (!tel.value.trim() && !mail.value.trim()) { msg.textContent = 'Informe WhatsApp ou e-mail.'; tel.focus(); return; }
      if (!ck.checked) { msg.textContent = 'Marque a caixa de consentimento para continuar.'; ck.focus(); return; }
      btn.disabled = true; msg.className = 'nxl-msg'; msg.textContent = 'Enviando...';
      send({ nome: nome.value, whatsapp: tel.value, email: mail.value, produto: box.dataset.produto || 'geral', site_url: hp.firstChild.value })
        .then(function () {
          f.reset();
          msg.className = 'nxl-msg nxl-ok';
          msg.textContent = box.dataset.obrigado || 'Pronto! Recebemos seu contato e vamos falar com você em breve.';
          if (box.dataset.whatsapp) {
            var a = el('a', { href: 'https://wa.me/' + box.dataset.whatsapp.replace(/\D/g, '') + '?text=' + encodeURIComponent('Olá! Acabei de me cadastrar pelo site.'), target: '_blank', rel: 'noopener' }, ' Falar agora no WhatsApp');
            msg.appendChild(a);
          }
        })
        .catch(function (err) { msg.className = 'nxl-msg nxl-err'; msg.textContent = err.message; })
        .then(function () { btn.disabled = false; });
    });
  }

  function init() {
    var boxes = document.querySelectorAll('[data-nexia-leads]');
    if (boxes.length && !document.getElementById('nxl-css')) { var s = el('style', { id: 'nxl-css' }); s.textContent = CSS; document.head.appendChild(s); }
    Array.prototype.forEach.call(boxes, mount);
  }

  window.NexiaLeads = { send: send, init: init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
