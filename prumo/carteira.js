'use strict';
// Prumo: aba carteira. Usa window.MB (casca em app.js) e as peças de /prumo/ui.js.

/** Vários prints da MESMA tela (rolada) têm um total só, no topo do primeiro. Junta cada print sem total
 *  (ou com o mesmo total) ao último total visto, tira os itens repetidos entre prints e compara a soma.
 *  conferencia[i].itens = quantos itens vieram do print i, na ordem de "itens". dup[k] = item k repetido. */
function conferirTotais(conferencia, itens, dup) {
  const lista = (conferencia || []).filter(Boolean);
  if (!lista.length || lista.some((c) => !Number.isInteger(c.itens))) return lista; // leitura antiga: mantém como veio
  const cent = (v) => Math.round(v * 100) / 100;
  let k = 0; let cur = null; const grupos = [];
  for (const c of lista) {
    let soma = 0;
    for (let n = 0; n < c.itens; n++, k++) if (!(dup && dup[k])) soma += Number(itens[k] && itens[k].valor) || 0;
    const t = Number(c.total_print) > 0 ? Number(c.total_print) : null;
    if (t && (!cur || !cur.t || Math.abs(cur.t - t) > 0.01)) { cur = { t, soma: 0 }; grupos.push(cur); } else if (!cur) { cur = { t: null, soma: 0 }; grupos.push(cur); }
    cur.soma += soma;
  }
  const comTotal = grupos.filter((g) => g.t);
  const tudoT = comTotal.reduce((a, g) => a + g.t, 0); const tudoS = grupos.reduce((a, g) => a + g.soma, 0);
  const geral = tudoT > 0 && Math.abs(tudoT - tudoS) <= 1; // a ordem dos prints veio trocada, mas o todo bate
  return comTotal.map((g) => ({ total_print: cent(g.t), soma_itens: cent(g.soma), diferenca: cent(g.soma - g.t), confere: geral || Math.abs(g.t - g.soma) <= 1 })); // #3532: tolerância de R$ 1
}
/** Chave do ativo (#3267): banco + (ticker ou nome), sem acento/maiúscula/"S.A."/"Ltda"/palavras soltas (do, da, de).
 *  Igual a chaveAtivo de netlify/functions/prumo.js (teste KF-010). */
