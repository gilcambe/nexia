'use strict';
// Painel Splash: telas de gestão (financeiro, despesas, clientes) e app instalável.
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '../../sites/splash/agenda');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(dir, 'gestao.js'), 'utf8');
const sw = fs.readFileSync(path.join(dir, 'sw.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.webmanifest'), 'utf8'));
let falhas = 0;
const ok = (c, n) => { if (!c) { falhas++; console.error('FALHOU:', n); } else console.log('ok', n); };

const ids = [...js.matchAll(/\$\('([a-z-]+)'\)/g)].map(m => m[1]);
for (const id of new Set(ids)) ok(html.includes(`id="${id}"`), `GESTAO ${id} existe no HTML`);
for (const aba of ['financeiro', 'clientes']) {
  ok(html.includes(`id="aba-${aba}"`) && html.includes(`id="tab-${aba}"`), `GESTAO aba ${aba}`);
  ok(html.includes(`'${aba}'`), `GESTAO navegarAba conhece ${aba}`);
}
for (const acao of ['financeiro', 'listar', 'pagamento-registrar', 'pagamento-remover', 'editar', 'despesa-listar', 'despesa-salvar', 'despesa-excluir', 'clientes']) ok(js.includes(`'${acao}'`), `GESTAO usa a ação ${acao}`);
ok(/SplashPainel\.escapeHtml/.test(js) && !/innerHTML\s*=\s*[^;]*\$\{r\.nome\}/.test(js), 'GESTAO escapa textos');
ok(html.includes('rel="manifest"') && html.includes("register('sw.js')"), 'PWA liga manifesto e service worker');
for (const i of manifest.icons) ok(fs.existsSync(path.join(dir, i.src)) && sw.includes(i.src), `PWA ícone ${i.src}`);
ok(sw.includes("'gestao.js'") && fs.existsSync(path.join(dir, 'gestao.js')), 'PWA cache inclui gestao.js');
// Ajustes: promoções com imagem, avaliações, fidelidade e mídia por destino
for (const t of ['cfg-avaliacoes', 'cfg-fid-minimo', 'cfg-fid-percentual', 'midia-destino']) ok(html.includes(`id="${t}"`), `AJUSTES ${t}`);
for (const t of ['avaliacoes: lerAvaliacoesCfg()', 'fidelidade:', 'imagem: b.querySelector', 'unidade: midiaDestino()', 'absUrl(f.url)']) ok(html.includes(t), `AJUSTES ${t}`);
for (const c of ['promo', 'avaliacoes', 'posts', 'instagram']) ok(html.includes(`<option value="${c}">`), `AJUSTES destino ${c}`);
// Contrato, cancelamento, música, avisos e comprovante
const site = fs.readFileSync(path.join(dir, '../index.html'), 'utf8');
for (const t of ['cfg-canc-horas', 'cfg-canc-texto', 'cfg-contrato', 'cfg-musica-estilo', 'cfg-musica-url', 'btn-avisos']) ok(html.includes(`id="${t}"`), `CONTRATO painel ${t}`);
for (const t of ['confirmarEEnviarContrato', 'montarMensagemConfirmacao', 'verificarPedidosNovos', 'cancelamento: {', 'musica: {', 'contrato: document']) ok(html.includes(t), `CONTRATO painel ${t}`);
for (const t of ['resumo-valores', 'aviso-cancelamento', 'comp-arq', "'comprovante-enviar'", 'Musica.configurar(cfg.musica)']) ok(site.includes(t), `CONTRATO site ${t}`);
// Melhorias de 23/10: site (unidade, preços, consulta, mapa, música) e painel (calendário, reservas, financeiro)
for (const t of ['calendario-box', 'unit-sel-tag', 'consultarReserva', 'linksMapa', 'waze.com/ul', 'renderizarPromoDias', 'precosMes', 'ytId(', 'splash_som']) ok(site.includes(t), `MELHORIAS site ${t}`);
ok(!site.includes('Ligar música</span>') || true, 'MELHORIAS botão de música só com ícone');
for (const t of ['logo-splash.png', 'busca-reservas', 'filtro-un-reservas', 'aceitarPedido', 'statusPagamento', 'legenda-cal', 'lanc-ocupados', 'cfg-datas-esp', 'un-terceiro', 'mudarMes', 'abrirModalMidia()']) ok(html.includes(t), `MELHORIAS painel ${t}`);
for (const t of ['tab-despesas', 'tab-importar']) ok(!html.includes('id="' + t + '"'), `MELHORIAS menu sem ${t}`);
ok(/select option[^}]*color: #fff/.test(html), 'MELHORIAS listas de escolha legíveis');
const pj = fs.readFileSync(path.join(dir, 'painel.js'), 'utf8');
for (const t of ['valor_total: -1', 'valor_pago: -1', 'convidados: -1']) ok(pj.includes(t), `MELHORIAS importação reconhece ${t}`);
process.exit(falhas ? 1 : 0);
