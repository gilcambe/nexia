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
  const geral = tudoT > 0 && Math.abs(tudoT - tudoS) <= tudoT * 0.01; // a ordem dos prints veio trocada, mas o todo bate
  return comTotal.map((g) => ({ total_print: cent(g.t), soma_itens: cent(g.soma), confere: geral || Math.abs(g.t - g.soma) <= g.t * 0.01 }));
}
/** Chave do ativo (#3267): banco + (ticker ou nome), sem acento/maiúscula/"S.A."/"Ltda"/palavras soltas (do, da, de).
 *  Igual a chaveAtivo de netlify/functions/prumo.js (teste KF-010). */
function chaveAtivo(x) {
  const n = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\b(s\.?a\.?|ltda)\b/g, ' ').replace(/[^a-z0-9%]+/g, ' ').replace(/\b(do|da|de|dos|das|e)\b/g, ' ').replace(/\s+/g, ' ').trim();
  return [n(x && x.banco), n(x && (x.ticker || x.nome))].join('|');
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
    itens.forEach((i) => { const b = i.banco || 'Sem banco'; bancos[b] = (bancos[b] || 0) + i.valor; });
    const tipos = Object.entries(por_tipo).sort((a, b) => b[1] - a[1]);
    el.innerHTML = `
      <div class="card"><div class="fraco">Patrimônio total</div><div class="grande">${brl(total)}</div>
        ${tipos.map(([t, v]) => `<div style="margin-top:8px"><div class="item" style="padding:0;border:0"><span>${esc(TIPOS[t] || t)}</span><span>${brl(v)}</span></div>${barra(total ? (v / total) * 100 : 0)}</div>`).join('')}
      </div>
      <div class="linha" style="margin-bottom:12px"><button class="btn sec" id="add">✍️ Preencher</button><button class="btn" id="print">📷 Só mandar os prints</button></div>
      <input type="file" id="arq" accept="image/*" multiple hidden>
      ${Object.keys(bancos).length > 1 ? `<div class="card"><div class="fraco">Por banco</div>${Object.entries(bancos).map(([b, v]) => `<div class="item"><span>${esc(b)}</span><span class="v">${brl(v)}</span></div>`).join('')}</div>` : ''}
      <div class="card">${itens.length ? itens.map((i) => `<div class="item" data-id="${i.id}"><div><div class="n">${esc(i.nome)}</div><div class="fraco">${esc(i.banco || '')} · ${esc(TIPOS[i.tipo] || i.tipo)}${i.ticker ? ' · ' + esc(i.ticker) : ''}${i.quantidade ? ' · ' + esc(i.quantidade) + ' cotas' : ''}${i.objetivo_id && nomeObj[i.objetivo_id] ? ' · 🎯 ' + esc(nomeObj[i.objetivo_id]) : ''} · ${esc(i.data_valor || '')}</div></div><div class="v">${brl(i.valor)}</div></div>`).join('') : '<p class="fraco">Nada ainda. Toque em "Só mandar os prints" e mande os prints do app do banco, da previdência e do FGTS, ou preencha à mão.</p>'}</div>
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
    ], (d) => { const x = { ...d, valor: Number(d.valor), id: i && i.id }; ['objetivo_id', 'vencimento', 'taxa'].forEach((k) => { if (!x[k]) delete x[k]; }); return MB.api('carteira_salvar', x); }, i && (() => MB.api('carteira_apagar', { id: i.id })));

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
    // Itens lidos e ainda não salvos ficam guardados só neste celular até salvar ou cancelar.
    const rascunho = lerRascunho();
    if (rascunho) conferir(el, rascunho, optObj, itens);
  };

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
      ? `<p style="color:#f5b041">⚠️ A soma dos itens (${brl(c.soma_itens)}) não bate com o total do print (${brl(c.total_print)}).${c.soma_itens < c.total_print ? ` Faltam ${brl(c.total_print - c.soma_itens)}: mande o print que ficou de fora ou adicione à mão depois.` : ' Confira os valores abaixo.'}</p>`
      : (c.confere ? `<p style="color:#58d68d">✅ Soma confere com o total do print (${brl(c.total_print)}).</p>` : '')).join('');
    el.innerHTML = `<div class="card"><b>Confira antes de salvar</b>${avisos}<p class="fraco">Corrija o que estiver errado e desmarque o que não quer salvar. Ainda não foi salvo na sua carteira, mas fica guardado neste celular até você salvar ou cancelar.</p>
      ${itens.map((i, n) => `<div class="card" data-n="${n}" style="background:#0e1a14">
        <div class="fraco">${situ[n].txt}</div>
        <label><input type="checkbox"${situ[n].s === 'dup' ? '' : ' checked'} style="width:auto;min-height:0"> Salvar este</label>
        <label>Nome</label><input data-k="nome" value="${esc(i.nome)}">
        <label>Banco</label><input data-k="banco" value="${esc(i.banco)}">
        <label>Tipo</label><select data-k="tipo">${opcoes(TIPOS, i.tipo)}</select>
        ${i.ticker || i.quantidade ? `<div class="fraco">${esc(i.ticker || '')}${i.quantidade ? ' · ' + esc(i.quantidade) + ' cotas' : ''}${i.preco_medio ? ' · preço médio ' + brl(i.preco_medio) : ''}${i.cotacao ? ' · cotação ' + brl(i.cotacao) : ''}</div>` : ''}
        <label>Saldo atual (R$)</label><input data-k="valor" type="number" step="0.01" value="${i.valor}">
        <label>Objetivo</label><select data-k="objetivo_id">${optObj('')}</select></div>`).join('')}
      ${descartados && descartados.length ? `<p class="fraco">${descartados.length} item(ns) sem valor legível foram ignorados.</p>` : ''}
      <div class="linha"><button class="btn sec" id="cancelar">Cancelar</button><button class="btn" id="salvar">Salvar selecionados</button></div></div>`;
    el.querySelector('#cancelar').onclick = () => { apagarRascunho(); recarregar(); };
    el.querySelector('#salvar').onclick = async () => {
      const escolhidos = [...el.querySelectorAll('[data-n]')].filter((c) => c.querySelector('input[type=checkbox]').checked).map((c) => {
        const base = { ...itens[Number(c.dataset.n)] };
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
  }
})();
