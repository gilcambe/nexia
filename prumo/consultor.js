'use strict';
// Prumo: aba Consultor (avaliação da carteira + chat com IA grátis). Usa window.MB e /prumo/ui.js.
(function () {
  const MB = window.MB;
  let brl, esc, TIPOS, CATS, hoje, opcoes, barra, formulario, reduzir, recarregar, ok;
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });
  const iniciar = async (aba) => { ({ brl, esc, TIPOS, CATS, hoje, opcoes, barra, formulario, reduzir, recarregar, ok } = await carregarUi()); MB.ui.aba(aba); };

  const conversa = []; // fica só na memória da página
  MB.telas.consultor = async (el) => {
    await iniciar('consultor');
    const av = await MB.api('avaliar_carteira');
    el.innerHTML = `
      <div class="card"><div class="item" style="padding-top:0"><b>Avaliação da carteira</b><span class="grande" style="font-size:24px">${av.nota}/10</span></div>
        ${av.pontos.map((p) => `<p style="margin:8px 0">${p.tipo === 'ok' ? '✅' : '⚠️'} ${esc(p.texto)}</p>`).join('')}
        <p class="fraco">${esc(av.aviso)}</p></div>
      <div class="card" id="chat" style="display:flex;flex-direction:column;gap:8px"></div>
      <div id="sug" style="margin-bottom:8px">${['Meu patrimônio aumentou?', 'Estou no caminho dos meus objetivos?', 'Onde posso cortar gastos?', 'Como está meu salário x gastos?'].map((s) => `<span class="chip">${s}</span>`).join('')}</div>
      <form id="f" class="linha"><input name="m" placeholder="Pergunte ao consultor…" style="flex:4" autocomplete="off"><button class="btn mini">Enviar</button></form>`;
    const chat = el.querySelector('#chat');
    const desenhar = () => {
      chat.innerHTML = conversa.map((m) => `<div style="align-self:${m.role === 'user' ? 'flex-end' : 'flex-start'};max-width:88%;background:${m.role === 'user' ? '#1d3127' : '#0e1a14'};padding:10px 12px;border-radius:14px;white-space:pre-wrap">${esc(m.content)}</div>`).join('') || '<p class="fraco">Pergunte qualquer coisa sobre seu dinheiro. Eu uso os dados que você salvou no app.</p>';
      chat.lastElementChild && chat.lastElementChild.scrollIntoView({ block: 'end' });
    };
    const enviar = async (msg) => {
      if (!msg.trim()) return;
      const historico = conversa.slice(-10);
      conversa.push({ role: 'user', content: msg });
      conversa.push({ role: 'assistant', content: 'Pensando…' });
      desenhar();
      try { const r = await MB.api('consultor', { mensagem: msg, historico }); conversa[conversa.length - 1].content = r.resposta; }
      catch { conversa[conversa.length - 1].content = 'Não consegui responder agora. Tente de novo.'; }
      desenhar();
    };
    desenhar();
    el.querySelectorAll('#sug .chip').forEach((c) => { c.onclick = () => enviar(c.textContent); });
    el.querySelector('#f').onsubmit = (e) => { e.preventDefault(); const i = e.target.m; const v = i.value; i.value = ''; enviar(v); };
  };
})();
