// Gera prints FALSOS (dados inventados) de vários tipos para testar a leitura do Kernex Finance.
// Uso: node scripts/kf-gerar-prints-teste.js  → tests/fixtures/kf-prints/*.jpg + esperado.json
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const OUT = path.join(__dirname, '../tests/fixtures/kf-prints');
const css = `body{font-family:Arial,sans-serif;margin:0;background:#f4f4f4;color:#222;width:390px}
.top{background:#5b2ca0;color:#fff;padding:18px 16px;font-size:18px;font-weight:bold}.c{background:#fff;margin:10px;padding:12px;border-radius:8px}
.l{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;font-size:14px}.s{color:#777;font-size:12px}.t{font-weight:bold;font-size:16px}
table{width:100%;border-collapse:collapse;font-size:12px}td,th{border-bottom:1px solid #ddd;padding:6px 3px;text-align:left}`;
const linha = (a, b, s) => `<div class="l"><div>${a}${s ? `<div class="s">${s}</div>` : ''}</div><div>${b}</div></div>`;
const PRINTS = [
  { arq: 'fatura-cartao', modo: 'doc', esperado: { tipo: 'fatura', lancamentos: 5, despesas: 1018.4 },
    html: `<div class="top">Cartão Roxo · Fatura de outubro/2026</div><div class="c"><div class="s">Vence em 10/11/2026</div><div class="t">Total da fatura R$ 1.018,40</div></div>
<div class="c">${linha('Supermercado Bom Preço', 'R$ 312,90', '03/10')}${linha('Posto Avenida', 'R$ 200,00', '05/10')}${linha('Loja de Móveis 2/6', 'R$ 250,00', '08/10 · parcela 2 de 6')}${linha('Streaming Filmes', 'R$ 39,90', '12/10')}${linha('Restaurante Sabor', 'R$ 215,60', '20/10')}</div>` },
  { arq: 'extrato-banco', modo: 'doc', esperado: { tipo: 'extrato', lancamentos: 5, receitas: 6500, despesas: 1380.75 },
    html: `<div class="top">Banco Azul · Extrato da conta</div><div class="c">${linha('Salário Empresa X', '+ R$ 6.500,00', '01/10/2026 · crédito')}${linha('Pix enviado João Silva', '- R$ 150,00', '02/10/2026')}${linha('Pagamento boleto Escola', '- R$ 980,00', '05/10/2026')}${linha('Conta de água', '- R$ 250,75', '07/10/2026')}${linha('Transferência para minha poupança', '- R$ 1.000,00', '08/10/2026 · mesma titularidade')}</div><div class="c t">Saldo R$ 4.119,25</div>` },
  { arq: 'comprovante-pix', modo: 'doc', esperado: { tipo: 'comprovante', lancamentos: 1, despesas: 89.9 },
    html: `<div class="top">Comprovante de Pix</div><div class="c"><div class="t">R$ 89,90</div>${linha('Para', 'Pet Shop Amigo')}${linha('Data', '15/10/2026 14:32')}${linha('Tipo', 'Pix enviado')}${linha('ID', 'E1234567820261015')}</div>` },
  { arq: 'cupom-mercado', modo: 'doc', esperado: { tipo: 'nota', lancamentos: 1, despesas: 147.35 },
    html: `<div class="top" style="background:#333">CUPOM FISCAL · MERCADO CENTRAL</div><div class="c" style="font-family:monospace">18/10/2026<br>${linha('ARROZ 5KG', '28,90')}${linha('FEIJAO 1KG', '8,99')}${linha('CAFE 500G', '19,90')}${linha('CARNE KG', '74,57')}${linha('LEITE CX', '14,99')}<div class="t">TOTAL R$ 147,35</div>Pagamento: cartão de débito</div>` },
  { arq: 'conta-luz', modo: 'doc', esperado: { tipo: 'conta', lancamentos: 1, despesas: 236.48 },
    html: `<div class="top" style="background:#0a7d3b">Energia Elétrica · Conta de outubro</div><div class="c">${linha('Consumo', '310 kWh')}${linha('Vencimento', '25/10/2026')}<div class="t">Total a pagar R$ 236,48</div></div>` },
  { arq: 'previdencia-duas-linhas', modo: 'carteira', esperado: { itens: 2, soma: 112509.84 },
    html: `<div class="top" style="background:#0090da">Previdência Complementar Fechada</div><div class="c"><table><tr><th>Plano</th><th>Conta</th><th>Data</th><th>Saldo (R$)</th></tr>
<tr><td>PLANO DE BENEFÍCIOS EXEMPLO</td><td>Participante</td><td>04/11/2026</td><td>74.749,03</td></tr><tr><td>PLANO DE BENEFÍCIOS EXEMPLO</td><td>Patrocinadora</td><td>04/11/2026</td><td>37.760,81</td></tr>
<tr><td colspan="3" style="text-align:right"><b>TOTAL</b></td><td><b>112.509,84</b></td></tr></table></div>` },
  { arq: 'corretora-carteira', modo: 'carteira', esperado: { itens: 4, soma: 25430.5 },
    html: `<div class="top" style="background:#111">Corretora Exemplo · Minha carteira</div><div class="c"><div class="t">Patrimônio total R$ 25.430,50</div></div><div class="c">
${linha('PETR4 · 200 ações', 'R$ 7.640,00', 'Preço médio R$ 32,10')}${linha('MXRF11 · 500 cotas', 'R$ 5.140,00', 'Fundo imobiliário')}${linha('Tesouro Selic 2029', 'R$ 8.150,50', 'Valor aplicado R$ 7.900,00')}${linha('CDB Banco Azul 110% CDI', 'R$ 4.500,00', 'Vence 12/2027')}</div>` },
  { arq: 'banco-saldos', modo: 'carteira', esperado: { itens: 3, soma: 18320.4 },
    html: `<div class="top" style="background:#ec7000">Banco Laranja · Investimentos</div><div class="c">${linha('Poupança', 'R$ 3.200,40')}${linha('LCI 95% CDI', 'R$ 10.000,00', 'Vence 03/2027')}${linha('Fundo DI Simples', 'R$ 5.120,00')}<div class="t">Total investido R$ 18.320,40</div></div>` },
];
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 390, height: 700 }, deviceScaleFactor: 2 });
  const esperado = {};
  for (const x of PRINTS) {
    await pg.setContent(`<!doctype html><meta charset="utf-8"><style>${css}</style>${x.html}`);
    await pg.screenshot({ path: path.join(OUT, x.arq + '.jpg'), type: 'jpeg', quality: 80, fullPage: true });
    esperado[x.arq] = { modo: x.modo, ...x.esperado };
  }
  fs.writeFileSync(path.join(OUT, 'esperado.json'), JSON.stringify(esperado, null, 2) + '\n');
  await b.close();
  console.log('ok', PRINTS.length, 'prints');
})();
