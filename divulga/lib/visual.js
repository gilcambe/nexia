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

function pagina(largura, altura, miolo, { ordem, de, arroba = '@nexiabodycoach', rodape = true } = {}) {
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><style>:root{--w:${largura}px;--h:${altura}px}${CSS}</style><body><div class="marca"><i>${HALTERE}</i><div>Body Coach<small>by NEXIA</small></div></div><div class="miolo">${miolo}</div>${rodape ? `<div class="arroba">${esc(arroba)}</div>` : ''}${ordem ? `<div class="num">${ordem}/${de}</div>` : ''}</body></html>`;
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

module.exports = { carrossel, story, antesDepois, postUnico, pagina, esc };
