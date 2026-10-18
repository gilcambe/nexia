'use strict';
// Modelos visuais do Divulga em HTML (viram PNG no Chromium do GitHub Actions): carrossel de 5 telas,
// story 1080x1920 com contagem e pergunta, e post antes/depois com prints reais do app.

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CSS = `*{box-sizing:border-box;margin:0}body{width:var(--w);height:var(--h);font-family:Inter,Arial,Helvetica,sans-serif;background:#000;color:#fff;overflow:hidden;display:flex;flex-direction:column;justify-content:center;padding:90px;position:relative}
.logo{position:absolute;top:70px;left:90px;display:flex;align-items:center;gap:20px;font-weight:800;letter-spacing:.35em;font-size:34px;color:#cfd3d8}
.logo i{width:64px;height:64px;border-radius:16px;background:#111;border:2px solid #333;display:grid;place-items:center;font-style:normal;font-size:40px;letter-spacing:0;color:#d9dde2}
h1{font-size:96px;line-height:1.05;font-weight:900;letter-spacing:-.02em}h1 b{color:#35e0b5}h2{font-size:64px;line-height:1.1;margin-bottom:30px}
p{font-size:46px;line-height:1.3;color:#c9cdd3}.num{position:absolute;bottom:70px;right:90px;font-size:34px;color:#6b7078}
.cta{display:inline-block;margin-top:50px;background:#35e0b5;color:#000;font-weight:900;font-size:50px;padding:28px 56px;border-radius:999px}
img.print{width:100%;border-radius:36px;border:2px solid #2a2d33}.par{display:grid;grid-template-columns:1fr 1fr;gap:30px}.par div{text-align:center;font-size:36px;color:#9aa0a8}.par img{margin-top:16px}`;

function pagina(largura, altura, miolo) {
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><style>:root{--w:${largura}px;--h:${altura}px}${CSS}</style><body><div class="logo"><i>N</i>NEXIA</div>${miolo}</body></html>`;
}

/** Carrossel 1080x1350: problema → app → recursos → prova → chamada. */
function carrossel(cliente, { prints = [], recursos = [] } = {}) {
  const nome = esc(cliente.nome);
  const lista = (recursos.length ? recursos : cliente.assuntos || []).slice(0, 4).map(r => `<p>✔ ${esc(r)}</p>`).join('');
  const telas = [
    `<h1>Treina e <b>não vê resultado?</b></h1><p style="margin-top:40px">Sem plano, sem dieta e sem acompanhamento, a motivação acaba na 3ª semana.</p>`,
    `<h2>Conheça o <b style="color:#35e0b5">${nome}</b></h2><p>Treino, dieta e evolução num só app, com IA que se ajusta a você.</p>${prints[0] ? `<img class="print" style="margin-top:40px;max-height:560px;object-fit:cover" src="${esc(prints[0])}">` : ''}`,
    `<h2>O que você tem</h2>${lista}`,
    `<h2>Quem usa, <b style="color:#35e0b5">evolui</b></h2><p>Fotos, medidas e cargas lado a lado mostram o progresso real, semana a semana.</p>${prints[1] ? `<img class="print" style="margin-top:40px;max-height:560px;object-fit:cover" src="${esc(prints[1])}">` : ''}`,
    `<h1>Comece <b>grátis</b> hoje</h1><p style="margin-top:30px">Sem cartão. Cancele quando quiser.</p><span class="cta">Link na bio · Comente QUERO</span>`,
  ];
  return telas.map((t, i) => pagina(1080, 1350, `${t}<div class="num">${i + 1}/5</div>`));
}

/** Story 1080x1920 com contagem regressiva (dias até `ate`) e uma pergunta. */
function story(cliente, { pergunta = 'Você treina quantas vezes por semana?', ate, hoje = new Date() } = {}) {
  const dias = ate ? Math.max(0, Math.ceil((new Date(ate) - hoje) / 86400000)) : null;
  const contagem = dias === null ? '' : `<p style="font-size:60px;color:#35e0b5;font-weight:900;margin-bottom:30px">${dias === 0 ? 'É HOJE' : `Faltam ${dias} dia${dias === 1 ? '' : 's'}`}</p>`;
  return pagina(1080, 1920, `${contagem}<h1>${esc(pergunta)}</h1><p style="margin-top:60px">Responda aqui no story 👇</p><span class="cta" style="align-self:flex-start">Teste grátis · link na bio</span>`);
}

/** Post antes/depois 1080x1350 com dois prints reais do app. */
function antesDepois(cliente, { antes, depois, legenda = 'Evolução com acompanhamento', rotuloAntes = 'ANTES', rotuloDepois = 'DEPOIS' } = {}) {
  const img = s => (s ? `<img class="print" src="${esc(s)}">` : '');
  return pagina(1080, 1350, `<h2>${esc(legenda)}</h2><div class="par"><div>${esc(rotuloAntes)}${img(antes)}</div><div>${esc(rotuloDepois)}${img(depois)}</div></div><span class="cta" style="align-self:flex-start">Link na bio</span>`);
}

module.exports = { carrossel, story, antesDepois, pagina, esc };
