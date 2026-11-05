// Kernex Finance: aba Contas (contas bancárias e dívidas, com plano de quitação).
'use strict';
(function () {
  const MB = window.MB;
  let brl, esc, TIPOS, CATS, hoje, opcoes, barra, formulario, reduzir, recarregar, ok;
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });
  const iniciar = async (aba) => { ({ brl, esc, TIPOS, CATS, hoje, opcoes, barra, formulario, reduzir, recarregar, ok } = await carregarUi()); MB.ui.aba(aba); };
  const TCONTA = { corrente: 'Conta corrente', poupanca: 'Poupança', digital: 'Conta digital', carteira: 'Carteira digital', dinheiro: 'Dinheiro', internacional: 'Internacional' };
  MB.telas.contas = async (el) => {
    await iniciar('contas');
    const [{ contas }, { dividas }, est] = await Promise.all([MB.api('conta_listar'), MB.api('divida_listar'), MB.api('divida_estrategia', { extra: 0 })]);
    const nm = (e) => (e && e.viavel ? `${e.meses} meses · juros ${brl(e.jurosPagos)}` : 'não quita só com a parcela mínima');
    el.innerHTML = `
      <div class="card"><div class="item" style="border:0;padding:0"><b>Contas</b><button class="btn mini" id="nconta">+ Conta</button></div>
        ${contas.map((c) => `<div class="item" data-c="${c.id}"><div><div class="n">${esc(c.nome)}${c.pessoa_juridica ? ' <span class="fraco">(PJ)</span>' : ''}</div><div class="fraco">${esc(TCONTA[c.tipo] || c.tipo)}${c.instituicao ? ' · ' + esc(c.instituicao) : ''}</div></div><div class="v">${brl(c.saldo)}</div></div>`).join('') || '<p class="fraco">Cadastre suas contas para ver o saldo disponível.</p>'}</div>
      <div class="card"><div class="item" style="border:0;padding:0"><b>Dívidas</b><button class="btn mini" id="ndiv">+ Dívida</button></div>
        ${dividas.map((d) => `<div class="item" data-d="${d.id}"><div><div class="n">${esc(d.nome)}</div><div class="fraco">${d.juros_mes}% ao mês · parcela mín. ${brl(d.parcela_minima)}${d.vencimento ? ' · vence ' + esc(d.vencimento) : ''}</div></div><div class="v verm">${brl(d.saldo)}</div></div>`).join('') || '<p class="fraco">Nenhuma dívida cadastrada. 👏</p>'}</div>
      ${dividas.length ? `<div class="card"><b>Plano de quitação</b><label>Quanto pode pagar a mais por mês (R$)</label><input id="extra" type="number" step="0.01" inputmode="decimal" value="0"><button class="btn sec" id="calc" style="margin-top:10px">Comparar métodos</button><div id="res" class="fraco" style="margin-top:10px">Avalanche: ${nm(est.avalanche)}<br>Bola de neve: ${nm(est.bola_de_neve)}</div></div>` : ''}`;
    const fConta = (c) => formulario(c ? 'Editar conta' : 'Nova conta', [
      { nome: 'nome', rotulo: 'Nome', valor: c && c.nome }, { nome: 'tipo', rotulo: 'Tipo', opcoes: opcoes(TCONTA, c && c.tipo) },
      { nome: 'instituicao', rotulo: 'Banco', valor: c && c.instituicao }, { nome: 'saldo', rotulo: 'Saldo (R$)', tipo: 'number', valor: c && c.saldo },
      { nome: 'pessoa_juridica', rotulo: 'É conta de empresa?', opcoes: `<option value="">Não</option><option value="1"${c && c.pessoa_juridica ? ' selected' : ''}>Sim</option>` }],
      (d) => MB.api('conta_salvar', { ...d, pessoa_juridica: d.pessoa_juridica === '1', id: c && c.id }), c ? () => MB.api('conta_apagar', { id: c.id }) : null);
    const fDiv = (d) => formulario(d ? 'Editar dívida' : 'Nova dívida', [
      { nome: 'nome', rotulo: 'Nome', valor: d && d.nome }, { nome: 'credor', rotulo: 'Credor', valor: d && d.credor },
      { nome: 'saldo', rotulo: 'Saldo devedor (R$)', tipo: 'number', valor: d && d.saldo }, { nome: 'juros_mes', rotulo: 'Juros ao mês (%)', tipo: 'number', valor: d && d.juros_mes },
      { nome: 'parcela_minima', rotulo: 'Parcela mínima (R$)', tipo: 'number', valor: d && d.parcela_minima }, { nome: 'vencimento', rotulo: 'Vencimento', tipo: 'date', valor: d && d.vencimento }],
      (x) => MB.api('divida_salvar', { ...x, id: d && d.id }), d ? () => MB.api('divida_apagar', { id: d.id }) : null);
    el.querySelector('#nconta').onclick = () => fConta();
    el.querySelector('#ndiv').onclick = () => fDiv();
    el.querySelectorAll('[data-c]').forEach((n) => { n.onclick = () => fConta(contas.find((c) => c.id === n.dataset.c)); });
    el.querySelectorAll('[data-d]').forEach((n) => { n.onclick = () => fDiv(dividas.find((d) => d.id === n.dataset.d)); });
    const calc = el.querySelector('#calc');
    if (calc) calc.onclick = async () => {
      const r = await MB.api('divida_estrategia', { extra: el.querySelector('#extra').value || 0 });
      el.querySelector('#res').innerHTML = `Avalanche (maior juros primeiro): ${nm(r.avalanche)}<br>Bola de neve (menor saldo primeiro): ${nm(r.bola_de_neve)}<br>${r.melhor ? `<b>Menos juros: ${r.melhor === 'avalanche' ? 'avalanche' : 'bola de neve'}, economiza ${brl(r.economia)}.</b><br>` : ''}${esc(r.aviso)}`;
    };
  };
})();
