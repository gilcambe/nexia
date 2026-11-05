// Teste "humano" do Kernex Finance no navegador (celular): API real com banco e IA falsos. Uso: node scripts/kf-teste-humano.js
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const RAIZ = path.join(__dirname, '..');
const SAIDA = path.join(RAIZ, 'test-results', 'kf'); fs.mkdirSync(SAIDA, { recursive: true });
const FIREBASE = `window.firebase={apps:[],initializeApp(){this.apps.push(1)},auth(){const u={uid:'u1',getIdToken:async()=>'t'};return{onAuthStateChanged(cb){setTimeout(()=>cb(window.__semLogin?null:u),50)},signInWithPopup:async()=>{},getRedirectResult:async()=>null,signOut(){}}}};window.firebase.auth.GoogleAuthProvider=function(){};`;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  const erros = [];
  p.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.push('console: ' + m.text()); });
  const api = require(path.join(RAIZ, 'netlify/functions/prumo.js'));
  const dados = new Map();
  const col = (c) => ({ doc: (id) => ({ collection: (n) => col(`${c}/${id}/${n}`), set: async (v) => { dados.set(`${c}/${id}`, v); }, delete: async () => { dados.delete(`${c}/${id}`); }, get: async () => { const v = dados.get(`${c}/${id}`); return { exists: !!v, data: () => v }; } }),
    get: async () => ({ docs: [...dados.entries()].filter(([k]) => k.startsWith(c + '/') && !k.slice(c.length + 1).includes('/')).map(([k, v]) => ({ id: k.split('/').pop(), data: () => v })) }) });
  api.deps.db = () => ({ collection: col });
  api.deps.listFor = () => [{ provider: 'google', model: 'fake' }];
  const IA = { documento: 'fatura', instituicao: 'Nubank', total_documento: 230, lancamentos: [
    { data: '2026-11-02', descricao: 'Mercado Zé', estabelecimento: 'Mercado Zé', valor: 130, tipo: 'despesa', categoria: 'alimentacao', confianca: 0.97 },
    { data: '2026-11-03', descricao: 'Cinema', valor: 100, tipo: 'despesa', categoria: 'lazer', confianca: 0.9 },
    { data: '2026-11-04', descricao: 'Borrado', valor: 50, tipo: 'despesa', confianca: 0.3 } ] };
  api.deps.getRouter = () => ({ capabilities: () => ({ available: true, vision: true }), chat: async () => ({ text: JSON.stringify(IA) }) });
  await p.route('**/*', async (r) => {
    const u = new URL(r.request().url());
    if (u.hostname.includes('gstatic')) return r.fulfill({ body: u.pathname.includes('app-compat') ? FIREBASE : '', contentType: 'text/javascript' });
    if (u.pathname === '/api/firebase-config') return r.fulfill({ json: { apiKey: 'x' } });
    if (u.pathname === '/api/prumo') { const [st, js] = await api.agir('u1', JSON.parse(r.request().postData() || '{}')); return r.fulfill({ status: st, json: js }); }
    if (u.pathname.startsWith('/prumo/')) { const f = path.join(RAIZ, u.pathname === '/prumo/' ? '/prumo/index.html' : u.pathname); if (fs.existsSync(f)) return r.fulfill({ path: f }); }
    return r.fulfill({ status: 404, body: '' });
  });
  const falhas = [];
  const confere = (ok, msg) => { console.log((ok ? 'OK   ' : 'FALHA ') + msg); if (!ok) falhas.push(msg); };
  const aba = async (nome) => { await p.click(`#abas button[data-aba="${nome}"]`); await p.waitForTimeout(700); };
  await p.goto('http://localhost/prumo/'); await p.waitForTimeout(900);
  confere(await p.locator('#conteudo').innerText().then((t) => /Patrimônio líquido/.test(t)), 'abre direto no Início com o painel');
  await p.screenshot({ path: path.join(SAIDA, '1-inicio-vazio.png') });
  // contas e dívidas
  await aba('contas');
  await p.click('#nconta'); await p.fill('dialog input[name=nome]', 'Itaú'); await p.fill('dialog input[name=saldo]', '2000'); await p.click('dialog [data-x=salvar]'); await p.waitForTimeout(700);
  await p.click('#ndiv'); await p.fill('dialog input[name=nome]', 'Cartão'); await p.fill('dialog input[name=saldo]', '1000'); await p.fill('dialog input[name=juros_mes]', '10'); await p.fill('dialog input[name=parcela_minima]', '100'); await p.click('dialog [data-x=salvar]'); await p.waitForTimeout(900);
  confere(/Itaú/.test(await p.locator('#conteudo').innerText()) && /Cartão/.test(await p.locator('#conteudo').innerText()), 'conta e dívida cadastradas');
  await p.fill('#extra', '200'); await p.click('#calc'); await p.waitForTimeout(600);
  confere(/Avalanche/.test(await p.locator('#res').innerText()), 'plano de quitação aparece');
  await p.screenshot({ path: path.join(SAIDA, '2-contas.png') });
  // documento
  await aba('documentos');
  const png = path.join(SAIDA, 'doc.png'); fs.writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
  await p.setInputFiles('#arq', png); await p.click('#ler'); await p.waitForTimeout(1500);
  const conf = await p.locator('#conf').innerText();
  confere(/Mercado Zé/.test(conf) && /Cinema/.test(conf) && /Borrado/.test(conf) && /confiança/.test(conf), 'conferência mostra o lido e o duvidoso, sem gravar');
  confere([...dados.keys()].every((k) => !k.includes('/lancamentos/')), 'nada gravado antes de confirmar');
  await p.screenshot({ path: path.join(SAIDA, '3-conferir.png') });
  await p.click('#salvar'); await p.waitForTimeout(1200);
  confere([...dados.keys()].filter((k) => k.includes('/lancamentos/')).length === 2, 'só os 2 marcados foram salvos (o duvidoso ficou de fora)');
  // painel com dados
  await aba('inicio'); await p.waitForTimeout(500);
  const ini = await p.locator('#conteudo').innerText();
  confere(/Gasto do mês/.test(ini) && /230/.test(ini.replace(/\./g, '')), 'painel mostra os gastos do mês lidos do documento');
  await p.screenshot({ path: path.join(SAIDA, '4-inicio-com-dados.png') });
  // privacidade
  await p.click('#olho'); await p.waitForTimeout(300);
  const borrados = await p.locator('.valor').count();
  confere(borrados > 3 && await p.evaluate(() => document.body.classList.contains('privado')), `modo privacidade borra os valores (${borrados} valores)`);
  await p.screenshot({ path: path.join(SAIDA, '5-privacidade.png') });
  await p.click('#olho');
  // ferramentas
  await aba('ferramentas');
  await p.fill('#pc_valor', '600'); await p.fill('#pc_parcelas', '6'); await p.click('#pc'); await p.waitForTimeout(600);
  confere(/Parcela/.test(await p.locator('#pc_r').innerText()), 'Posso comprar isso? responde');
  await p.click('#f'); await p.waitForTimeout(600);
  confere(/valores de hoje/.test(await p.locator('#f_r').innerText()), 'simulador de futuro responde');
  await p.fill('#m_preco', '300'); await p.fill('#m_milhas', '10000'); await p.click('#m'); await p.waitForTimeout(600);
  confere(/R\$\s?30,00/.test(await p.locator('#m_r').innerText()), 'calculadora de milhas: milheiro a R$ 30,00');
  await p.screenshot({ path: path.join(SAIDA, '6-ferramentas.png') });
  // abas antigas continuam
  for (const a of ['carteira', 'gastos', 'compras', 'objetivos', 'orcamento', 'consultor', 'pontos']) { await aba(a); const t = await p.locator('#conteudo').innerText(); confere(t.trim().length > 5 && !/Não consegui carregar/.test(t), `aba antiga "${a}" continua abrindo`); }
  confere(erros.length === 0, 'sem erros no console' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : '\nTUDO CERTO');
  process.exit(falhas.length ? 1 : 0);
})();
