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
      err.textContent = key ? msgs[key] : '';
      return !key;
    };
    $$('input, textarea', form).forEach(i => i.addEventListener('blur', () => check(i)));
    form.addEventListener('submit', e => {
      e.preventDefault();
      const ok = $$('input, textarea', form).map(check).every(Boolean);
      if (!ok) { const bad = $('.is-invalid input, .is-invalid textarea', form); if (bad) bad.focus(); return; }
      const d = Object.fromEntries(new FormData(form));
      const text = `Olá! Sou ${d.nome} (${d.telefone}${d.email ? ', ' + d.email : ''}).\n${d.mensagem}`;
      const ok2 = $('.form__ok', form);
      if (ok2) ok2.hidden = false;
      if (form.dataset.whatsapp) window.open('https://wa.me/' + form.dataset.whatsapp + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
      else if (form.dataset.email) location.href = 'mailto:' + form.dataset.email + '?subject=' + encodeURIComponent('Contato pelo site') + '&body=' + encodeURIComponent(text);
      form.reset();
    });
  }

  $$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
})();
