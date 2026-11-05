// Teste "humano" do Kernex Finance no navegador (celular), com Firebase, banco e IA falsos.
// Fluxo: Início vazio -> enviar fatura -> conferir -> gravar -> Início com números -> modo privacidade.
// Uso: node scripts/kernex-finance-teste-humano.js   (fotos em test-results/kernex-finance)
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const RAIZ = path.join(__dirname, '..');
const SAIDA = path.join(RAIZ, 'test-results', 'kernex-finance');
fs.mkdirSync(SAIDA, { recursive: true });
const FIREBASE = `window.firebase={apps:[],initializeApp(){this.apps.push(1)},auth(){const u={uid:'u1',getIdToken:async()=>'t'};return{onAuthStateChanged(cb){setTimeout(()=>cb(window.__semLogin?null:u),50)},signInWithPopup:async()=>{},getRedirectResult:async()=>null,signOut(){}}}};window.firebase.auth.GoogleAuthProvider=function(){};`;
const LIDO = { tipo_documento: 'fatura', instituicao: 'Nubank', lancamentos: [
  { data: '2026-11-02', valor: 100, estabelecimento: 'Mercado Zé', descricao: 'Mercado Zé', tipo: 'despesa', categoria: 'alimentacao', confianca: 0.95 },
  { data: '2026-11-02', valor: 100, estabelecimento: 'MERCADO ZE', descricao: 'MERCADO ZE', tipo: 'despesa', categoria: 'alimentacao', confianca: 0.95 },
  { data: '2026-11-03', valor: 89.9, estabelecimento: 'Streaming', descricao: 'Streaming', tipo: 'despesa', categoria: 'assinaturas', confianca: 0.9 },
  { data: '2026-11-04', valor: 240, descricao: 'Compra borrada', tipo: 'despesa', categoria: 'compras', confianca: 0.4 },
  { data: '2026-11-05', valor: 2000, descricao: 'Pagamento fatura', tipo: 'pagamento_fatura' },
  { data: '2026-11-01', valor: 5000, descricao: 'Salário', tipo: 'receita', categoria: 'renda', confianca: 0.99 },
] };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile', serviceWorkers: 'block' });
  const p = await ctx.newPage();
  const erros = []; const passos = [];
  p.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.push('console: ' + m.text()); });
  const api = require(path.join(RAIZ, 'netlify/functions/prumo.js'));
  const dados = new Map();
  const col = (c) => ({ doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { dados.set(`${c}/${id}`, v); }, delete: async () => { dados.delete(`${c}/${id}`); }, get: async () => { const v = dados.get(`${c}/${id}`); return { exists: !!v, data: () => v }; } }),
    get: async () => ({ docs: [...dados.entries()].filter(([k]) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }) });
  api.deps.db = () => ({ collection: col });
  api.deps.agora = () => new Date('2026-11-05T12:00:00Z');
  api.deps.getRouter = () => ({ capabilities: () => ({ available: true, vision: true }), chat: async () => ({ text: JSON.stringify(LIDO) }) });
  api.deps.listFor = () => [];
  await p.route('**/*', async (r) => {
    const u = new URL(r.request().url());
    if (u.hostname.includes('gstatic')) return r.fulfill({ body: u.pathname.includes('app-compat') ? FIREBASE : '', contentType: 'text/javascript' });
    if (u.pathname === '/api/firebase-config') return r.fulfill({ json: { apiKey: 'x' } });
    if (u.pathname === '/api/prumo') { const [st, js] = await api.agir('u1', JSON.parse(r.request().postData() || '{}')); return r.fulfill({ status: st, json: js }); }
    if (u.pathname.startsWith('/prumo/')) { const f = path.join(RAIZ, u.pathname === '/prumo/' ? '/prumo/index.html' : u.pathname); if (fs.existsSync(f)) return r.fulfill({ path: f }); }
    return r.fulfill({ status: 404, body: '' });
  });
  const ok = (cond, msg) => { passos.push((cond ? 'OK   ' : 'FALHA ') + msg); if (!cond) erros.push('falhou: ' + msg); };
  const foto = path.join(SAIDA, 'fatura.png');
  fs.writeFileSync(foto, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
  await p.goto('http://x.test/prumo/');
  await p.waitForSelector('#tela-app:not([hidden])');
  await p.waitForSelector('#kf-doc');
  ok((await p.title()) === 'Kernex Finance', 'título é Kernex Finance');
  ok(/Patrimônio líquido/.test(await p.textContent('#conteudo')), 'Início mostra patrimônio líquido');
  ok(/Envie seu primeiro documento/.test(await p.textContent('#conteudo')), 'Início vazio convida a enviar documento');
  await p.screenshot({ path: path.join(SAIDA, '1-inicio-vazio.png') });
  await p.click('#kf-doc');
  await p.waitForSelector('#kf-arq');
  await p.setInputFiles('#kf-arq', foto);
  await p.click('#kf-ler');
  await p.waitForSelector('#kf-grava', { timeout: 20000 });
  const texto = await p.textContent('#kf-res');
  ok(/Fatura de cartão lido/.test(texto), 'documento reconhecido como fatura');
  ok(/precisam da sua conferência/.test(texto), 'itens duvidosos pedem conferência');
  ok((await p.$$('#kf-linhas .item')).length === 6, '6 linhas: 4 prontas + a duplicata + a compra borrada para conferir');
  ok(await p.evaluate(() => [...document.querySelectorAll('#kf-linhas .item')].filter((d) => !d.querySelector('[data-inc]').checked).length === 2), 'duplicata e compra borrada vêm desmarcadas');
  await p.screenshot({ path: path.join(SAIDA, '2-conferir.png') });
  await p.click('#kf-grava');
  await p.waitForFunction(() => document.querySelector('#conteudo').textContent.includes('Lançamentos de'));
  await p.waitForSelector('.item .v');
  ok(!/Compra borrada/.test(await p.textContent('#conteudo')), 'item duvidoso não foi gravado sem marcar');
  await p.screenshot({ path: path.join(SAIDA, '3-lancamentos.png') });
  await p.click('[data-aba=inicio]');
  await p.waitForSelector('#kf-doc');
  const ini = await p.textContent('#conteudo');
  ok(/R\$\s?5\.000,00/.test(ini), 'Início: receita R$ 5.000,00');
  ok(/R\$\s?189,90/.test(ini), 'Início: gasto R$ 189,90 (mercado 1x + streaming; fatura paga não conta)');
  ok(/R\$\s?4\.810,10/.test(ini), 'Início: economia R$ 4.810,10');
  await p.screenshot({ path: path.join(SAIDA, '4-inicio-cheio.png') });
  await p.click('#olho');
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => document.body.classList.contains('privado') && getComputedStyle(document.querySelector('#conteudo .valor')).filter.includes('blur')), 'modo privacidade borra os valores');
  await p.screenshot({ path: path.join(SAIDA, '5-privacidade.png') });
  for (const a of ['carteira', 'gastos', 'compras', 'objetivos', 'orcamento', 'consultor', 'pontos']) {
    await p.click(`[data-aba=${a}]`); await p.waitForTimeout(400);
    ok(!/Não consegui carregar|abriu vazia/.test(await p.textContent('#conteudo')) && (await p.textContent('#conteudo')).trim().length > 5, `aba antiga ${a} continua abrindo`);
  }
  await b.close();
  console.log(passos.join('\n'));
  if (erros.length) { console.log('\nERROS:\n' + erros.join('\n')); process.exit(1); }
  console.log('\nTudo certo. Fotos em ' + SAIDA);
})();
