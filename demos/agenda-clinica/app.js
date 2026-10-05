// Gerado pelo NEXIA Site Kit (ADR-Q-04). Dados salvos no navegador (localStorage).
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

  const num = v => { const n = parseFloat(String(v).replace(/[^0-9,.-]/g, '').replace(/\.(?=.*[.,])/g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };
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
    const r = (location.hash.replace(/^#\/?/, '') || 'painel');
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
      '<td class="actions"><button class="icon-btn" type="button" data-edit="' + r.id + '" aria-label="Editar"><svg class="i" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button><button class="icon-btn" type="button" data-del="' + r.id + '" aria-label="Excluir"><svg class="i" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg></button></td></tr>').join('');
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
    const csv = [current.fields.map(f => q(f.label)).join(';')].concat(rows().map(r => current.fields.map(f => q(r[f.key])).join(';'))).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
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
      else if (v && f.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) err = 'E-mail inválido';
      else if (v && f.type === 'phone' && v.replace(/\D/g, '').length < 10) err = 'Telefone com DDD';
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
    const icons = ['<svg class="i" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>', '<svg class="i" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>', '<svg class="i" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>', '<svg class="i" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/></svg>'];
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
      const ini = String(title).split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
      return '<li><span class="av" aria-hidden="true">' + esc(ini) + '</span><div><strong>' + esc(title) + '</strong><small>' + esc(e.singular) + (sub ? ' · ' + esc(sub) : '') + '</small></div></li>';
    }).join('') || '<li>Nenhum cadastro ainda.</li>';
    drawChart();
  }
  function chartData() {
    for (const e of cfg.entities) {
      const f = e.fields.find(x => x.type === 'select');
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