function chaveAtivo(x) {
  const n = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\b(s\.?a\.?|ltda)\b/g, ' ').replace(/[^a-z0-9%]+/g, ' ').replace(/\b(do|da|de|dos|das|e)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const tk = String((x && x.ticker) || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (tk) return `tk|${tk}`; // #3532: com ticker, só o ticker (igual ao servidor)
  return [n(x && x.banco), n(x && x.nome)].join('|');
}
if (typeof module !== 'undefined' && module.exports) module.exports = { conferirTotais, chaveAtivo };

if (typeof window !== 'undefined') (function () {
  const MB = window.MB;
  let brl, esc, TIPOS, CATS, hoje, opcoes, barra, formulario, reduzir, recarregar, ok;
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });
  MB.telas.carteira = async (el) => {
    ({ brl, esc, TIPOS, CATS, hoje, opcoes, barra, formulario, reduzir, recarregar, ok } = await carregarUi());
    MB.ui.aba('carteira');
    const [{ itens }, { objetivos }] = await Promise.all([MB.api('carteira_listar'), MB.api('objetivo_listar')]);
    const por_tipo = {};
    let total = 0;
    itens.forEach((i) => { total += Number(i.valor) || 0; por_tipo[i.tipo] = (por_tipo[i.tipo] || 0) + (Number(i.valor) || 0); });
    const nomeObj = Object.fromEntries(objetivos.map((o) => [o.id, o.nome]));
    const optObj = (sel) => `<option value="">Sem objetivo</option>` + objetivos.map((o) => `<option value="${o.id}"${o.id === sel ? ' selected' : ''}>${esc(o.nome)}</option>`).join('');
    const bancos = {};
    itens.forEach((i) => { const b = i.banco || 'Não informado'; bancos[b] = (bancos[b] || 0) + i.valor; });
    const tipos = Object.entries(por_tipo).sort((a, b) => b[1] - a[1]);
    el.innerHTML = `
      <div class="card"><div class="fraco">Patrimônio total</div><div class="grande" id="total-vivo">${brl(total)}</div><div class="fraco" id="selo-vivo">Buscando cotações ao vivo…</div><button class="btn sec" id="atualizar-vivo" style="margin-top:6px">🔄 Atualizar agora</button><div id="assessor-vivo" style="margin-top:10px"></div>
        ${tipos.map(([t, v]) => `<div style="margin-top:8px"><div class="item" style="padding:0;border:0"><span>${esc(TIPOS[t] || t)}</span><span>${brl(v)}</span></div>${barra(total ? (v / total) * 100 : 0)}</div>`).join('')}
      </div>
      <div class="linha" style="margin-bottom:12px"><button class="btn sec" id="add">✍️ Preencher</button><button class="btn" id="print">📷 Só mandar os prints</button></div>
      <input type="file" id="arq" accept="image/*" multiple hidden>
      ${Object.keys(bancos).length > 1 ? `<div class="card"><div class="fraco">Por banco</div>${Object.entries(bancos).map(([b, v]) => `<div class="item"><span>${esc(b)}</span><span class="v">${brl(v)}</span></div>`).join('')}</div>` : ''}
      <div class="card">${itens.length ? itens.map((i) => `<div class="item" data-id="${i.id}"><div><div class="n">${esc(i.nome)}</div><div class="fraco">${esc(i.banco || 'Banco não informado')} · ${esc(TIPOS[i.tipo] || i.tipo)}${i.ticker ? ' · ' + esc(i.ticker) : ''}${i.quantidade ? ' · ' + esc(i.quantidade) + ' cotas' : ''}${i.objetivo_id && nomeObj[i.objetivo_id] ? ' · 🎯 ' + esc(nomeObj[i.objetivo_id]) : ''} · ${esc(i.data_valor || '')}</div></div><div class="v">${brl(i.valor)}</div><div class="fraco" data-vivo="${i.id}"></div></div>`).join('') : '<p class="fraco">Nada ainda. Toque em "Só mandar os prints" e mande os prints do app do banco, da previdência e do FGTS, ou preencha à mão.</p>'}</div>
      ${itens.length ? '<button class="btn sec" id="limpar" style="width:100%">🧹 Limpar e refazer a carteira</button>' : ''}`;

    const editar = (i) => formulario(i ? 'Editar investimento' : 'Novo investimento', [
      { nome: 'nome', rotulo: 'Nome (ex.: CDB Inter 2028)', valor: i && i.nome },
      { nome: 'banco', rotulo: 'Banco ou corretora', valor: i && i.banco },
      { nome: 'tipo', rotulo: 'Tipo', opcoes: opcoes(TIPOS, i ? i.tipo : 'renda_fixa') },
      { nome: 'valor', rotulo: 'Saldo atual (R$)', tipo: 'number', valor: i && i.valor },
      { nome: 'data_valor', rotulo: 'Data do saldo', tipo: 'date', valor: (i && i.data_valor) || hoje() },
      { nome: 'vencimento', rotulo: 'Vencimento (se tiver)', tipo: 'date', valor: i && i.vencimento },
      { nome: 'taxa', rotulo: 'Rentabilidade (ex.: 110% CDI)', valor: i && i.taxa },
      { nome: 'objetivo_id', rotulo: 'Objetivo', opcoes: optObj(i && i.objetivo_id) },
    ], (d) => { const x = { ...d, valor: Number(d.valor), id: i && i.id, origem: (i && i.origem) || 'mao' }; ['objetivo_id', 'vencimento', 'taxa'].forEach((k) => { if (!x[k]) delete x[k]; }); return MB.api('carteira_salvar', x); }, i && (() => MB.api('carteira_apagar', { id: i.id })));

    el.querySelector('#add').onclick = () => editar(null);
    const limpar = el.querySelector('#limpar');
    if (limpar) limpar.onclick = async () => {
      const t = prompt('Isso apaga TODOS os investimentos salvos para você mandar os prints de novo. Para confirmar, escreva LIMPAR');
      if (String(t || '').trim().toUpperCase() !== 'LIMPAR') return;
      try { const r = await MB.api('carteira_limpar', { confirmar: 'LIMPAR' }); apagarRascunho(); ok(`🧹 ${r.apagados || 0} investimento(s) apagados. Agora mande os prints de novo.`); } catch { /* erro já mostrado */ }
      recarregar();
    };
    el.querySelectorAll('.item[data-id]').forEach((n) => { n.onclick = () => editar(itens.find((x) => x.id === n.dataset.id)); });
    const arq = el.querySelector('#arq');
    el.querySelector('#print').onclick = () => arq.click();
    arq.onchange = async () => {
      const files = [...arq.files].slice(0, MAX_PRINTS);
      if (!files.length) return;
      if (arq.files.length > MAX_PRINTS) MB.mostrarErro(`Mandei só os ${MAX_PRINTS} primeiros prints.`);
      // Vários prints de uma vez: vão em grupos de 5, com progresso na tela.
      const lidos = { itens: [], descartados: [], conferencia: [] };
      let falhas = 0;
      for (let i = 0; i < files.length; i += 5) {
        const grupo = files.slice(i, i + 5);
        el.innerHTML = `<div class="card">📷 Lendo prints ${i + 1} a ${i + grupo.length} de ${files.length}… cada grupo leva até 2 minutos. Não feche o app.</div>`;
        try {
          const r = await MB.api('ler_print', { imagens: await Promise.all(grupo.map(reduzir)) });
          lidos.itens.push(...(r.itens || [])); lidos.descartados.push(...(r.descartados || [])); lidos.conferencia.push(...(r.conferencia || []));
        } catch { falhas += grupo.length; }
      }
      if (!lidos.itens.length) { if (!falhas) conferir(el, lidos, optObj, itens); else recarregar(); return; }
      if (falhas) MB.mostrarErro(`${falhas} print(s) não foram lidos. Mande de novo só esses.`);
      guardarRascunho(lidos);
      conferir(el, lidos, optObj, itens);
    };
    if (itens.length) aoVivo(el);
    // Itens lidos e ainda não salvos ficam guardados só neste celular até salvar ou cancelar.
    const rascunho = lerRascunho();
    if (rascunho) conferir(el, rascunho, optObj, itens);
  };

  // #3304: cotação ao vivo. Valor de cada ativo = quantidade × cotação; CDB rende pelo CDI desde o print.
  // Atualiza ao abrir, no botão e a cada 60 s durante o pregão enquanto a tela está aberta.
  function aoVivo(el) {
    const pct = (v) => (v > 0 ? '+' : '') + String(v).replace('.', ',') + '%';
    const minutos = (iso) => { const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000)); return m < 1 ? 'agora' : `há ${m} min`; };
    let timer = null; let aporte = 0;
    const pctTxt = (v) => (v == null ? '—' : (v > 0 ? '+' : '') + String(v).replace('.', ',') + '%');
    const rodar = async () => {
      if (!document.contains(el.querySelector('#selo-vivo'))) { clearInterval(timer); return; }
      el.querySelector('#selo-vivo').textContent = 'Atualizando cotações…';
      let r;
      try { r = await MB.api('cotacoes_vivas', { aporte }); } catch { el.querySelector('#selo-vivo').textContent = 'Sem cotação ao vivo agora; mostrando os valores do print.'; return; }
      el.querySelector('#total-vivo').textContent = brl(r.total);
      const dif = r.variacao ? ` (${r.variacao > 0 ? '+' : ''}${brl(r.variacao)} desde o print)` : '';
      const velhas = r.itens.filter((i) => i.vivo && i.vivo.desatualizada).length;
      el.querySelector('#selo-vivo').innerHTML = `🟢 Ao vivo · atualizado ${esc(minutos(r.atualizado_em))}${esc(dif)}${r.em_pregao ? '' : ' · bolsa fechada (último preço)'}${velhas ? ` · <b style="color:#f5b041">${velhas} cotação(ões) desatualizada(s)</b>` : ''}${r.indices && r.indices.cdi_dia_pct ? ` · CDI ${esc(String(r.indices.cdi_dia_pct).replace('.', ','))}% ao dia` : ''}`;
      for (const i of r.itens) {
        const linha = el.querySelector(`.item[data-id="${i.id}"]`); const info = el.querySelector(`[data-vivo="${i.id}"]`);
        if (!linha || !i.vivo) continue;
        linha.querySelector('.v').textContent = brl(i.vivo.valor);
        if (info) info.innerHTML = i.vivo.estimado
          ? `≈ pelo CDI, ${i.vivo.dias_uteis} dia(s) útil(eis) desde o print`
          : `${brl(i.vivo.preco)}${i.vivo.variacao_dia_pct != null ? ` (${esc(pct(i.vivo.variacao_dia_pct))} hoje)` : ''}${i.vivo.ganho != null ? ` · <span style="color:${i.vivo.ganho >= 0 ? '#58d68d' : '#ec7063'}">${i.vivo.ganho >= 0 ? '↑' : '↓'} ${brl(Math.abs(i.vivo.ganho))}</span>` : ''} · ${esc(i.vivo.fonte || '')} ${esc(minutos(i.vivo.data_hora))}${i.vivo.desatualizada ? ' <b style="color:#f5b041">desatualizada</b>' : ''}`;
      }
      const a = r.assessor || {};
      const box = el.querySelector('#assessor-vivo');
      if (box && !box.querySelector('details[open]')) box.innerHTML = `<div class="fraco">🧭 Seu assessor</div>
        ${a.renda_mensal_estimada ? `<div class="item"><span>Renda de proventos (média 12 meses)</span><span class="v">${brl(a.renda_mensal_estimada)}/mês</span></div>` : ''}
        ${a.benchmarks ? `<div class="fraco" style="margin-top:6px">📊 Em 12 meses: CDI ${pctTxt(a.benchmarks.cdi_12m_pct)} · IFIX ${pctTxt(a.benchmarks.ifix_12m_pct)} · Ibovespa ${pctTxt(a.benchmarks.ibov_12m_pct)} · S&P 500 em reais ${pctTxt(a.benchmarks.ivvb11_12m_pct)}${a.renda_variavel_sobre_custo_pct != null ? ` · seus FIIs/ETF: ${pctTxt(a.renda_variavel_sobre_custo_pct)} sobre o que você pagou` : ''}</div>` : ''}
        ${a.rebalanceamento && a.rebalanceamento.comprar.length ? `<div class="fraco" style="margin-top:6px">⚖️ Para chegar na sua meta com ${brl(a.rebalanceamento.aporte)}: ${a.rebalanceamento.comprar.map((x) => `${esc(TIPOS[x.tipo] || x.tipo)} ${brl(x.valor)}`).join(' · ')}. <i>${esc(a.rebalanceamento.aviso)}</i></div>` : ''}
        <details style="margin-top:6px"><summary class="fraco">⚖️ Minha meta de alocação e aporte</summary>
          <div class="fraco">Ponha a % que você quer em cada tipo (soma 100).</div>
          ${['renda_fixa', 'fiis', 'etf', 'acoes'].map((t) => `<label>${esc(TIPOS[t] || t)} (%)</label><input type="number" step="1" data-alvo="${t}" value="${a.alocacao_alvo && a.alocacao_alvo[t] != null ? a.alocacao_alvo[t] : ''}">`).join('')}
          <label>Quanto vou aportar (R$)</label><input type="number" step="0.01" id="aporte-vivo" value="${a.rebalanceamento ? a.rebalanceamento.aporte || '' : ''}">
          <button class="btn sec" id="salvar-alvo" style="margin-top:6px">Calcular sugestão</button></details>
        ${(a.alertas || []).map((x) => `<p style="margin:6px 0;color:${x.tipo === 'alta' ? '#58d68d' : '#f5b041'}">${x.tipo === 'alta' ? '📈' : '⚠️'} ${esc(x.texto)}</p>`).join('') || '<p class="fraco">Nenhum alerta agora.</p>'}`;
      const sa = el.querySelector('#salvar-alvo');
      if (sa) sa.onclick = async () => {
        const alvo = {}; el.querySelectorAll('[data-alvo]').forEach((f) => { if (Number(f.value) > 0) alvo[f.dataset.alvo] = Number(f.value); });
        try { await MB.api('alocacao_alvo_salvar', { alvo }); aporte = Number(el.querySelector('#aporte-vivo').value) || 0; rodar(); } catch { /* erro já mostrado */ }
      };
      for (const i of r.itens) {
        const info = el.querySelector(`[data-vivo="${i.id}"]`);
        if (info && i.vivo && (i.peso_pct || i.renda_mensal)) info.innerHTML += `<br>peso ${esc(String(i.peso_pct).replace('.', ','))}%${i.renda_mensal ? ` · proventos ≈ ${brl(i.renda_mensal)}/mês${i.yield_on_cost_pct ? ` (${esc(String(i.yield_on_cost_pct).replace('.', ','))}% a.a. sobre o que você pagou)` : ''}` : ''}`;
      }
      if (r.em_pregao && !timer) timer = setInterval(rodar, 60000);
    };
    const b = el.querySelector('#atualizar-vivo'); if (b) b.onclick = rodar;
    rodar();
  }

  const MAX_PRINTS = 15;
  const CHAVE = 'fortune-lidos';
  function guardarRascunho(l) { try { localStorage.setItem(CHAVE, JSON.stringify(l)); } catch { /* sem armazenamento */ } }
  function lerRascunho() { try { const l = JSON.parse(localStorage.getItem(CHAVE) || 'null'); return l && Array.isArray(l.itens) && l.itens.length ? l : null; } catch { return null; } }
  function apagarRascunho() { try { localStorage.removeItem(CHAVE); } catch { /* sem armazenamento */ } }

  // Mesmo banco + mesmo investimento (ticker ou nome) = mesmo item.
  const chave = chaveAtivo;

  function conferir(el, { itens, descartados, conferencia }, optObj, atuais) {
    if (!itens.length) { el.innerHTML = '<div class="card">Não achei valores nesses prints. Tente um print mais nítido ou preencha à mão.</div><button class="btn sec" id="volta">Voltar</button>'; el.querySelector('#volta').onclick = recarregar; return; }
    // Situação de cada item: novo, atualiza um que já existe, ou repetido nestes prints.
    const ja = new Map(atuais.map((a) => [chave(a), a]));
    const vistos = new Map();
    const situ = itens.map((i) => {
      let k = chave(i);
      // Mesmo nome com valor diferente = outra linha do mesmo plano: renomeia para não sobrescrever ao salvar.
      if (!i.ticker && vistos.has(k) && vistos.get(k) !== Number(i.valor)) { let n = 2; while (vistos.has(chave({ ...i, nome: `${i.nome} (linha ${n})` }))) n++; i.nome = `${i.nome} (linha ${n})`; k = chave(i); }
      // Depois disso, mesma chave = mesma posição repetida (o mesmo print mandado duas vezes).
      if (vistos.has(k)) return { s: 'dup', txt: '⚠️ Repetido nestes prints (não vou salvar duas vezes)' };
      vistos.set(k, Number(i.valor));
      const a = ja.get(k);
      return a ? { s: 'atu', txt: `🔄 Atualiza: ${brl(a.valor)} → ${brl(i.valor)}` } : { s: 'novo', txt: '🆕 Novo' };
    });
    const totais = conferirTotais(conferencia, itens, situ.map((x) => x.s === 'dup'));
    const avisos = totais.filter((c) => c && c.total_print).map((c) => c.confere === false
      ? `<p style="color:#ec7063" class="nao-bate">❌ Não bate com o print: a soma dos itens (${brl(c.soma_itens)}) é diferente do total do print (${brl(c.total_print)}), diferença de ${brl(Math.abs(c.soma_itens - c.total_print))}.${c.soma_itens < c.total_print ? ` Faltam ${brl(c.total_print - c.soma_itens)}: mande o print que ficou de fora ou adicione à mão depois.` : ' Confira os valores abaixo.'}</p>`
      : (c.confere ? `<p style="color:#58d68d">✅ Soma confere com o total do print (${brl(c.total_print)}).</p>` : '')).join('');
    const semBanco = itens.filter((i) => !String(i.banco || '').trim()).length;
    const conhecidos = [...new Set(atuais.map((a) => a.banco).filter(Boolean).concat(['Inter', 'Nubank', 'XP', 'BTG Pactual', 'Itaú', 'Bradesco', 'Banco do Brasil', 'Caixa', 'Santander', 'Rico', 'Clear', 'NuInvest']))];
    el.innerHTML = `<div class="card"><b>Confira antes de salvar</b>${avisos}<p class="fraco">Corrija o que estiver errado e desmarque o que não quer salvar. Ainda não foi salvo na sua carteira, mas fica guardado neste celular até você salvar ou cancelar.</p>
      ${itens.map((i, n) => `<div class="card" data-n="${n}" style="background:#0e1a14">
        <div class="fraco">${situ[n].txt}</div>
        <label><input type="checkbox"${situ[n].s === 'dup' ? '' : ' checked'} style="width:auto;min-height:0"> Salvar este</label>
        <label>Nome</label><input data-k="nome" value="${esc(i.nome)}">
        <label>Banco</label><input data-k="banco" value="${esc(i.banco)}">
        <label>Tipo</label><select data-k="tipo">${opcoes(TIPOS, i.tipo)}</select>
        ${i.ticker || i.quantidade ? `<div class="fraco">${esc(i.ticker || '')}${i.quantidade ? ' · ' + esc(i.quantidade) + ' cotas' : ''}${i.preco_medio ? ' · preço médio ' + brl(i.preco_medio) : ''}${i.cotacao ? ' · cotação ' + brl(i.cotacao) : ''}${i.corrigido_por_cotacao ? ` · ✔️ valor = quantidade × cotação (a leitura tinha dado ${brl(i.valor_lido)})` : ''}</div>` : ''}
        <label>Saldo atual (R$)</label><input data-k="valor" type="number" step="0.01" value="${i.valor}">
        <label>Objetivo</label><select data-k="objetivo_id">${optObj('')}</select></div>`).join('')}
      ${semBanco ? `<div class="card" id="escolher-banco"><div class="fraco">🏦 ${semBanco} item(ns) sem banco: o nome do banco não está escrito no print. De qual banco ou corretora são estes prints?</div>
        <input id="banco-lote" list="bancos-conhecidos" placeholder="Ex.: Inter, Nubank, XP"><datalist id="bancos-conhecidos">${conhecidos.map((b) => `<option value="${esc(b)}">`).join('')}</datalist>
        <button class="btn sec" id="aplicar-banco" style="margin-top:6px">Usar este banco em todos sem banco</button></div>` : ''}
      ${descartados && descartados.length ? `<p class="fraco">${descartados.length} item(ns) sem valor legível foram ignorados.</p>` : ''}
      <div class="linha"><button class="btn sec" id="cancelar">Cancelar</button><button class="btn" id="salvar">Salvar selecionados</button></div>
      ${atuais.length ? '<button class="btn sec" id="refazer" style="width:100%;margin-top:8px">♻️ Refazer carteira a partir destes prints</button><p class="fraco">Apaga os itens que vieram de prints antigos (os que você digitou à mão ficam) e salva só esta leitura.</p>' : ''}</div>`;
    el.querySelector('#cancelar').onclick = () => { apagarRascunho(); recarregar(); };
    const ab = el.querySelector('#aplicar-banco');
    if (ab) ab.onclick = () => {
      const b = el.querySelector('#banco-lote').value.trim(); if (!b) return;
      el.querySelectorAll('[data-n] [data-k="banco"]').forEach((f) => { if (!f.value.trim()) f.value = b; });
      itens.forEach((i) => { if (!String(i.banco || '').trim()) i.banco = b; }); guardarRascunho({ itens, descartados, conferencia });
      el.querySelector('#escolher-banco').innerHTML = `<div class="fraco">🏦 Banco ${esc(b)} aplicado.</div>`;
    };
    const salvarEscolhidos = async (atuais) => {
      const escolhidos = [...el.querySelectorAll('[data-n]')].filter((c) => c.querySelector('input[type=checkbox]').checked).map((c) => {
        const base = { ...itens[Number(c.dataset.n)], origem: 'print' };
        c.querySelectorAll('[data-k]').forEach((f) => { base[f.dataset.k] = f.dataset.k === 'valor' ? Number(f.value) : f.value; });
        return base;
      });
      if (!escolhidos.length) { apagarRascunho(); return recarregar(); }
      let salvos = 0;
      // Mesmo banco + mesmo investimento = atualiza (não duplica, nem quando o mesmo item vem em dois prints).
      const existentes = new Map(atuais.map((a) => [chave(a), a]));
      for (const it of escolhidos) {
        const igual = existentes.get(chave(it));
        const dados = { ...it, valor: Number(it.valor) };
        if (igual) { dados.id = igual.id; if (!dados.objetivo_id && igual.objetivo_id) dados.objetivo_id = igual.objetivo_id; }
        if (!dados.objetivo_id) delete dados.objetivo_id;
        try { const r = await MB.api('carteira_salvar', dados); salvos++; existentes.set(chave(it), { ...dados, id: (r && r.id) || dados.id }); } catch { /* erro já mostrado */ }
      }
      if (salvos === escolhidos.length) apagarRascunho();
      else MB.mostrarErro(`${escolhidos.length - salvos} item(ns) não foram salvos e continuam guardados para tentar de novo.`);
      ok(`✅ ${salvos} investimento(s) salvos/atualizados.`);
      recarregar();
    };
    el.querySelector('#salvar').onclick = () => salvarEscolhidos(atuais);
    const rf = el.querySelector('#refazer');
    if (rf) rf.onclick = async () => {
      const t = prompt('Isso apaga os investimentos que vieram de prints antigos (os digitados à mão ficam) e salva só estes. Para confirmar, escreva REFAZER');
      if (String(t || '').trim().toUpperCase() !== 'REFAZER') return;
      try {
        await MB.api('carteira_limpar', { confirmar: 'LIMPAR', so_print: true });
        const { itens: restantes } = await MB.api('carteira_listar');
        await salvarEscolhidos(restantes);
      } catch { /* erro já mostrado */ }
    };
  }
})();
