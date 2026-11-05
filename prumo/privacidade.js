// Modo privacidade: esconde todos os valores em R$ da tela. A escolha fica só neste aparelho.
(function () {
  'use strict';
  const RS = /R\$\s?-?[\d.]+(?:,\d{1,2})?/g;
  let ligado = false;
  try { ligado = localStorage.getItem('kf-privado') === '1'; } catch { /* sem armazenamento */ }

  function envolver(no) {
    const t = no.nodeValue;
    RS.lastIndex = 0;
    if (!RS.test(t)) return;
    const pai = no.parentNode;
    if (!pai || (pai.classList && pai.classList.contains('valor')) || /^(SCRIPT|STYLE|TEXTAREA|INPUT)$/.test(pai.nodeName)) return;
    const frag = document.createDocumentFragment();
    let ultimo = 0; RS.lastIndex = 0; let m;
    while ((m = RS.exec(t))) {
      if (m.index > ultimo) frag.appendChild(document.createTextNode(t.slice(ultimo, m.index)));
      const s = document.createElement('span'); s.className = 'valor'; s.textContent = m[0]; frag.appendChild(s);
      ultimo = m.index + m[0].length;
    }
    if (ultimo < t.length) frag.appendChild(document.createTextNode(t.slice(ultimo)));
    pai.replaceChild(frag, no);
  }
  function varrer(raiz) {
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    const nos = []; while (w.nextNode()) nos.push(w.currentNode);
    nos.forEach(envolver);
  }
  function aplicar() {
    document.body.classList.toggle('privado', ligado);
    const b = document.getElementById('olho');
    if (b) { b.setAttribute('aria-pressed', String(ligado)); b.textContent = ligado ? '🙈' : '👁'; }
  }
  const alvo = document.getElementById('conteudo');
  if (alvo) {
    let esperando = false;
    new MutationObserver(() => { if (esperando) return; esperando = true; setTimeout(() => { esperando = false; varrer(alvo); }, 50); }).observe(alvo, { childList: true, subtree: true, characterData: false });
    varrer(alvo);
  }
  const olho = document.getElementById('olho');
  if (olho) olho.onclick = () => { ligado = !ligado; try { localStorage.setItem('kf-privado', ligado ? '1' : '0'); } catch { /* ok */ } aplicar(); };
  aplicar();
  window.KF_privacidade = { varrer };
})();
