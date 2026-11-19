'use strict';
// Redesign: aba Mês. Quanto entrou, quanto falta cair, quanto vai sair e a agenda do mês; atalhos para salário,
// cartões, contas e lançamentos.
(function () {
  const MB = window.MB;
  const carregar = () => MB.hub ? Promise.resolve(MB.hub) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/hubs.js'; s.onload = () => ok(MB.hub); s.onerror = falha; document.body.appendChild(s); });
  MB.telas.mes = async (el) => {
    const H = await carregar(); const U = await H.ui(); U.aba('mes');
    const [p, pl] = await Promise.all([MB.api('painel_resumo'), MB.api('planejar_mes', {}, { silencioso: true }).catch(() => null)]);
    const k = p.kpis || {};
    const ag = (pl && pl.calendario) || [];
    const NOMEP = { adiantamento: 'Adiantamento', mensal: 'Salário', decimo_terceiro_1: '13º (1ª parcela)', decimo_terceiro_2: '13º (2ª parcela)', ferias: 'Férias', plr: 'PLR', outro: 'Recebimento' };
    el.innerHTML = `<div class="kh">
      <div class="kh-larga"><h2>Seu mês</h2><div class="sub">${p.dias_restantes} dia(s) para acabar</div></div>
      <div class="kh-kpis kh-larga">
        <div class="card"><div class="r">Recebi</div><div class="v">${H.val(k.recebi, 'kh-in')}</div></div>
        <div class="card"><div class="r">Falta receber</div><div class="v">${H.val(k.falta_receber, 'kh-in')}</div></div>
        <div class="card"><div class="r">A pagar</div><div class="v">${H.val(k.a_pagar, 'kh-out')}</div></div>
        <div class="card"><div class="r">Gastei no mês</div><div class="v">${H.val(k.gasto_mes, '')}</div></div>
      </div>
      <section class="card"><b>📅 Agenda do mês</b>${ag.length ? ag.slice(0, 12).map((x) => `<div class="kh-ag"><span>${x.data.slice(8, 10)}/${x.data.slice(5, 7)} · ${H.esc(x.origem === 'pagamento' ? (NOMEP[x.nome] || x.nome) : x.nome)}</span><span class="${x.tipo === 'entrada' ? 'kh-in' : 'kh-out'}" style="font-weight:600;white-space:nowrap">${x.tipo === 'entrada' ? '+' : '−'} ${H.brl(x.valor)}</span></div>`).join('')
        : '<p class="sub" style="margin:8px 0 0">Nada marcado ainda. Cadastre o salário, as contas fixas e os cartões.</p>'}</section>
      ${H.lista([
        ['orcamento', '💼', 'Salário e holerite', 'Adiantamento, 13º, horas extras e o que falta cair'],
        ['cartoes', '💳', 'Cartões e faturas', 'Mande a fatura e veja quando vence'],
        ['contas', '🏦', 'Contas do banco', 'Saldo de cada conta'],
        ['documentos', '🧾', 'Lançamentos', 'Tudo que entrou e saiu, com editar e apagar'],
        ['gastos', '🛒', 'Gastos por categoria', 'Para onde vai o dinheiro'],
        ['fluxo', '📈', 'Fluxo de caixa', 'Quanto ainda entra e sai nos próximos meses'],
        ['carreira', '🧭', 'Carreira e renda', 'Simular aumento e renda extra'],
        ['compras', '🧺', 'Lista de compras', 'Listas do mercado'],
      ])}
    </div>`;
    H.ligar(el);
  };
})();
