// Gerado pelo NEXIA Site Kit (ADR-Q-04). Sem dependências.
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  document.documentElement.classList.remove('no-js');

  // Cabeçalho que ganha fundo ao rolar + botão de voltar ao topo
  const topbar = $('.topbar');
  const toTop = $('.to-top');
  const onScroll = () => {
    const y = window.scrollY;
    if (topbar) topbar.classList.toggle('is-scrolled', y > 40);
    if (toTop) toTop.classList.toggle('is-visible', y > 700);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Menu do celular
  const btn = $('.menu-btn');
  const menu = $('#menu');
  if (btn && menu) {
    const set = open => { btn.setAttribute('aria-expanded', String(open)); btn.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu'); menu.classList.toggle('is-open', open); };
    btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
    $$('a', menu).forEach(a => a.addEventListener('click', () => set(false)));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
  }

  // Revelar ao rolar e contadores
  const counters = new WeakSet();
  const countUp = el => {
    const m = /^(\D*)([\d.,]+)(.*)$/.exec(el.dataset.to || '');
    if (!m || counters.has(el)) return;
    counters.add(el);
    const raw = m[2], target = parseFloat(/[.,]\d{3}$/.test(raw) ? raw.replace(/[.,]/g, '') : raw.replace(',', '.'));
    if (!isFinite(target)) return;
    const t0 = performance.now(), dur = 1400;
    const step = t => {
      const k = Math.min((t - t0) / dur, 1), v = target * (1 - Math.pow(1 - k, 3));
      el.textContent = m[1] + (Number.isInteger(target) ? Math.round(v).toLocaleString('pt-BR') : v.toFixed(1).replace('.', ',')) + m[3];
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-visible');
      $$('.count', e.target).forEach(countUp);
      io.unobserve(e.target);
    }), { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    $$('.reveal').forEach(el => io.observe(el));
  } else {
    $$('.reveal').forEach(el => el.classList.add('is-visible'));
  }

  // Formulário: valida, mostra erros em português e envia pelo WhatsApp (ou e-mail)
  const form = $('.form');
  if (form) {
    const msgs = { valueMissing: 'Preencha este campo.', typeMismatch: 'Confira o formato.', tooShort: 'Escreva um pouco mais.', patternMismatch: 'Use só números, com DDD.' };
    const check = input => {
      const field = input.closest('.field');
      const err = $('.field__err', field);
      const v = input.validity;
      const key = Object.keys(msgs).find(k => v[k]);
      field.classList.toggle('is-invalid', !!key);
      err.textContent = key ? (input.type === 'checkbox' ? 'Marque para continuar.' : msgs[key]) : '';
      return !key;
    };
    $$('.field input, .field textarea', form).forEach(i => i.addEventListener('blur', () => check(i)));
    form.addEventListener('submit', e => {
      e.preventDefault();
      const ok = $$('.field input, .field textarea', form).map(check).every(Boolean);
      if (!ok) { const bad = $('.is-invalid input, .is-invalid textarea', form); if (bad) bad.focus(); return; }
      const d = Object.fromEntries(new FormData(form));
      const text = `Olá! Sou ${d.nome} (${d.telefone}${d.email ? ', ' + d.email : ''}).\n${d.mensagem}`;
      // Guarda o contato no painel de leads da NEXIA (não trava o envio se a rede falhar).
      if (form.dataset.leads) {
        const q = new URLSearchParams(location.search), utm = {};
        ['source', 'medium', 'campaign', 'content', 'term'].forEach(k => { const v = q.get('utm_' + k); if (v) utm[k] = v; });
        fetch(form.dataset.leads, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
          body: JSON.stringify({ nome: d.nome, whatsapp: d.telefone, email: d.email, mensagem: d.mensagem, consentimento: true, site_url: d.site_url || '',
            produto: 'site', site: location.hostname, pagina: location.pathname, utm, ...(form.dataset.origem ? { origem: form.dataset.origem } : {}) }) }).catch(() => {});
      }
      const ok2 = $('.form__ok', form);
      if (ok2) ok2.hidden = false;
      if (form.dataset.whatsapp) window.open('https://wa.me/' + form.dataset.whatsapp + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
      else if (form.dataset.email) location.href = 'mailto:' + form.dataset.email + '?subject=' + encodeURIComponent('Contato pelo site') + '&body=' + encodeURIComponent(text);
      form.reset();
    });
  }

  // Vídeo do YouTube: só carrega o player quando a pessoa clica (página leve, sem cookies antes do clique)
  $$('.yt').forEach(b => b.addEventListener('click', () => {
    const f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + b.dataset.yt + '?autoplay=1&rel=0';
    f.title = b.getAttribute('aria-label') || 'Vídeo';
    f.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen';
    f.allowFullscreen = true;
    b.replaceWith(f);
  }));

  // Player de música: nunca toca sozinho; botão play/pausa e barra de progresso
  $$('[data-audio]').forEach(box => {
    const a = $('audio', box), b = $('.audio__btn', box), bar = $('.audio__bar span', box);
    const PLAY = b.innerHTML, PAUSE = "<svg class=\"i\" width=\"22\" height=\"22\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M7 4h4v16H7zM13 4h4v16h-4z\" fill=\"currentColor\" stroke=\"none\"/></svg>";
    const sync = () => { const on = !a.paused; box.classList.toggle('is-playing', on); b.innerHTML = on ? PAUSE : PLAY; b.setAttribute('aria-label', on ? 'Pausar música' : 'Tocar música'); };
    b.addEventListener('click', () => { if (a.paused) a.play().catch(() => {}); else a.pause(); });
    a.addEventListener('play', sync); a.addEventListener('pause', sync); a.addEventListener('ended', sync);
    a.addEventListener('timeupdate', () => { if (a.duration) bar.style.width = (a.currentTime / a.duration * 100) + '%'; });
  });

  $$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
})();
