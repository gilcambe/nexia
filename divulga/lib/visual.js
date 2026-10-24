'use strict';
// Modelos visuais do Divulga em HTML (viram PNG no Chromium do GitHub Actions): carrossel de 5 telas,
// story 1080x1920 e post antes/depois. Visual de marca (laranja do Body Coach) com celular mostrando telas do app.
// As telas do celular são desenhadas aqui com dados de exemplo (marcadas como "exemplo") para o post nunca depender de print.

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));

const HALTERE = '<svg viewBox="0 0 512 512" width="1em" height="1em"><g fill="#ff8a3d"><rect x="96" y="196" width="44" height="152" rx="16"/><rect x="146" y="226" width="34" height="92" rx="12"/><rect x="372" y="196" width="44" height="152" rx="16"/><rect x="332" y="226" width="34" height="92" rx="12"/><rect x="176" y="258" width="160" height="28" rx="10"/></g></svg>';

const CSS = `*{box-sizing:border-box;margin:0}
body{width:var(--w);height:var(--h);font-family:Inter,"Segoe UI",Arial,Helvetica,sans-serif;color:#fff;overflow:hidden;position:relative;padding:84px;display:flex;flex-direction:column;
background:radial-gradient(900px 700px at 100% 0,#9a3412 0,transparent 65%),radial-gradient(700px 600px at 0 100%,#7c2d12 0,transparent 60%),#1c1917}
.marca{display:flex;align-items:center;gap:18px;font-weight:800;font-size:40px;letter-spacing:-.01em}
.marca i{width:72px;height:72px;border-radius:20px;background:#0c0a09;border:2px solid #44403c;display:grid;place-items:center;font-size:50px;font-style:normal}
.marca small{font-size:26px;font-weight:600;color:#fdba74;letter-spacing:.02em;display:block}
.miolo{flex:1;display:flex;flex-direction:column;justify-content:center}
h1{font-size:104px;line-height:1.02;font-weight:900;letter-spacing:-.03em}h1 b,h2 b{color:#fb923c}
h2{font-size:72px;line-height:1.08;font-weight:900;letter-spacing:-.02em;margin-bottom:28px}
p{font-size:42px;line-height:1.3;color:#e7e5e4}
.cta{display:inline-block;margin-top:44px;background:#f97316;color:#fff;font-weight:900;font-size:50px;padding:28px 60px;border-radius:999px;box-shadow:0 18px 50px -12px rgba(249,115,22,.7)}
.num{position:absolute;bottom:56px;right:84px;font-size:30px;color:#a8a29e}.arroba{position:absolute;bottom:56px;left:84px;font-size:30px;color:#a8a29e}
.cel{width:520px;height:1040px;border-radius:78px;background:#0c0a09;border:3px solid #57534e;padding:22px;box-shadow:0 50px 100px -30px #000;position:relative;flex:none}
.cel:before{content:"";position:absolute;top:30px;left:50%;width:150px;height:30px;margin-left:-75px;border-radius:20px;background:#0c0a09;z-index:3}
.tela{width:100%;height:100%;border-radius:58px;background:#fbfbf7;color:#1c1917;overflow:hidden;padding:76px 30px 30px;display:flex;flex-direction:column;gap:20px}
.tela p{font-size:26px;color:#57534e;line-height:1.3}.tela h3{font-size:38px;font-weight:900;letter-spacing:-.02em}
.cartao{background:#fff;border:2px solid #e7e5e4;border-radius:28px;padding:24px}.laranja{background:#f97316;color:#fff;border:0}.laranja p,.laranja h3{color:#fff}
.botao{background:#1c1917;color:#fff;border-radius:20px;padding:20px;text-align:center;font-weight:800;font-size:28px;margin-top:14px}
.barra{height:16px;border-radius:9px;background:#e7e5e4;overflow:hidden;margin:8px 0 16px}.barra i{display:block;height:100%;background:#f97316;border-radius:9px}
.rot{display:flex;justify-content:space-between;font-size:24px;font-weight:700;color:#44403c}
.bal{border-radius:26px;padding:20px 24px;font-size:26px;line-height:1.3;max-width:88%}.eu{background:#f97316;color:#fff;align-self:flex-end}.co{background:#f5f5f4;color:#1c1917}
.ex{font-size:20px;color:#a8a29e;text-align:center;margin-top:auto}
.dois{display:flex;gap:40px;justify-content:center;align-items:flex-start}.dois .cel{transform:scale(.8);transform-origin:top center;margin:0 -50px -200px}
.lista{display:grid;grid-template-columns:1fr 1fr;gap:26px;margin-top:20px}.lista div{background:rgba(255,255,255,.07);border:2px solid rgba(255,255,255,.12);border-radius:32px;padding:34px;font-size:36px;font-weight:800;line-height:1.2}.lista span{display:block;font-size:64px;margin-bottom:14px}
.img{width:100%;height:100%;object-fit:cover;border-radius:58px}`;

