// Teste "humano" do Fortune no navegador (celular), com API e Firebase falsos. Uso: node scripts/fortune-teste-humano.js normal|corretora|rascunho|rascunho-velho|aba-velha|erro500|vazio|lento
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const RAIZ = path.join(__dirname, '..');
const SAIDA = path.join(RAIZ, 'test-results', 'fortune');
fs.mkdirSync(SAIDA, { recursive: true });
const FIREBASE = `window.firebase={apps:[],initializeApp(){this.apps.push(1)},auth(){const u={uid:'u1',getIdToken:async()=>'t'};return{onAuthStateChanged(cb){setTimeout(()=>cb(window.__semLogin?null:u),50)},signInWithPopup:async()=>{},getRedirectResult:async()=>null,signOut(){}}}};window.firebase.auth.GoogleAuthProvider=function(){};`;
(async () => {
  const cen = process.argv[2] || 'normal';
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile', serviceWorkers: 'block' });
  const p = await ctx.newPage();
  const erros = [];
  p.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
  let carteira = [];
  const api = require(path.join(RAIZ, 'netlify/functions/prumo.js'));
  const dados = new Map();
  const col = (c) => ({ doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { dados.set(`${c}/${id}`, v); }, delete: async () => { dados.delete(`${c}/${id}`); }, get: async () => { const v = dados.get(`${c}/${id}`); return { exists: !!v, data: () => v }; } }),
    get: async () => ({ docs: [...dados.entries()].filter(([k]) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }) });
  api.deps.db = () => ({ collection: col });
  const db = { objetivos: [] };
  await p.route('**/*', async (r) => {
    const u = new URL(r.request().url());
    if (u.hostname.includes('gstatic')) return r.fulfill({ body: u.pathname.includes('app-compat') ? FIREBASE : '', contentType: 'text/javascript' });
    if (u.pathname === '/api/firebase-config') return r.fulfill({ json: { apiKey: 'x' } });
    if (u.pathname === '/api/prumo') {
      const body = JSON.parse(r.request().postData() || '{}');
      if (cen === 'lento' && body.acao === 'carteira_listar') await new Promise((ok) => setTimeout(ok, 40000));
      if (cen === 'erro500') return r.fulfill({ status: 500, json: { error: 'Falha no servidor.' } });
      if (cen === 'vazio' && body.acao === 'carteira_listar') return r.fulfill({ status: 200, body: '' });
      const a = body.acao;
      if (a === 'carteira_listar') return r.fulfill({ json: { itens: carteira } });
      if (a === 'objetivo_listar') return r.fulfill({ json: { objetivos: db.objetivos } });
      if (a === 'avisos') return r.fulfill({ json: { avisos: [] } });
      if (a === 'carteira_salvar') { const it = { ...body }; delete it.acao; it.id = it.id || 'i' + carteira.length; carteira = carteira.filter((x) => x.id !== it.id).concat(it); return r.fulfill({ json: { ok: true, id: it.id, item: it } }); }
      if (a === 'carteira_limpar') { if (body.confirmar !== 'LIMPAR') return r.fulfill({ status: 400, json: { erro: 'x' } }); const n = carteira.length; carteira = []; return r.fulfill({ json: { ok: true, apagados: n } }); }
      if (a === 'ler_print' && cen === 'corretora') return r.fulfill({ json: { itens: [
        { nome: 'MXRF11', ticker: 'MXRF11', banco: 'XP', tipo: 'fiis', valor: 6000, quantidade: 600, preco_medio: 9.5, cotacao: 10 },
        { nome: 'PETR4', ticker: 'PETR4', banco: 'XP', tipo: 'acoes', valor: 3000, quantidade: 80 },
        { nome: 'MXRF11', ticker: 'MXRF11', banco: 'XP', tipo: 'fiis', valor: 6000, quantidade: 600 },
      ], descartados: [], conferencia: [{ total_print: 10000, soma_itens: 15000, confere: false }] } });
      if (a === 'ler_print') return r.fulfill({ json: { itens: [{ nome: 'CDB Teste', banco: 'XP', tipo: 'renda_fixa', valor: 1000 + body.imagens.length, data_valor: '2026-11-03' }], descartados: [] } });
      // O resto vai para o código real da API, com banco falso na memória.
      const [st, js] = await api.agir('u1', body);
      return r.fulfill({ status: st, json: js });
    }
    if (u.pathname.startsWith('/prumo/')) { const f = path.join(RAIZ, u.pathname === '/prumo/' ? '/prumo/index.html' : u.pathname); if (fs.existsSync(f)) return r.fulfill({ path: f }); return r.fulfill({ status: 404, body: '' }); }
    return r.fulfill({ status: 404, body: '' });
  });
  if (cen === 'rascunho-velho') await p.addInitScript(() => { try { localStorage.setItem('fortune-lidos', '{"itens":[{"nome":"X"}]'); localStorage.setItem('prumo-aba', 'carteira'); } catch {} });
  if (cen === 'rascunho') await p.addInitScript(() => { try { localStorage.setItem('fortune-lidos', JSON.stringify({ itens: [{ nome: 'CDB', banco: 'XP', tipo: 'renda_fixa', valor: 10 }] })); } catch {} });
  if (cen === 'aba-velha') await p.addInitScript(() => { try { localStorage.setItem('prumo-aba', 'nao-existe'); } catch {} });
  await p.goto('http://local.test/prumo/');
  await p.waitForTimeout(cen === 'lento' ? 30000 : 2500);
  await p.screenshot({ path: path.join(SAIDA, cen + '-1.png') });
  const txt = (await p.textContent('#conteudo')).trim().slice(0, 160);
  console.log(cen, '| conteudo:', JSON.stringify(txt), '| erros:', erros.join(' ; ') || 'nenhum');
  if (cen === 'corretora') {
    const somar = () => carteira.reduce((t, x) => t + Number(x.valor), 0);
    const mandar = async (nome) => {
      const fc = p.waitForEvent('filechooser'); await p.click('#print'); const ch = await fc;
      await ch.setFiles([path.join(RAIZ, 'tests/fixtures/prumo-print-exemplo.jpg')]);
      await p.waitForTimeout(2000); await p.screenshot({ path: path.join(SAIDA, nome + '.png'), fullPage: true });
      const t = await p.textContent('#conteudo');
      console.log(nome, '| aviso soma:', t.includes('não bate'), '| novo:', (t.match(/🆕/g) || []).length, '| atualiza:', (t.match(/🔄/g) || []).length, '| repetido:', (t.match(/⚠️ Repetido/g) || []).length);
      await p.click('#salvar'); await p.waitForTimeout(1500);
      console.log(nome, '| salvos:', carteira.length, 'itens, soma', somar(), '| tela:', (await p.textContent('#conteudo')).trim().slice(0, 40));
    };
    await mandar('corretora-1'); await mandar('corretora-2');
    p.once('dialog', (d) => d.accept('LIMPAR'));
    await p.click('#limpar'); await p.waitForTimeout(1500);
    console.log('limpar | itens:', carteira.length, '| tela:', (await p.textContent('#conteudo')).trim().slice(0, 50));
    await p.screenshot({ path: path.join(SAIDA, 'corretora-3-limpo.png') });
    console.log('erros finais:', erros.join(' ; ') || 'nenhum');
  }
  if (cen === 'normal') {
    const fc = p.waitForEvent('filechooser'); await p.click('#print'); const ch = await fc;
    const img = path.join(RAIZ, 'tests/fixtures/prumo-print-exemplo.jpg');
    await ch.setFiles([img, img, img, img, img, img, img]);
    await p.waitForTimeout(2500); await p.screenshot({ path: path.join(SAIDA, 'normal-2-conferir.png') });
    console.log('conferir:', (await p.textContent('#conteudo')).trim().slice(0, 120));
    await p.click('#abas button[data-aba="gastos"]'); await p.waitForTimeout(800); await p.click('#abas button[data-aba="carteira"]'); await p.waitForTimeout(1200);
    console.log('volta carteira:', (await p.textContent('#conteudo')).trim().slice(0, 80));
    await p.click('#salvar'); await p.waitForTimeout(1500); await p.screenshot({ path: path.join(SAIDA, 'normal-3-salvo.png') });
    console.log('salvo:', (await p.textContent('#conteudo')).trim().slice(0, 120));
    for (const a of ['gastos', 'compras', 'objetivos', 'orcamento', 'consultor', 'pontos']) { await p.click(`#abas button[data-aba="${a}"]`); await p.waitForTimeout(1200); console.log('aba', a, ':', JSON.stringify((await p.textContent('#conteudo')).trim().slice(0, 60))); await p.screenshot({ path: path.join(SAIDA, 'aba-' + a + '.png') }); }
    console.log('erros finais:', erros.join(' ; ') || 'nenhum');
  }
  await b.close();
})();
