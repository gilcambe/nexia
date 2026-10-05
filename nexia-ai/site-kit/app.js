'use strict';
// Renderiza um sistema (painel/CRUD) a partir do spec (ADR-Q-04): menu lateral, painel com indicadores e
// gráfico (Chart.js via CDN), tabelas com busca, ordenação e exportação CSV, formulário em modal com
// validação, dados salvos no navegador (localStorage), modo escuro e layout responsivo.
const { icon } = require('./icons');
const { esc } = require('./site');

const attr = esc;
const CHART_JS = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.js';
const fontsHref = f => `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.heading).replace(/%20/g, '+')}:wght@600;700;800&family=${encodeURIComponent(f.body).replace(/%20/g, '+')}:wght@400;500;600&display=swap`;
const ENTITY_ICONS = ['list', 'grid', 'clock', 'chart', 'star', 'mail'];

/** Configuração embutida no HTML que o script lê (sem caracteres que fechem a tag <script>). */
function config(spec) {
  const cfg = {
    key: `nexia-app:${spec.folder}`,
    name: spec.name,
    entities: spec.entities.map(e => ({ key: e.key, label: e.label, singular: e.singular, fields: e.fields, sample: e.sample })),
  };
  return JSON.stringify(cfg).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function html(spec) {
  const c = spec.contact;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(spec.name)}${spec.tagline ? ` — ${esc(spec.tagline)}` : ''}</title>
  <meta name="description" content="${attr(spec.description || spec.tagline || spec.name)}">
  <meta name="theme-color" content="${spec.palette.primary}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${attr(fontsHref(spec.fonts))}" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
  <script>try{if(localStorage.getItem('nexia-theme')==='dark')document.documentElement.dataset.theme='dark'}catch(e){}</script>
</head>
<body>
  <a class="skip" href="#conteudo">Pular para o conteúdo</a>
  <div class="shell">
    <aside class="sidebar" id="sidebar" aria-label="Menu do sistema">
      <div class="sidebar__brand">
        <span class="logo" aria-hidden="true">${esc(spec.name.slice(0, 1).toUpperCase())}</span>
        <span>${esc(spec.name)}</span>
      </div>
      <nav class="sidebar__nav" aria-label="Seções">
        <a href="#/painel" data-route="painel">${icon('chart')}<span>Painel</span></a>
        ${spec.entities.map((e, i) => `<a href="#/${attr(e.key)}" data-route="${attr(e.key)}">${icon(ENTITY_ICONS[i % ENTITY_ICONS.length])}<span>${esc(e.label)}</span></a>`).join('\n        ')}
      </nav>
      <div class="sidebar__foot">
        ${c.email || c.phone ? `<p>Suporte: ${esc(c.email || c.phone)}</p>` : ''}
        <p>Dados salvos neste navegador.</p>
      </div>
    </aside>
    <div class="backdrop" data-close-menu hidden></div>
    <div class="main">
      <header class="topbar">
        <button class="icon-btn menu-btn" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="sidebar">${icon('menu', 22)}</button>
        <div class="topbar__title">
          <h1 id="view-title">Painel</h1>
          <p id="view-sub">${esc(spec.tagline || 'Visão geral')}</p>
        </div>
        <label class="search">
          <span class="sr-only">Buscar</span>
          ${icon('search', 18)}
          <input id="search" type="search" placeholder="Buscar..." autocomplete="off">
        </label>
        <button class="icon-btn" type="button" id="theme" aria-label="Alternar modo escuro">${icon('moon', 20)}</button>
      </header>
      <main id="conteudo" class="content">
        <section id="view-painel" class="view" aria-labelledby="view-title">
          <div class="kpis" id="kpis"></div>
          <div class="grid2">
            <article class="card">
              <header class="card__head"><h2 id="chart-title">Resumo</h2></header>
              <div class="chart-box"><canvas id="chart" aria-label="Gráfico do resumo" role="img"></canvas></div>
            </article>
            <article class="card">
              <header class="card__head"><h2>Últimos cadastros</h2></header>
              <ul class="recent" id="recent"></ul>
            </article>
          </div>
        </section>
        <section id="view-entity" class="view" hidden>
          <div class="toolbar">
            <p class="count" id="count"></p>
            <div class="toolbar__actions">
              <button class="btn btn--ghost" type="button" id="export">${icon('download', 18)} Exportar CSV</button>
              <button class="btn btn--primary" type="button" id="add">${icon('plus', 18)} <span id="add-label">Novo</span></button>
            </div>
          </div>
          <div class="card table-card">
            <div class="table-wrap">
              <table class="table">
                <thead id="thead"></thead>
                <tbody id="tbody"></tbody>
              </table>
            </div>
            <div class="empty" id="empty" hidden>
              ${icon('sparkle', 36)}
              <h2>Nada por aqui ainda</h2>
              <p>Clique em “Adicionar” para fazer o primeiro cadastro.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  </div>

  <dialog class="modal" id="modal" aria-labelledby="modal-title">
    <form id="form" novalidate>
      <header class="modal__head">
        <h2 id="modal-title">Novo</h2>
        <button class="icon-btn" type="button" data-close aria-label="Fechar">${icon('close', 20)}</button>
      </header>
      <div class="modal__body" id="form-fields"></div>
      <footer class="modal__foot">
        <button class="btn btn--ghost" type="button" data-close>Cancelar</button>
        <button class="btn btn--primary" type="submit">Salvar</button>
      </footer>
    </form>
  </dialog>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>

  <script type="application/json" id="app-config">${config(spec)}</script>
  <script src="${CHART_JS}" defer></script>
  <script src="app.js" defer></script>
</body>
</html>
`;
}

function css(spec) {
  const p = spec.palette;
  return `/* ${spec.name} — gerado pelo NEXIA Site Kit (ADR-Q-04) */
:root {
  --primary: ${p.primary};
  --accent: ${p.accent};
  --bg: #f4f6f8;
  --surface: #ffffff;
  --surface-2: #f8fafb;
  --text: #17202a;
  --muted: #64707d;
  --line: #e3e8ee;
  --sidebar: ${p.dark};
  --danger: #d64545;
  --ok: #1f9d67;
  --font-head: "${spec.fonts.heading}", system-ui, sans-serif;
  --font-body: "${spec.fonts.body}", system-ui, -apple-system, "Segoe UI", sans-serif;
  --radius: 14px;
  --shadow: 0 1px 2px rgba(16,24,40,.06), 0 8px 24px -12px rgba(16,24,40,.14);
  --ease: cubic-bezier(.2,.7,.2,1);
}
[data-theme="dark"] {
  --bg: #0f1419;
  --surface: #171d24;
  --surface-2: #1d252e;
  --text: #e7edf3;
  --muted: #95a3b2;
  --line: #2a3440;
  --shadow: 0 1px 2px rgba(0,0,0,.4), 0 10px 30px -12px rgba(0,0,0,.6);
}
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; font: 400 15px/1.55 var(--font-body); color: var(--text); background: var(--bg); transition: background-color .3s var(--ease), color .3s var(--ease); }
h1, h2, h3 { font-family: var(--font-head); line-height: 1.2; margin: 0; letter-spacing: -.01em; }
button, input, select, textarea { font: inherit; color: inherit; }
.i { flex-shrink: 0; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.skip { position: absolute; left: -999px; top: 8px; background: var(--primary); color: #fff; padding: 8px 14px; border-radius: 8px; z-index: 100; }
.skip:focus { left: 8px; }
:focus-visible { outline: 3px solid color-mix(in srgb, var(--primary) 55%, transparent); outline-offset: 2px; }

.shell { display: grid; grid-template-columns: 260px 1fr; min-height: 100vh; }
.sidebar { position: sticky; top: 0; height: 100vh; background: var(--sidebar); color: #dfe7ee; display: flex; flex-direction: column; padding: 22px 16px; }
.sidebar__brand { display: flex; align-items: center; gap: 12px; font: 700 18px/1.2 var(--font-head); color: #fff; padding: 4px 8px 22px; }
.logo { width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center; background: linear-gradient(135deg, var(--primary), var(--accent)); color: #fff; font-weight: 800; box-shadow: 0 8px 20px -8px var(--primary); }
.sidebar__nav { display: grid; gap: 4px; }
.sidebar__nav a { display: flex; align-items: center; gap: 12px; padding: 11px 12px; border-radius: 10px; color: inherit; text-decoration: none; opacity: .78; transition: background-color .2s var(--ease), opacity .2s var(--ease), transform .2s var(--ease); }
.sidebar__nav a:hover { opacity: 1; background: rgba(255,255,255,.07); transform: translateX(2px); }
.sidebar__nav a[aria-current="page"] { opacity: 1; background: color-mix(in srgb, var(--primary) 70%, transparent); color: #fff; }
.sidebar__foot { margin-top: auto; font-size: 12.5px; opacity: .6; padding: 0 8px; }
.sidebar__foot p { margin: 4px 0; }

.main { min-width: 0; display: flex; flex-direction: column; }
.topbar { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 16px; padding: 16px 28px; background: color-mix(in srgb, var(--bg) 85%, transparent); backdrop-filter: blur(10px); border-bottom: 1px solid var(--line); }
.topbar__title { flex: 1; min-width: 0; }
.topbar__title h1 { font-size: 22px; }
.topbar__title p { margin: 2px 0 0; color: var(--muted); font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.search { display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--line); border-radius: 999px; padding: 8px 14px; color: var(--muted); min-width: 240px; transition: border-color .2s var(--ease), box-shadow .2s var(--ease); }
.search:focus-within { border-color: var(--primary); box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 15%, transparent); }
.search input { border: 0; outline: 0; background: transparent; width: 100%; color: var(--text); }
.icon-btn { display: inline-grid; place-items: center; width: 40px; height: 40px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); cursor: pointer; transition: background-color .2s var(--ease), transform .15s var(--ease); }
.icon-btn:hover { background: var(--surface-2); }
.icon-btn:active { transform: scale(.95); }
.menu-btn { display: none; }

.content { padding: 28px; display: grid; gap: 24px; }
.view { display: grid; gap: 20px; animation: fade .35s var(--ease) both; }
.view[hidden], [hidden] { display: none !important; }
.btn { display: inline-flex; align-items: center; gap: 8px; border: 1px solid transparent; border-radius: 10px; padding: 10px 16px; font-weight: 600; cursor: pointer; text-decoration: none; transition: background-color .2s var(--ease), box-shadow .2s var(--ease), transform .15s var(--ease); }
.btn:active { transform: translateY(1px); }
.btn--primary { background: var(--primary); color: #fff; box-shadow: 0 8px 18px -10px var(--primary); }
.btn--primary:hover { background: color-mix(in srgb, var(--primary) 88%, #000); }
.btn--ghost { background: var(--surface); border-color: var(--line); }
.btn--ghost:hover { background: var(--surface-2); }
.btn--danger { background: var(--danger); color: #fff; }

.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); padding: 20px; }
.card__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.card__head h2 { font-size: 16px; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
.kpi { position: relative; overflow: hidden; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); padding: 18px 20px; animation: rise .5s var(--ease) both; transition: transform .2s var(--ease); }
.kpi:hover { transform: translateY(-3px); }
.kpi:nth-child(2) { animation-delay: .06s; } .kpi:nth-child(3) { animation-delay: .12s; } .kpi:nth-child(4) { animation-delay: .18s; }
.kpi::after { content: ""; position: absolute; right: -30px; top: -30px; width: 110px; height: 110px; border-radius: 50%; background: color-mix(in srgb, var(--primary) 10%, transparent); }
.kpi__label { color: var(--muted); font-size: 13px; font-weight: 500; margin: 0; }
.kpi__value { font: 800 30px/1.1 var(--font-head); margin: 8px 0 0; }
.kpi__icon { position: absolute; right: 18px; top: 18px; color: var(--primary); z-index: 1; }
.grid2 { display: grid; grid-template-columns: 1.6fr 1fr; gap: 16px; }
.chart-box { position: relative; height: 300px; }
.recent { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.recent li { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 10px; transition: background-color .2s var(--ease); }
.recent li:hover { background: var(--surface-2); }
.recent .av { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; font-weight: 700; font-size: 13px; color: #fff; background: linear-gradient(135deg, var(--primary), var(--accent)); flex-shrink: 0; }
.recent small { display: block; color: var(--muted); }

.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.toolbar__actions { display: flex; gap: 10px; }
.count { margin: 0; color: var(--muted); }
.table-card { padding: 0; overflow: hidden; }
.table-wrap { overflow-x: auto; }
.table { width: 100%; border-collapse: collapse; font-size: 14.5px; }
.table th { text-align: left; font-weight: 600; font-size: 12.5px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); background: var(--surface-2); padding: 12px 16px; border-bottom: 1px solid var(--line); white-space: nowrap; }
.table th button { all: unset; cursor: pointer; display: inline-flex; gap: 6px; align-items: center; }
.table th[aria-sort="ascending"] button::after { content: "▲"; font-size: 9px; }
.table th[aria-sort="descending"] button::after { content: "▼"; font-size: 9px; }
.table td { padding: 13px 16px; border-bottom: 1px solid var(--line); }
.table tbody tr { transition: background-color .15s var(--ease); animation: fade .3s var(--ease) both; }
.table tbody tr:hover { background: var(--surface-2); }
.table .actions { text-align: right; white-space: nowrap; }
.table .actions .icon-btn { width: 34px; height: 34px; margin-left: 4px; }
.badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12.5px; font-weight: 600; background: color-mix(in srgb, var(--primary) 14%, transparent); color: var(--primary); }
[data-theme="dark"] .badge { color: color-mix(in srgb, var(--primary) 50%, #fff); }
.muted { color: var(--muted); }
.empty { text-align: center; padding: 56px 20px; color: var(--muted); }
.empty h2 { color: var(--text); font-size: 18px; margin: 12px 0 6px; }

.modal { border: 0; padding: 0; border-radius: 18px; width: min(560px, calc(100vw - 32px)); background: var(--surface); color: var(--text); box-shadow: 0 30px 80px -20px rgba(0,0,0,.45); }
.modal[open] { animation: pop .25s var(--ease) both; }
.modal::backdrop { background: rgba(10,15,20,.55); backdrop-filter: blur(3px); }
.modal__head, .modal__foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 18px 22px; }
.modal__head { border-bottom: 1px solid var(--line); }
.modal__foot { border-top: 1px solid var(--line); justify-content: flex-end; }
.modal__body { padding: 20px 22px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px 16px; max-height: 65vh; overflow-y: auto; }
.field { display: grid; gap: 6px; }
.field--wide { grid-column: 1 / -1; }
.field label { font-weight: 600; font-size: 13.5px; }
.field input, .field select, .field textarea { width: 100%; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-2); transition: border-color .2s var(--ease), box-shadow .2s var(--ease); }
.field textarea { min-height: 90px; resize: vertical; }
.field input:focus, .field select:focus, .field textarea:focus { outline: 0; border-color: var(--primary); box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 15%, transparent); }
.field .err { color: var(--danger); font-size: 12.5px; min-height: 1em; }
.field.invalid input, .field.invalid select, .field.invalid textarea { border-color: var(--danger); }

.toast { position: fixed; left: 50%; bottom: 24px; transform: translate(-50%, calc(100% + 40px)); visibility: hidden; background: var(--text); color: var(--surface); padding: 12px 20px; border-radius: 12px; font-weight: 500; box-shadow: var(--shadow); transition: transform .35s var(--ease), visibility .35s; z-index: 60; }
.toast.show { transform: translate(-50%, 0); visibility: visible; }
.backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 39; }

@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes pop { from { opacity: 0; transform: scale(.96) translateY(10px); } to { opacity: 1; transform: none; } }

@media (max-width: 1100px) {
  .grid2 { grid-template-columns: 1fr; }
}
@media (max-width: 860px) {
  .shell { grid-template-columns: 1fr; }
  .sidebar { position: fixed; z-index: 40; left: 0; top: 0; width: 270px; transform: translateX(-100%); transition: transform .3s var(--ease); }
  .sidebar.open { transform: none; }
  .menu-btn { display: inline-grid; }
  .topbar { padding: 12px 16px; flex-wrap: wrap; }
  .search { order: 3; min-width: 0; width: 100%; }
  .content { padding: 16px; }
  .kpis { grid-template-columns: 1fr 1fr; gap: 12px; }
  .kpi { padding: 14px 16px; }
  .kpi__value { font-size: 24px; }
  .kpi::after { width: 70px; height: 70px; right: -20px; top: -20px; }
  .chart-box { height: 240px; }
  .modal__body { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
`;
}

const JS = `// Gerado pelo NEXIA Site Kit (ADR-Q-04). Dados salvos no navegador (localStorage).
(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const cfg = JSON.parse($('#app-config').textContent);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  // ---------- dados ----------
  let db;
  try { db = JSON.parse(localStorage.getItem(cfg.key) || 'null'); } catch (e) { db = null; }
  if (!db || typeof db !== 'object') {
    db = {};
    cfg.entities.forEach(e => { db[e.key] = (e.sample || []).map(r => Object.assign({ id: uid(), criado: Date.now() }, r)); });
  }
  cfg.entities.forEach(e => { if (!Array.isArray(db[e.key])) db[e.key] = []; });
  const save = () => { try { localStorage.setItem(cfg.key, JSON.stringify(db)); } catch (e) { toast('Não foi possível salvar neste navegador'); } };

  const num = v => { const n = parseFloat(String(v).replace(/[^0-9,.-]/g, '').replace(/\\.(?=.*[.,])/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };
  function show(f, v) {
    if (v === '' || v == null) return '<span class="muted">—</span>';
    if (f.type === 'money') return money.format(num(v));
    if (f.type === 'date') { const d = new Date(v + 'T00:00'); return isNaN(d) ? esc(v) : d.toLocaleDateString('pt-BR'); }
    if (f.type === 'select') return '<span class="badge">' + esc(v) + '</span>';
    return esc(v);
  }

  // ---------- interface ----------
  const toastEl = $('#toast');
  let toastT;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 2600); }

  const sidebar = $('#sidebar'), menuBtn = $('.menu-btn'), backdrop = $('.backdrop');
  function menu(open) { sidebar.classList.toggle('open', open); menuBtn.setAttribute('aria-expanded', String(open)); backdrop.hidden = !open; }
  menuBtn.addEventListener('click', () => menu(!sidebar.classList.contains('open')));
  backdrop.addEventListener('click', () => menu(false));

  $('#theme').addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme !== 'dark';
    if (dark) document.documentElement.dataset.theme = 'dark'; else delete document.documentElement.dataset.theme;
    try { localStorage.setItem('nexia-theme', dark ? 'dark' : 'light'); } catch (e) {}
    drawChart();
  });

  // ---------- rotas ----------
  let current = null, sort = { key: null, dir: 1 }, editing = null;
  const search = $('#search');
  function route() {
    const r = (location.hash.replace(/^#\\/?/, '') || 'painel');
    current = cfg.entities.find(e => e.key === r) || null;
    $$('.sidebar__nav a').forEach(a => a.toggleAttribute('aria-current', a.dataset.route === (current ? current.key : 'painel')));
    $$('.sidebar__nav a[aria-current]').forEach(a => a.setAttribute('aria-current', 'page'));
    $('#view-painel').hidden = !!current;
    $('#view-entity').hidden = !current;
    search.value = '';
    sort = { key: null, dir: 1 };
    menu(false);
    if (current) {
      $('#view-title').textContent = current.label;
      $('#view-sub').textContent = 'Cadastre, edite e acompanhe ' + current.label.toLowerCase();
      $('#add-label').textContent = 'Adicionar ' + current.singular.toLowerCase();
      renderTable();
    } else {
      $('#view-title').textContent = 'Painel';
      $('#view-sub').textContent = cfg.name + ' — visão geral';
      renderDashboard();
    }
  }
  window.addEventListener('hashchange', route);
  search.addEventListener('input', () => (current ? renderTable() : null));

  // ---------- tabela ----------
  function rows() {
    const q = search.value.trim().toLowerCase();
    let list = db[current.key].slice();
    if (q) list = list.filter(r => current.fields.some(f => String(r[f.key] || '').toLowerCase().includes(q)));
    if (sort.key) {
      const f = current.fields.find(x => x.key === sort.key);
      list.sort((a, b) => {
        const va = a[sort.key] || '', vb = b[sort.key] || '';
        const c = f && (f.type === 'number' || f.type === 'money') ? num(va) - num(vb) : String(va).localeCompare(String(vb), 'pt-BR', { numeric: true });
        return c * sort.dir;
      });
    } else list.sort((a, b) => (b.criado || 0) - (a.criado || 0));
    return list;
  }
  function renderTable() {
    const cols = current.fields.filter(f => f.type !== 'textarea').slice(0, 6);
    $('#thead').innerHTML = '<tr>' + cols.map(f => '<th scope="col"' + (sort.key === f.key ? ' aria-sort="' + (sort.dir > 0 ? 'ascending' : 'descending') + '"' : '') + '><button type="button" data-sort="' + f.key + '">' + esc(f.label) + '</button></th>').join('') + '<th scope="col" class="actions"><span class="sr-only">Ações</span></th></tr>';
    const list = rows();
    $('#tbody').innerHTML = list.map(r => '<tr>' + cols.map(f => '<td data-label="' + esc(f.label) + '">' + show(f, r[f.key]) + '</td>').join('') +
      '<td class="actions"><button class="icon-btn" type="button" data-edit="' + r.id + '" aria-label="Editar">${icon('edit', 16).replace(/'/g, "\\'")}</button><button class="icon-btn" type="button" data-del="' + r.id + '" aria-label="Excluir">${icon('trash', 16).replace(/'/g, "\\'")}</button></td></tr>').join('');
    $('#empty').hidden = list.length > 0;
    const total = db[current.key].length;
    $('#count').textContent = (list.length === total ? total : list.length + ' de ' + total) + ' ' + (total === 1 ? current.singular.toLowerCase() : current.label.toLowerCase());
  }
  $('#thead').addEventListener('click', e => {
    const b = e.target.closest('[data-sort]');
    if (!b) return;
    sort = sort.key === b.dataset.sort ? { key: b.dataset.sort, dir: -sort.dir } : { key: b.dataset.sort, dir: 1 };
    renderTable();
  });
  $('#tbody').addEventListener('click', e => {
    const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
    if (ed) openForm(db[current.key].find(r => r.id === ed.dataset.edit));
    if (del && confirm('Excluir este registro? Essa ação não pode ser desfeita.')) {
      db[current.key] = db[current.key].filter(r => r.id !== del.dataset.del);
      save(); renderTable(); toast('Registro excluído');
    }
  });
  $('#export').addEventListener('click', () => {
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const csv = [current.fields.map(f => q(f.label)).join(';')].concat(rows().map(r => current.fields.map(f => q(r[f.key])).join(';'))).join('\\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = current.key + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  // ---------- formulário ----------
  const modal = $('#modal'), form = $('#form');
  const inputType = { number: 'number', money: 'text', date: 'date', email: 'email', phone: 'tel', text: 'text' };
  function openForm(rec) {
    editing = rec || null;
    $('#modal-title').textContent = (rec ? 'Editar ' : 'Adicionar ') + current.singular.toLowerCase();
    $('#form-fields').innerHTML = current.fields.map(f => {
      const v = rec ? rec[f.key] || '' : '';
      const id = 'f-' + f.key, req = f.required ? ' required' : '';
      let control;
      if (f.type === 'select') control = '<select id="' + id + '" name="' + f.key + '"' + req + '><option value="">Selecione...</option>' + f.options.map(o => '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>';
      else if (f.type === 'textarea') control = '<textarea id="' + id + '" name="' + f.key + '"' + req + '>' + esc(v) + '</textarea>';
      else control = '<input id="' + id + '" name="' + f.key + '" type="' + (inputType[f.type] || 'text') + '"' + (f.type === 'money' ? ' inputmode="decimal" placeholder="0,00"' : '') + ' value="' + esc(v) + '"' + req + '>';
      return '<div class="field' + (f.type === 'textarea' ? ' field--wide' : '') + '"><label for="' + id + '">' + esc(f.label) + (f.required ? ' *' : '') + '</label>' + control + '<span class="err" aria-live="polite"></span></div>';
    }).join('');
    modal.showModal();
    const first = $('input, select, textarea', form);
    if (first) first.focus();
  }
  $('#add').addEventListener('click', () => openForm(null));
  $$('[data-close]', modal).forEach(b => b.addEventListener('click', () => modal.close()));
  form.addEventListener('submit', e => {
    e.preventDefault();
    let ok = true;
    const rec = {};
    current.fields.forEach(f => {
      const el = form.elements[f.key], box = el.closest('.field'), v = el.value.trim();
      let err = '';
      if (f.required && !v) err = 'Campo obrigatório';
      else if (v && f.type === 'email' && !/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(v)) err = 'E-mail inválido';
      else if (v && f.type === 'phone' && v.replace(/\\D/g, '').length < 10) err = 'Telefone com DDD';
      else if (v && (f.type === 'number' || f.type === 'money') && isNaN(num(v))) err = 'Número inválido';
      box.classList.toggle('invalid', !!err);
      $('.err', box).textContent = err;
      if (err && ok) { ok = false; el.focus(); }
      rec[f.key] = v;
    });
    if (!ok) return;
    if (editing) Object.assign(editing, rec);
    else db[current.key].push(Object.assign({ id: uid(), criado: Date.now() }, rec));
    save(); modal.close(); renderTable();
    toast(editing ? 'Alterações salvas' : 'Cadastro salvo');
  });

  // ---------- painel ----------
  let chart;
  function renderDashboard() {
    const kpis = cfg.entities.slice(0, 3).map((e, i) => ({ label: e.label, value: db[e.key].length, icon: i }));
    const mf = cfg.entities.map(e => ({ e, f: e.fields.find(f => f.type === 'money') })).find(x => x.f);
    if (mf) kpis.push({ label: mf.f.label + ' (total)', value: money.format(db[mf.e.key].reduce((s, r) => s + num(r[mf.f.key]), 0)), icon: 3 });
    else kpis.push({ label: 'Cadastros na semana', value: cfg.entities.reduce((s, e) => s + db[e.key].filter(r => Date.now() - (r.criado || 0) < 6048e5).length, 0), icon: 3 });
    const icons = ['${icon('list', 22).replace(/'/g, "\\'")}', '${icon('grid', 22).replace(/'/g, "\\'")}', '${icon('clock', 22).replace(/'/g, "\\'")}', '${icon('chart', 22).replace(/'/g, "\\'")}'];
    $('#kpis').innerHTML = kpis.map(k => '<div class="kpi"><span class="kpi__icon">' + icons[k.icon] + '</span><p class="kpi__label">' + esc(k.label) + '</p><p class="kpi__value" data-count="' + (typeof k.value === 'number' ? k.value : '') + '">' + esc(k.value) + '</p></div>').join('');
    $$('[data-count]').forEach(el => {
      const end = Number(el.dataset.count);
      if (!el.dataset.count || !end) return;
      const t0 = performance.now();
      const step = t => { const p = Math.min((t - t0) / 700, 1); el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
    const recent = [];
    cfg.entities.forEach(e => db[e.key].forEach(r => recent.push({ e, r })));
    recent.sort((a, b) => (b.r.criado || 0) - (a.r.criado || 0));
    $('#recent').innerHTML = recent.slice(0, 6).map(({ e, r }) => {
      const title = r[e.fields[0].key] || e.singular;
      const sub = e.fields.slice(1, 3).map(f => r[f.key]).filter(Boolean).join(' · ');
      const ini = String(title).split(/\\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
      return '<li><span class="av" aria-hidden="true">' + esc(ini) + '</span><div><strong>' + esc(title) + '</strong><small>' + esc(e.singular) + (sub ? ' · ' + esc(sub) : '') + '</small></div></li>';
    }).join('') || '<li>Nenhum cadastro ainda.</li>';
    drawChart();
  }
  function chartData() {
    // Gráfico pelo campo que resume melhor (status, situação, tipo...); senão o primeiro de opções.
    const pick = e => e.fields.find(x => x.type === 'select' && /status|situa|etapa|tipo|categoria|fase|prioridade/i.test(x.key + ' ' + x.label)) || e.fields.find(x => x.type === 'select');
    for (const e of cfg.entities) {
      const f = pick(e);
      if (f && db[e.key].length) {
        const labels = f.options.length ? f.options : Array.from(new Set(db[e.key].map(r => r[f.key]).filter(Boolean)));
        return { title: e.label + ' por ' + f.label.toLowerCase(), labels, values: labels.map(l => db[e.key].filter(r => r[f.key] === l).length) };
      }
    }
    return { title: 'Cadastros por seção', labels: cfg.entities.map(e => e.label), values: cfg.entities.map(e => db[e.key].length) };
  }
  function drawChart() {
    if (!window.Chart || current) return;
    const d = chartData(), css = getComputedStyle(document.documentElement);
    $('#chart-title').textContent = d.title;
    const primary = css.getPropertyValue('--primary').trim(), accent = css.getPropertyValue('--accent').trim(), muted = css.getPropertyValue('--muted').trim(), line = css.getPropertyValue('--line').trim();
    if (chart) chart.destroy();
    chart = new window.Chart($('#chart'), {
      type: 'bar',
      data: { labels: d.labels, datasets: [{ data: d.values, backgroundColor: d.labels.map((_, i) => (i % 2 ? accent : primary)), borderRadius: 8, maxBarThickness: 48 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { x: { ticks: { color: muted }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: muted, precision: 0 }, grid: { color: line } } } },
    });
  }
  window.addEventListener('load', drawChart);

  route();
})();
`;

function renderApp(spec) {
  return { 'index.html': html(spec), 'styles.css': css(spec), 'app.js': JS };
}

module.exports = { renderApp };