const MARCA_BODY_COACH = `<i>${HALTERE}</i><div>Body Coach</div>`;

/** `marca` (HTML já escapado) e `css` extra são opcionais: sem eles, a página é a de sempre (Body Coach). */
function pagina(largura, altura, miolo, { ordem, de, arroba = '@nexiabodycoach', rodape = true, marca = MARCA_BODY_COACH, css = '' } = {}) {
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><style>:root{--w:${largura}px;--h:${altura}px}${CSS}${css}</style><body><div class="marca">${marca}</div><div class="miolo">${miolo}</div>${rodape ? `<div class="arroba">${esc(arroba)}</div>` : ''}${ordem ? `<div class="num">${ordem}/${de}</div>` : ''}</body></html>`;
}

const aviso = '<div class="ex">tela de exemplo</div>';
const celular = (corpo, estilo = '') => `<div class="cel" style="${estilo}"><div class="tela">${corpo}</div></div>`;
const comPrint = (src, estilo) => `<div class="cel" style="${estilo || ''}"><div class="tela" style="padding:0"><img class="img" src="${esc(src)}"></div></div>`;

const telaHoje = () => `<p>Bom dia, Rafa 👋</p><h3>Treino de hoje</h3>
<div class="cartao laranja"><h3>Peito e tríceps</h3><p style="margin-top:6px">6 exercícios · 55 min</p><div class="botao" style="background:#fff;color:#c2410c">Começar treino</div></div>
<div class="cartao"><div class="rot"><span>🔥 12 dias seguidos</span><span>Meta: 4x</span></div><div class="barra"><i style="width:75%"></i></div><p>3 de 4 treinos da semana</p></div>
<div class="cartao"><div class="rot"><span>Calorias</span><span>1.640 / 2.100</span></div><div class="barra"><i style="width:78%"></i></div></div>${aviso}`;

const telaDieta = () => `<h3>Dieta de hoje</h3><p>Ajustada ao seu peso toda semana</p>
<div class="cartao"><div class="rot"><span>Proteína</span><span>142 / 170 g</span></div><div class="barra"><i style="width:84%"></i></div><div class="rot"><span>Carboidrato</span><span>210 / 260 g</span></div><div class="barra"><i style="width:81%"></i></div><div class="rot"><span>Gordura</span><span>55 / 70 g</span></div><div class="barra"><i style="width:79%"></i></div></div>
<div class="cartao"><div class="rot"><span>Almoço</span><span>650 kcal</span></div><p>Arroz, feijão, frango grelhado e salada</p></div>
<div class="cartao"><div class="rot"><span>Lanche</span><span>280 kcal</span></div><p>Iogurte, banana e aveia</p></div>${aviso}`;

const telaEvolucao = () => `<h3>Sua evolução</h3><p>Últimas 8 semanas</p>
<div class="cartao"><div class="rot"><span>Peso</span><span style="color:#16a34a">−4,3 kg</span></div>
<svg viewBox="0 0 400 180" width="100%" style="margin-top:12px"><polyline points="10,30 70,48 130,62 190,75 250,100 310,118 370,140" fill="none" stroke="#f97316" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="370" cy="140" r="12" fill="#f97316"/></svg></div>
<div class="cartao"><div class="rot"><span>Cintura</span><span style="color:#16a34a">−5 cm</span></div><div class="rot" style="margin-top:10px"><span>Supino</span><span style="color:#16a34a">+15 kg</span></div></div>
<div class="cartao"><p>📸 Fotos lado a lado mostram o que a balança não mostra.</p></div>${aviso}`;

const telaCoach = () => `<h3>Falar com o Coach</h3>
<div class="bal eu">Posso trocar o supino por outro exercício? Meu ombro incomodou.</div>
<div class="bal co">Pode. Troque por supino com halteres, pegada neutra, 3x12. Se a dor continuar, procure um profissional de saúde.</div>
<div class="bal eu">Fechou, obrigado!</div>${aviso}`;

// celular reduzido que ocupa só o espaço visual (o transform sozinho deixa o tamanho original no layout)
const reduzido = (cel, k = 0.7) => `<div style="width:${Math.round(520 * k)}px;height:${Math.round(1040 * k)}px;position:relative;flex:none"><div style="position:absolute;top:0;left:0;transform:scale(${k});transform-origin:top left">${cel}</div></div>`;

function usaPrint(prints, i, fallback, estilo) {
  return prints[i] ? comPrint(prints[i], estilo) : celular(fallback(), estilo);
}

/** Carrossel 1080x1350: problema, app, recursos, prova, chamada. */
function carrossel(cliente, { prints = [], recursos = [] } = {}) {
  const nome = esc(String(cliente.nome || '').replace(/^NEXIA\s+/i, ''));
  const itens = (recursos.length ? recursos : cliente.assuntos || []).slice(0, 4);
  const icones = ['🏋️', '🥗', '📈', '🏷️'];
  const lista = `<div class="lista">${itens.map((r, i) => `<div><span>${icones[i % 4]}</span>${esc(r)}</div>`).join('')}</div>`;
  const metade = (texto, cel) => `<div style="display:flex;gap:30px;align-items:center;justify-content:space-between"><div style="flex:1">${texto}</div>${reduzido(cel, 0.72)}</div>`;
  const telas = [
    `<h1>Treina e <b>não vê resultado?</b></h1><p style="margin-top:44px">Sem plano, sem dieta e sem acompanhamento, a motivação acaba na 3ª semana.</p>`,
    metade(`<h2>Conheça o <b>${nome}</b></h2><p>Treino, dieta e evolução num só app, com IA que se ajusta a você.</p>`, usaPrint(prints, 0, telaHoje)),
    `<h2>O que você <b>tem</b></h2>${lista}`,
    metade(`<h2>Quem usa, <b>evolui</b></h2><p>Fotos, medidas e cargas lado a lado mostram o progresso real, semana a semana.</p>`, usaPrint(prints, 1, telaEvolucao)),
    `<h1>Comece <b>grátis</b> hoje</h1><p style="margin-top:30px">Sem cartão. Cancele quando quiser.</p><span class="cta" style="align-self:flex-start">Link na bio · Comente QUERO</span>`,
  ];
  return telas.map((t, i) => pagina(1080, 1350, t, { ordem: i + 1, de: 5 }));
}

/** Story 1080x1920 com contagem regressiva (dias até `ate`) e uma pergunta. */
function story(cliente, { pergunta = 'Você treina quantas vezes por semana?', ate, hoje = new Date() } = {}) {
  const dias = ate ? Math.max(0, Math.ceil((new Date(ate) - hoje) / 86400000)) : null;
  const contagem = dias === null ? '' : `<p style="font-size:60px;color:#fb923c;font-weight:900;margin-bottom:30px">${dias === 0 ? 'É HOJE' : `Faltam ${dias} dia${dias === 1 ? '' : 's'}`}</p>`;
  return pagina(1080, 1920, `${contagem}<h1>${esc(pergunta)}</h1><div style="display:flex;justify-content:center;height:840px;margin-top:60px"><div style="transform:scale(.8);transform-origin:top center">${celular(telaCoach())}</div></div><span class="cta" style="align-self:center;margin-top:40px">Teste grátis · link na bio</span>`, { rodape: false });
}

/** Post antes/depois 1080x1350: duas telas lado a lado (dieta e evolução, ou prints). */
function antesDepois(cliente, { antes, depois, legenda = 'Evolução com acompanhamento', rotuloAntes = 'ANTES', rotuloDepois = 'DEPOIS' } = {}) {
  const rot = t => `<div style="text-align:center;font-size:34px;font-weight:800;color:#fdba74;letter-spacing:.12em;margin-bottom:16px">${esc(t)}</div>`;
  const a = antes ? comPrint(antes) : celular(telaDieta());
  const d = depois ? comPrint(depois) : celular(telaEvolucao());
  return pagina(1080, 1350, `<h2 style="text-align:center">${esc(legenda)}</h2><div class="dois"><div>${rot(rotuloAntes)}${a}</div><div>${rot(rotuloDepois)}${d}</div></div>`, { rodape: false });
}

/** Post único do feed 1080x1350: título grande, texto curto e uma tela do app ao lado. `tela`: hoje | dieta | evolucao | coach. */
function postUnico(cliente, { titulo = '', destaque = '', texto = '', tela = 'hoje', botao = 'Link na bio' } = {}) {
  const telas = { hoje: telaHoje, dieta: telaDieta, evolucao: telaEvolucao, coach: telaCoach };
  const cel = celular((telas[tela] || telaHoje)());
  const lado = `<h1 style="font-size:92px">${esc(titulo)}${destaque ? ` <b>${esc(destaque)}</b>` : ''}</h1><p style="margin-top:36px;font-size:38px">${esc(texto)}</p><span class="cta" style="align-self:flex-start;font-size:42px;padding:24px 48px">${esc(botao)}</span>`;
  return pagina(1080, 1350, `<div style="display:flex;gap:30px;align-items:center;justify-content:space-between"><div style="flex:1">${lado}</div>${reduzido(cel, 0.7)}</div>`);
}

// ---------- Modelos de tela de carrossel com a cor de cada cliente ----------

/** "#abc" ou "#aabbcc" -> [r, g, b]. Cor inválida vira preto. */
function rgb(cor) {
  let h = String(cor || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return [0, 0, 0];
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}
const luz = cor => {
  const [r, g, b] = rgb(cor).map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** Contraste WCAG entre duas cores (1 a 21). Texto legível precisa de 4.5 ou mais. */
function contraste(a, b) {
  const [x, y] = [luz(a), luz(b)].sort((m, n) => n - m);
  return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
}
/** Branco ou preto, o que tiver mais contraste com o fundo. */
const textoSobre = fundo => (contraste(fundo, '#ffffff') >= contraste(fundo, '#000000') ? '#ffffff' : '#000000');
/** Cor de texto preferida se passar de 4.5:1; senão, branco ou preto. */
const legivel = (cor, fundo) => (contraste(cor, fundo) >= 4.5 ? cor : textoSobre(fundo));

const corOk = c => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(c || '').trim());
/** Cores do próprio cliente (regra do dono), com contraste garantido. Sem cores: tons neutros. */
function temaDe(cliente = {}) {
  const c = cliente.cores || {};
  const fundo = corOk(c.fundo) ? c.fundo.trim() : '#111111';
  const destaque = corOk(c.destaque) ? c.destaque.trim() : '#f5f5f5';
  const texto = textoSobre(fundo);
  return { fundo, destaque, texto, realce: legivel(destaque, fundo), sobreDestaque: textoSobre(destaque) };
}

const CSS_MODELO = t => `body{background:${t.fundo};color:${t.texto};padding:80px;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;font-weight:800}
.marca{color:${t.texto}}.marca i{background:${t.destaque};color:${t.sobreDestaque};border:0;font-size:40px;font-weight:900;overflow:hidden}.marca i img,.marca i svg{width:100%;height:100%;object-fit:contain}
.marca small{color:${t.realce}}h1 b,h2 b{color:${t.realce}}p{color:${t.texto};opacity:.92}
.num,.arroba{bottom:48px;color:${t.texto};opacity:.75}.arroba{left:80px}.num{right:80px}
.m-capa{font-size:110px;line-height:1.02;font-weight:900;letter-spacing:-.03em}.m-capa.longa{font-size:84px}
.m-faixa{margin-top:44px;background:${t.destaque};color:${t.sobreDestaque};font-size:40px;line-height:1.25;padding:26px 36px;border-radius:24px}
.m-arraste{margin-top:56px;display:flex;align-items:center;gap:18px;font-size:36px;color:${t.realce}}
.m-n{font-size:220px;line-height:.9;font-weight:900;color:${t.realce};letter-spacing:-.05em;margin-bottom:24px}
.m-selo{align-self:flex-start;font-size:56px;font-weight:900;letter-spacing:.1em;color:#fff;padding:18px 44px;border-radius:999px;margin-bottom:40px}
.m-mito{background:#b91c1c}.m-verdade{background:#15803d}
.m-passo{font-size:40px;color:${t.realce};margin-bottom:20px}.m-barra{height:22px;border-radius:12px;background:${t.texto}33;overflow:hidden;margin-bottom:56px}.m-barra i{display:block;height:100%;background:${t.destaque}}
.m-cols{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:20px}.m-cols div{border-radius:32px;padding:40px;font-size:38px;line-height:1.25;min-height:520px}
.m-sem{border:3px solid ${t.texto}55}.m-com{background:${t.destaque};color:${t.sobreDestaque}}.m-cols b{display:block;font-size:44px;margin-bottom:22px;letter-spacing:.06em}
.m-aspas{font-size:220px;line-height:.6;color:${t.realce};font-family:Georgia,serif;height:110px}.m-frase{font-size:76px;line-height:1.12;font-weight:900;letter-spacing:-.02em}.m-autor{margin-top:40px;font-size:34px;opacity:.8}
.m-prova{font-size:190px;line-height:1;font-weight:900;color:${t.realce};letter-spacing:-.04em;margin-bottom:28px}
.m-acoes{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:56px}.m-acoes div{background:${t.destaque};color:${t.sobreDestaque};border-radius:28px;padding:32px 12px;text-align:center;font-size:34px}.m-acoes svg{display:block;margin:0 auto 16px;width:72px;height:72px}`;

// Ícones simples embutidos (sem imagem externa). `currentColor` segue a cor do texto.
const ICONE = {
  seta: '<svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M13 6l6 6-6 6"/></svg>',
  salvar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
  compartilhar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg>',
  comentar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z"/></svg>',
};

/** Marca do próprio cliente: logo embutido (SVG ou data:image) se existir; senão a inicial na cor de destaque. */
function marcaDe(cliente = {}) {
  const nome = String(cliente.nome || '').replace(/^NEXIA\s+/i, '');
  const logo = String(cliente.logo || '').trim();
  let icone = esc(nome.charAt(0).toUpperCase() || '•');
  if (/^<svg[\s>]/i.test(logo) && !/<script|\son\w+=/i.test(logo)) icone = logo;
  else if (/^data:image\/(png|jpe?g|webp|gif|svg\+xml)[;,]/i.test(logo)) icone = `<img src="${esc(logo)}" alt="">`;
  return `<i>${icone}</i><div>${esc(nome)}</div>`;
}
const arrobaDe = cliente => (cliente && cliente.instagram ? `@${String(cliente.instagram).replace(/^@/, '')}` : '');

const MODELOS_TELA = {
  capa: ({ titulo, texto }) => {
    const longa = String(titulo || '').trim().split(/\s+/).length > 6;
    return `<h1 class="m-capa${longa ? ' longa' : ''}">${esc(titulo)}</h1>${texto ? `<div class="m-faixa">${esc(texto)}</div>` : ''}<div class="m-arraste">Arraste ${ICONE.seta}</div>`;
  },
  lista: ({ titulo, texto, numero, ordem }) => `<div class="m-n">${esc(numero != null ? numero : ordem || 1)}</div><h2>${esc(titulo)}</h2><p>${esc(texto)}</p>`,
  'mito-verdade': ({ titulo, texto, selo }) => {
    const verdade = selo ? /verdade/i.test(selo) : /^\s*verdade/i.test(titulo || '');
    const titulo2 = String(titulo || '').replace(/^\s*(mito|verdade)\s*[:\-–]?\s*/i, '');
    return `<span class="m-selo ${verdade ? 'm-verdade' : 'm-mito'}">${verdade ? 'VERDADE' : 'MITO'}</span>${titulo2 ? `<h2>${esc(titulo2)}</h2>` : ''}<p>${esc(texto)}</p>`;
  },
  passo: ({ titulo, texto, passo, total, ordem, de }) => {
    const n = Number(passo || ordem || 1);
    const t = Math.max(n, Number(total || de || n));
    return `<div class="m-passo">Passo ${n} de ${t}</div><div class="m-barra"><i style="width:${Math.round((n / t) * 100)}%"></i></div><h2>${esc(titulo)}</h2><p>${esc(texto)}</p>`;
  },
  comparacao: ({ titulo, texto, sem, com }) => {
    const [a, b] = sem != null || com != null ? [sem, com] : String(texto || '').split('|');
    return `<h2>${esc(titulo)}</h2><div class="m-cols"><div class="m-sem"><b>SEM</b>${esc(a || '')}</div><div class="m-com"><b>COM</b>${esc(b || '')}</div></div>`;
  },
  citacao: ({ titulo, texto, autor }) => `<div class="m-aspas">“</div><div class="m-frase">${esc(titulo)}</div><div class="m-autor">${esc(autor || texto || '')}</div>`,
  prova: ({ titulo, texto, numero }) => `<div class="m-prova">${esc(numero || titulo)}</div>${numero ? `<h2>${esc(titulo)}</h2>` : ''}<p>${esc(texto)}</p>`,
  cta: ({ titulo, texto, siga }) => `<h1 style="font-size:92px">${esc(titulo)}</h1>${texto ? `<p style="margin-top:30px">${esc(texto)}</p>` : ''}<div class="m-acoes"><div>${ICONE.salvar}Salve</div><div>${ICONE.compartilhar}Compartilhe</div><div>${ICONE.comentar}Comente</div></div>${siga ? `<div class="m-faixa" style="text-align:center">Siga ${esc(siga)} para receber 1 dica nova por dia</div>` : ''}`,
};
const MODELOS = Object.keys(MODELOS_TELA);

/** Uma tela 1080x1350 no modelo pedido, com cor, logo e @ do próprio cliente. */
function telaModelo(modelo, cliente = {}, dados = {}) {
  const fazer = MODELOS_TELA[modelo] || MODELOS_TELA.lista;
  const { ordem, de } = dados;
  return pagina(1080, 1350, fazer({ ...dados, titulo: dados.titulo || '', texto: dados.texto || '' }), {
    ordem, de, arroba: arrobaDe(cliente), rodape: !!arrobaDe(cliente), marca: marcaDe(cliente), css: CSS_MODELO(temaDe(cliente)),
  });
}

/** Modelo das telas do meio conforme a série do roteiro (lib/roteiro.js). */
const MODELO_DA_SERIE = { 'mito-verdade': 'mito-verdade', 'passo-a-passo': 'passo' };

/** Roteiro (gancho, telas, cta) -> lista de HTML: capa + telas + cta, no máximo 10 (limite do Instagram). */
function carrosselRoteiro(cliente, roteiro = {}) {
  const meio = (roteiro.telas || []).slice(0, cliente.app ? 7 : 8);
  const de = meio.length + (cliente.app ? 3 : 2);
  const modelo = MODELO_DA_SERIE[roteiro.serie] || 'lista';
  const telas = [telaModelo('capa', cliente, { titulo: roteiro.gancho, ordem: 1, de })];
  meio.forEach((t, i) => telas.push(telaModelo(modelo, cliente, {
    titulo: t.titulo, texto: t.texto, ordem: i + 2, de, numero: i + 1, passo: i + 1, total: meio.length,
    selo: modelo === 'mito-verdade' && !/^\s*(mito|verdade)/i.test(t.titulo || '') ? (i % 2 ? 'verdade' : 'mito') : undefined,
  })));
  if (cliente.app) telas.push(telaApp(cliente, roteiro.serie, { ordem: de - 1, de }));
  telas.push(telaModelo('cta', cliente, { titulo: roteiro.cta || 'Gostou?', texto: roteiro.pergunta, siga: arrobaDe(cliente), ordem: de, de }));
  return telas;
}

/** Tela do app no celular (cliente com `"app": true`): mostra o produto, não só texto. A tela muda com a série. */
const TELA_DA_SERIE = { 'antes-depois': telaEvolucao, 'mito-verdade': telaDieta, bastidores: telaCoach, 'pergunta-enquete': telaCoach };
function telaApp(cliente, serie, { ordem, de } = {}) {
  const t = temaDe(cliente);
  const cel = celular((TELA_DA_SERIE[serie] || telaHoje)());
  const lado = `<h2>Tudo isso no <b>app</b></h2><p>Treino com vídeo, dieta que se ajusta e evolução num lugar só.</p><div class="m-faixa">Teste grátis · link na bio</div>`;
  return pagina(1080, 1350, `<div style="display:flex;gap:30px;align-items:center;justify-content:space-between"><div style="flex:1">${lado}</div>${reduzido(cel, 0.78)}</div>`, {
    ordem, de, arroba: arrobaDe(cliente), rodape: !!arrobaDe(cliente), marca: marcaDe(cliente), css: CSS_MODELO(t),
  });
}

module.exports = { carrossel, story, antesDepois, postUnico, pagina, esc, contraste, telaModelo, carrosselRoteiro, MODELOS };
