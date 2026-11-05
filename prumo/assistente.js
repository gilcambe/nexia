'use strict';
// Kernex Finance: aba IA (assistente). Perguntas respondidas só com números reais e a fonte;
// comandos viram proposta e só gravam depois do botão Confirmar. Também: "Posso comprar isso?" e relatório do mês.
(function () {
  const MB = window.MB;
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });
  const SUG = ['Quanto tenho disponível?', 'Quanto gastei com alimentação?', 'Qual foi minha maior despesa?', 'Quanto devo nos cartões?', 'Registre uma despesa de R$ 50 em alimentação', 'Crie um limite de R$ 300 para lazer'];
  const COR = { sim: 'var(--verde)', 'com cuidado': '#f59e0b', 'melhor esperar': '#f59e0b', 'não': 'var(--perigo)' };
  const ICONE = { sim: '✅', 'com cuidado': '🟠', 'melhor esperar': '🟠', 'não': '🔴' };

  MB.telas.assistente = async (el) => {
    const { brl, esc, aba } = await carregarUi();
    aba('assistente');
    const cart = await MB.api('cartao_listar').catch(() => ({ cartoes: [] }));
    el.innerHTML = `
      <div class="card"><h3 style="margin:0 0 6px">🤖 Pergunte ao Kernex</h3>
        <div class="fraco">Respondo só com os seus números e digo de onde vieram. Se não souber, eu falo. Nunca pago, transfiro nem invisto.</div>
        <div id="chat" aria-live="polite"></div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin:10px 0" id="sug">${SUG.map((s) => `<button class="btn sec mini" type="button">${esc(s)}</button>`).join('')}</div>
        <div style="display:flex;gap:8px"><input id="pergunta" placeholder="Pergunte ou peça algo…" maxlength="300" style="flex:1"><button class="btn" id="enviar" type="button" aria-label="Enviar">➤</button></div></div>
      <div class="card"><h3 style="margin:0 0 6px">🛒 Posso comprar isso?</h3>
        <label>Valor (R$)</label><input id="pc-valor" type="number" step="0.01" inputmode="decimal">
        <label>Parcelas</label><input id="pc-parc" type="number" value="1" min="1" max="48">
        <label>Cartão (opcional)</label><select id="pc-cartao"><option value="">À vista, no saldo</option>${cart.cartoes.map((k) => `<option value="${esc(k.id)}">${esc(k.nome)}</option>`).join('')}</select>
        <button class="btn" id="pc-ir" type="button" style="margin-top:10px">Ver se posso</button><div id="pc-res"></div></div>
      <div class="card"><h3 style="margin:0 0 6px">📊 Relatório do mês</h3><button class="btn sec" id="rel-ir" type="button">Gerar relatório</button><div id="rel-res"></div></div>`;

    const chat = el.querySelector('#chat');
    const balao = (html, eu) => { const d = document.createElement('div'); d.style.cssText = `margin:8px 0;padding:10px 12px;border-radius:12px;background:${eu ? 'var(--azul)' : 'var(--cartao)'};border:1px solid var(--borda);${eu ? 'margin-left:24px' : 'margin-right:24px'}`; d.innerHTML = html; chat.appendChild(d); d.scrollIntoView({ block: 'nearest' }); return d; };
    const perguntar = async (texto) => {
      if (!texto.trim()) return;
      balao(esc(texto), true);
      el.querySelector('#pergunta').value = '';
      let r;
      try { r = await MB.api('assistente_perguntar', { texto }); } catch { return; }
      if (r.tipo === 'proposta') {
        const b = balao(`<div>${esc(r.resposta)}</div><div class="fraco">Nada foi gravado ainda.</div><div class="linha" style="margin-top:8px"><button class="btn mini" data-ok type="button">Confirmar</button><button class="btn sec mini" data-no type="button">Cancelar</button></div>`);
        b.querySelector('[data-ok]').onclick = async () => { b.querySelectorAll('button').forEach((x) => { x.disabled = true; }); try { const o = await MB.api('assistente_confirmar', { proposta: r.proposta }); b.innerHTML = '✅ ' + esc(o.resposta); } catch { b.querySelectorAll('button').forEach((x) => { x.disabled = false; }); } };
        b.querySelector('[data-no]').onclick = () => { b.innerHTML = '<span class="fraco">Cancelado. Nada foi gravado.</span>'; };
      } else balao(`<div>${esc(r.resposta)}</div>${r.fonte ? `<div class="fraco" style="margin-top:4px">Fonte: ${esc(r.fonte)}${r.falta && r.falta.length ? ' · falta: ' + esc(r.falta.join(', ')) : ''}</div>` : ''}`);
    };
    el.querySelector('#enviar').onclick = () => perguntar(el.querySelector('#pergunta').value);
    el.querySelector('#pergunta').onkeydown = (e) => { if (e.key === 'Enter') perguntar(e.target.value); };
    el.querySelectorAll('#sug button').forEach((b) => { b.onclick = () => perguntar(b.textContent); });

    el.querySelector('#pc-ir').onclick = async () => {
      const res = el.querySelector('#pc-res'); const valor = Number(el.querySelector('#pc-valor').value);
      if (!(valor > 0)) { res.innerHTML = '<div class="aviso-c" style="margin-top:10px">Digite o valor da compra.</div>'; return; }
      try {
        const r = await MB.api('posso_comprar', { valor, parcelas: Number(el.querySelector('#pc-parc').value) || 1, cartao_id: el.querySelector('#pc-cartao').value || undefined });
        res.innerHTML = `<div class="card" style="margin-top:10px;border-color:${COR[r.veredito]}"><div class="n" style="font-size:20px">${ICONE[r.veredito]} ${esc(r.veredito[0].toUpperCase() + r.veredito.slice(1))}</div>
          ${r.razoes.map((x) => `<div style="margin:6px 0">• ${esc(x)}</div>`).join('')}<div class="fraco">${esc(r.aviso)}</div></div>`;
      } catch { /* erro já mostrado */ }
    };
    el.querySelector('#rel-ir').onclick = async () => {
      const res = el.querySelector('#rel-res');
      try {
        const r = await MB.api('relatorio_mensal');
        const linha = (rot, v) => `<div class="item"><span>${rot}</span><span class="n">${v === null ? '<span class="fraco">sem dados</span>' : brl(v)}</span></div>`;
        res.innerHTML = `<div style="margin-top:10px">${linha('Recebeu', r.recebeu)}${linha('Gastou', r.gastou)}${linha('Economizou', r.economizou)}${linha('Gasto no mês anterior', r.gasto_mes_anterior)}
          <div class="item"><span>Investiu / juros / pontos / rendimentos</span><span class="fraco">sem dados ainda</span></div>
          ${r.onde_gastou_mais.length ? `<div class="fraco" style="margin-top:8px">Onde mais gastou</div>${r.onde_gastou_mais.map((x) => `<div class="item"><span>${esc(x.categoria)}</span><span>${brl(x.valor)}</span></div>`).join('')}` : ''}
          ${r.saude.nota !== null ? `<div class="item"><span>Saúde financeira</span><span class="n">${r.saude.nota}/100</span></div>` : ''}
          ${r.prioridades.length ? `<div class="fraco" style="margin-top:8px">Prioridades para o próximo mês</div>${r.prioridades.map((x, n) => `<div style="margin:4px 0">${n + 1}. ${esc(x)}</div>`).join('')}` : ''}</div>`;
      } catch { /* erro já mostrado */ }
    };
  };
})();
