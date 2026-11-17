'use strict';
// Kernex Finance: calculadoras de milhas (funções puras) e links oficiais de busca. Sem DOM aqui, exceto ligarCalculadoras.
(function () {
  const MB = window.MB = window.MB || {};
  const r2 = (n) => Math.round(n * 100) / 100;
  const num = (v) => {
    if (typeof v === 'number') return v;
    let t = String(v == null ? '' : v).replace(/[^\d.,-]/g, '');
    if (!t || t === '-') return NaN;
    if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
    return Number(t);
  };
  const inteiro = (v) => (typeof v === 'string' && /^\s*\d{1,3}(\.\d{3})+\s*$/.test(v) ? Number(v.replace(/\./g, '')) : num(v));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  // SUPOSIÇÃO: valor do milheiro (R$ por 1.000 milhas) de referência por programa. É estimativa; o usuário edita.
  const REFERENCIA = { 'Smiles': 16, 'LATAM Pass': 25, 'Azul Fidelidade': 20, 'Livelo': 20, 'Esfera': 20, 'TAP Miles&Go': 25 };
  const REFERENCIA_GERAL = 20; // SUPOSIÇÃO: mesmo padrão que a aba Milhas já usa
  const ALIAS = { 'tudoazul': 'Azul Fidelidade', 'tudo azul': 'Azul Fidelidade', 'azul': 'Azul Fidelidade', 'latam': 'LATAM Pass', 'latampass': 'LATAM Pass', 'multiplus': 'LATAM Pass' };
  const nomePrograma = (n) => { const k = norm(n); const dir = Object.keys(REFERENCIA).find((x) => norm(x) === k); return dir || ALIAS[k] || String(n || '').trim(); };

  /** Milheiro de referência de um programa: o que o usuário informou na carteira, senão o padrão (estimativa). */
  function referencia(programa, carteira) {
    const p = (carteira || []).find((x) => nomePrograma(x.programa) === nomePrograma(programa) && Number(x.valor_milheiro) > 0);
    if (p) return { valor: Number(p.valor_milheiro), origem: 'informado por você' };
    const n = nomePrograma(programa);
    return REFERENCIA[n] ? { valor: REFERENCIA[n], origem: 'estimativa padrão' } : { valor: REFERENCIA_GERAL, origem: 'estimativa padrão' };
  }

  /** Custo do milheiro de uma compra/promoção. milhas = base; bonus_pct opcional soma milhas extras. */
  function custoMilheiro({ preco, milhas, bonus_pct }) {
    preco = num(preco); milhas = inteiro(milhas); const b = bonus_pct === undefined || bonus_pct === '' ? 0 : num(bonus_pct);
    if (!(milhas > 0) || !Number.isFinite(preco) || preco < 0 || !Number.isFinite(b) || b < 0) return { erro: 'Diga o preço e as milhas (maiores que zero).' };
    const total = Math.round(milhas * (1 + b / 100));
    return { milhas_total: total, custo_milheiro: r2(preco / total * 1000) };
  }

  /** Transferência com bônus. custo_milheiro_banco (R$ por 1.000 pontos do banco) é opcional. */
  function transferencia({ pontos, bonus_pct, custo_milheiro_banco }) {
    pontos = inteiro(pontos); const b = bonus_pct === undefined || bonus_pct === '' ? 0 : num(bonus_pct);
    if (!(pontos > 0) || !Number.isFinite(b) || b < 0) return { erro: 'Diga quantos pontos e o bônus (0 ou mais).' };
    const milhas = Math.round(pontos * (1 + b / 100));
    const out = { milhas, bonus_milhas: milhas - Math.round(pontos), custo_total: null, custo_efetivo_milheiro: null };
    const c = custo_milheiro_banco === undefined || custo_milheiro_banco === '' ? NaN : num(custo_milheiro_banco);
    if (Number.isFinite(c) && c >= 0) { out.custo_total = r2(pontos / 1000 * c); out.custo_efetivo_milheiro = r2(out.custo_total / milhas * 1000); }
    return out;
  }

  /** Vale assinar o clube? Compara a mensalidade com comprar as mesmas milhas avulsas ao milheiro de referência. */
  function clube({ mensalidade, milhas_mes, bonus_pct, referencia: ref }) {
    mensalidade = num(mensalidade); milhas_mes = inteiro(milhas_mes); ref = num(ref); const b = bonus_pct === undefined || bonus_pct === '' ? 0 : num(bonus_pct);
    if (!(mensalidade > 0) || !(milhas_mes > 0) || !(ref > 0) || !Number.isFinite(b) || b < 0) return { erro: 'Diga a mensalidade, as milhas do mês e o milheiro de referência.' };
    const efetivas = Math.round(milhas_mes * (1 + b / 100));
    const avulso = r2(efetivas / 1000 * ref);
    const economia = r2(avulso - mensalidade);
    return { milhas_efetivas: efetivas, custo_milheiro_clube: r2(mensalidade / efetivas * 1000), custo_avulso: avulso, economia_mensal: economia, economia_anual: r2(economia * 12), vale: economia > 0 };
  }

  /** Valor da carteira em reais. refs = { programa: milheiroEditado } (opcional); senão a carteira/padrão. */
  function valorCarteira(carteira, refs) {
    const linhas = (carteira || []).filter((p) => p && p.programa).map((p) => {
      const o = refs && Number(refs[p.programa]) > 0 ? { valor: Number(refs[p.programa]), origem: 'editado agora' } : referencia(p.programa, carteira);
      return { programa: p.programa, saldo: p.saldo, milheiro: o.valor, origem: o.origem, valor: r2(p.saldo / 1000 * o.valor) };
    });
    return { linhas, total: r2(linhas.reduce((s, l) => s + l.valor, 0)) };
  }

  /** Viagem: dinheiro x milhas (valor das milhas no milheiro de referência + taxas) e se dá para emitir. */
  function analisarViagem(v, carteira) {
    const ref = referencia(v.programa, carteira);
    const custoMilhas = r2(v.milhas / 1000 * ref.valor);
    const custoTotal = r2(custoMilhas + (v.taxas || 0));
    const economia = r2(v.preco_dinheiro - custoTotal);
    const lista = (carteira || []).filter((p) => p && p.programa);
    const soma = lista.reduce((s, p) => s + (Number(p.saldo) || 0), 0);
    const doProg = v.programa ? lista.filter((p) => nomePrograma(p.programa) === nomePrograma(v.programa)).reduce((s, p) => s + (Number(p.saldo) || 0), 0) : 0;
    let emitir; let aviso;
    if (v.programa && doProg >= v.milhas) { emitir = true; aviso = `Dá para emitir: você tem ${doProg.toLocaleString('pt-BR')} milhas na ${v.programa}.`; }
    else if (soma >= v.milhas) { emitir = true; aviso = `Dá para emitir somando seus programas (${soma.toLocaleString('pt-BR')} no total)${v.programa ? ', mas é preciso transferir para a ' + v.programa : ''}.`; }
    else { emitir = false; aviso = `Faltam ${(v.milhas - soma).toLocaleString('pt-BR')} milhas somando todos os seus programas.`; }
    return { referencia: ref.valor, referencia_origem: ref.origem, custo_milhas: custoMilhas, custo_total_milhas: custoTotal, economia, compensa: economia > 0,
      valor_milheiro_resgate: v.milhas > 0 ? r2((v.preco_dinheiro - (v.taxas || 0)) / v.milhas * 1000) : null, emitir, aviso_emitir: aviso, saldo_total: soma, saldo_programa: doProg };
  }

  /** Links oficiais de busca (só sites oficiais). */
  function linksViagem(v) {
    const q = encodeURIComponent(`Flights from ${v.origem} to ${v.destino} on ${v.data_ida}${v.data_volta ? ' through ' + v.data_volta : ''}`);
    return [
      { nome: 'Smiles', url: 'https://www.smiles.com.br/' },
      { nome: 'LATAM', url: 'https://www.latamairlines.com/br/pt' },
      { nome: 'Azul', url: 'https://www.voeazul.com.br/' },
      { nome: 'Google Voos', url: `https://www.google.com/travel/flights?q=${q}` },
    ];
  }

  // ---- Tela das calculadoras (usada pela aba Milhas). `el` = área da aba; `carteira` = pontos_listar().itens ----
  function htmlCalculadoras() {
    const campo = (id, rotulo, ph) => `<label>${rotulo}</label><input id="${id}" type="number" step="0.01" inputmode="decimal"${ph ? ` placeholder="${ph}"` : ''}>`;
    return `<div class="card" id="mc-calc"><h3 style="margin:0 0 6px">🧮 Calculadoras de milhas</h3>
      <div class="n" style="margin-top:8px">1) Quanto custa o milheiro?</div>
      ${campo('mc1-preco', 'Quanto você pagou (R$)')}${campo('mc1-milhas', 'Milhas que recebeu (sem o bônus)')}${campo('mc1-bonus', 'Bônus % da promoção (opcional)', '0')}
      <button class="btn" id="mc1-ir" type="button" style="margin-top:8px">Calcular</button><div id="mc1-res"></div>
      <div class="n" style="margin-top:14px">2) Transferir pontos com bônus</div>
      ${campo('mc2-pontos', 'Pontos do banco')}${campo('mc2-bonus', 'Bônus %')}${campo('mc2-custo', 'Quanto custa 1.000 pontos do banco (R$, opcional)')}
      <button class="btn" id="mc2-ir" type="button" style="margin-top:8px">Calcular</button><div id="mc2-res"></div>
      <div class="n" style="margin-top:14px">3) Vale assinar o clube?</div>
      ${campo('mc3-mensal', 'Mensalidade do clube (R$)')}${campo('mc3-milhas', 'Milhas que o clube dá por mês')}${campo('mc3-bonus', 'Bônus % na transferência (opcional)', '0')}${campo('mc3-ref', 'Quanto você pagaria por 1.000 milhas avulsas (R$)', '20')}
      <button class="btn" id="mc3-ir" type="button" style="margin-top:8px">Calcular</button><div id="mc3-res"></div></div>`;
  }
  function ligarCalculadoras(el, brl, esc) {
    const v = (id) => el.querySelector(id).value;
    const mostrar = (id, html) => { el.querySelector(id).innerHTML = html; };
    const erro = (e) => `<div class="fraco verm">${esc(e)}</div>`;
    const milh = (n) => Number(n).toLocaleString('pt-BR');
    el.querySelector('#mc1-ir').onclick = () => {
      const r = custoMilheiro({ preco: v('#mc1-preco'), milhas: v('#mc1-milhas'), bonus_pct: v('#mc1-bonus') });
      mostrar('#mc1-res', r.erro ? erro(r.erro) : `<div class="card" style="margin-top:8px"><div class="n">${brl(r.custo_milheiro)} o milheiro</div><div class="fraco">Você recebe ${milh(r.milhas_total)} milhas no total.</div></div>`);
    };
    el.querySelector('#mc2-ir').onclick = () => {
      const r = transferencia({ pontos: v('#mc2-pontos'), bonus_pct: v('#mc2-bonus'), custo_milheiro_banco: v('#mc2-custo') });
      mostrar('#mc2-res', r.erro ? erro(r.erro) : `<div class="card" style="margin-top:8px"><div class="n">${milh(r.milhas)} milhas</div><div class="fraco">${r.custo_efetivo_milheiro === null ? 'Diga quanto custam 1.000 pontos do banco para eu calcular o custo.' : `Custo efetivo: ${brl(r.custo_efetivo_milheiro)} o milheiro (você gasta ${brl(r.custo_total)} nos pontos).`}</div></div>`);
    };
    el.querySelector('#mc3-ir').onclick = () => {
      const r = clube({ mensalidade: v('#mc3-mensal'), milhas_mes: v('#mc3-milhas'), bonus_pct: v('#mc3-bonus'), referencia: v('#mc3-ref') });
      mostrar('#mc3-res', r.erro ? erro(r.erro) : `<div class="card" style="margin-top:8px"><div class="n">${r.vale ? '✅ Vale assinar' : '🔴 Não vale assinar'}</div><div class="fraco">Pelo clube: ${brl(r.custo_milheiro_clube)} o milheiro (${milh(r.milhas_efetivas)} milhas por mês). Comprando avulso as mesmas milhas: ${brl(r.custo_avulso)}. ${r.vale ? 'Você economiza' : 'Você perde'} ${brl(Math.abs(r.economia_mensal))} por mês (${brl(Math.abs(r.economia_anual))} por ano). Estimativa.</div></div>`);
    };
  }

  MB.milhas = { REFERENCIA, REFERENCIA_GERAL, nomePrograma, referencia, custoMilheiro, transferencia, clube, valorCarteira, analisarViagem, linksViagem, htmlCalculadoras, ligarCalculadoras };
})();
