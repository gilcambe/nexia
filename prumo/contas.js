'use strict';
// Kernex Finance: aba Contas. Contas e saldos, e limites de gasto por categoria com alerta.
(function () {
  const MB = window.MB;
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });
  const CAT = { moradia: 'Moradia', alimentacao: 'Alimentação', transporte: 'Transporte', saude: 'Saúde', educacao: 'Educação', familia: 'Família', lazer: 'Lazer', compras: 'Compras', assinaturas: 'Assinaturas', financeiro: 'Financeiro', impostos: 'Impostos', investimentos: 'Investimentos', outros: 'Outros' };
  const COR = { ok: '', atencao: '#f59e0b', estourado: '#ef4444' };

  MB.telas.contas = async (el) => {
    const { brl, esc, opcoes, barra, formulario, aba } = await carregarUi();
    aba('contas');
    const [c, l] = await Promise.all([MB.api('conta_listar'), MB.api('limite_listar')]);
    el.innerHTML = `
      <div class="card"><div class="fraco">Saldo disponível (contas em reais)</div>
        <div class="grande">${c.saldo === null ? '—' : brl(c.saldo)}</div>
        <div class="fraco">${c.saldo === null ? 'Cadastre suas contas para ver quanto você realmente tem. Limite de cartão não conta.' : 'Só dinheiro em conta. Limite de cartão nunca entra aqui.'}</div>
        ${c.outras_moedas.map((o) => `<div class="fraco">${esc(o.nome)}: ${Number(o.saldo).toLocaleString('pt-BR')} ${esc(o.moeda)} (não somado ao saldo em reais)</div>`).join('')}</div>
      <button class="btn" id="nova-conta" type="button">+ Conta</button>
      <div class="card" style="margin-top:12px">${c.contas.map((x) => `<div class="item" data-id="${esc(x.id)}"><div><div class="n">${esc(x.nome)}</div><div class="fraco">${esc(c.tipos[x.tipo] || x.tipo)}${x.instituicao ? ' · ' + esc(x.instituicao) : ''}</div></div><div class="v ${x.saldo < 0 ? 'verm' : ''}">${x.moeda === 'BRL' ? brl(x.saldo) : Number(x.saldo).toLocaleString('pt-BR') + ' ' + esc(x.moeda)}</div></div>`).join('') || '<p class="fraco">Nenhuma conta ainda.</p>'}</div>
      <h3 style="margin:18px 0 8px">Limites do mês</h3>
      <button class="btn sec" id="novo-limite" type="button">+ Limite por categoria</button>
      <div class="card" style="margin-top:12px">${l.limites.map((x) => `<div style="margin:8px 0" data-cat="${esc(x.categoria)}"><div class="item" style="padding:0;border:0"><span class="n">${esc(CAT[x.categoria] || x.categoria)}${x.status === 'estourado' ? ' 🔴' : x.status === 'atencao' ? ' 🟠' : ''}</span><span>${brl(x.gasto)} de ${brl(x.limite)}</span></div>${barra(x.pct, COR[x.status])}<div class="fraco">${x.status === 'estourado' ? 'Passou ' + brl(-x.restante) : 'Restam ' + brl(x.restante)} · ${String(x.pct).replace('.', ',')}%</div></div>`).join('') || '<p class="fraco">Defina quanto quer gastar por categoria. Eu aviso a partir de 80%.</p>'}</div>`;

    const editarConta = (x) => formulario(x ? 'Editar conta' : 'Nova conta', [
      { nome: 'nome', rotulo: 'Nome da conta', valor: x && x.nome },
      { nome: 'tipo', rotulo: 'Tipo', opcoes: opcoes(c.tipos, x ? x.tipo : 'corrente') },
      { nome: 'instituicao', rotulo: 'Banco ou instituição', valor: x && x.instituicao },
      { nome: 'saldo', rotulo: 'Saldo hoje', tipo: 'number', valor: x && x.saldo },
      { nome: 'moeda', rotulo: 'Moeda (BRL, USD…)', valor: x ? x.moeda : 'BRL' },
    ], async (d) => { await MB.api('conta_salvar', { ...d, id: x && x.id }); MB.ui.ok('Conta salva.'); },
    x ? async () => { await MB.api('conta_apagar', { id: x.id }); } : null);
    el.querySelector('#nova-conta').onclick = () => editarConta(null);
    el.querySelectorAll('.item[data-id]').forEach((d) => { d.onclick = () => editarConta(c.contas.find((x) => x.id === d.dataset.id)); });
    const editarLimite = (x) => formulario(x ? 'Editar limite' : 'Novo limite', [
      { nome: 'categoria', rotulo: 'Categoria', opcoes: opcoes(CAT, x ? x.categoria : 'alimentacao') },
      { nome: 'limite', rotulo: 'Limite por mês (R$)', tipo: 'number', valor: x && x.limite },
    ], async (d) => { await MB.api('limite_salvar', d); MB.ui.ok('Limite salvo.'); },
    x ? async () => { await MB.api('limite_apagar', { id: x.categoria }); } : null);
    el.querySelector('#novo-limite').onclick = () => editarLimite(null);
    el.querySelectorAll('[data-cat]').forEach((d) => { d.onclick = () => editarLimite(l.limites.find((x) => x.categoria === d.dataset.cat)); });
  };
})();
