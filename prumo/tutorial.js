'use strict';
// Melhoria 20 (dono 19/11): "como usar" em 1 minuto, com números de EXEMPLO (nada é gravado na sua conta).
(function () {
  const MB = window.MB = window.MB || {};
  const PASSOS = [
    { t: '1. Mande um documento', h: '<div class="card"><button class="btn" type="button" disabled>📷 Mandar print ou foto</button></div><p>Tire um print do holerite, da fatura ou do extrato e mande aqui. Eu descubro o que é e leio sozinho.</p>' },
    { t: '2. Confira e salve', h: '<div class="card"><b>Confira o recebimento</b><div class="item"><span>Adiantamento 13/11</span><span class="v">R$ 4.000,00</span></div><button class="btn" type="button" disabled>Salvar</button></div><p>Eu mostro o que li. Se estiver certo, toque em Salvar. Se não, corrija antes.</p>' },
    { t: '3. Veja os 3 números', h: '<div class="card"><div class="linha kf-tres"><div><div class="fraco">Quanto tenho</div><b>R$ 3.000</b></div><div><div class="fraco">Comprometido</div><b class="verm">R$ 1.200</b></div><div><div class="fraco">Posso gastar</div><b class="verde">R$ 1.800</b></div></div></div><p>Na tela de início: o que tem, o que já tem dono (contas a pagar) e o que sobra para gastar até o fim do mês.</p>' },
    { t: '4. Errou? Arrume', h: '<div class="card"><div class="item"><span>Mercado 10/11</span><span class="v">R$ 450,00 ✏️ 🗑️</span></div><button class="btn sec mini" type="button" disabled>↩️ Desfazer o último apagado</button></div><p>Em "📋 Meus cadastros" você vê tudo, edita, apaga e desfaz.</p>' },
  ];
  function abrir() {
    let i = 0;
    const d = document.createElement('dialog');
    const desenhar = () => {
      const p = PASSOS[i];
      d.innerHTML = `<h3 style="margin-top:0">${p.t}</h3><div class="fraco" style="margin-bottom:6px">Exemplo (números de mentira)</div>${p.h}`
        + `<div class="linha" style="margin-top:12px"><button type="button" class="btn sec" data-t="sair">Pular</button><button type="button" class="btn" data-t="ir">${i < PASSOS.length - 1 ? 'Próximo' : 'Começar'}</button></div>`;
      d.querySelector('[data-t=sair]').onclick = () => d.close();
      d.querySelector('[data-t=ir]').onclick = () => { if (i < PASSOS.length - 1) { i++; desenhar(); } else d.close(); };
    };
    document.body.appendChild(d); desenhar(); d.addEventListener('close', () => d.remove());
    if (d.showModal) d.showModal();
    try { localStorage.setItem('kf-tutorial-visto', '1'); } catch { /* sem guardar */ }
  }
  function primeiraVez() { try { return localStorage.getItem('kf-tutorial-visto') !== '1'; } catch { return false; } }
  MB.tutorial = { abrir, primeiraVez, PASSOS };
})();
