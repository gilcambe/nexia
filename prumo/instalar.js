// Botão "Instalar app": usa o pedido de instalação do navegador (Android/PC);
// no iPhone ou quando o navegador não oferece, mostra os passos.
(function () {
  const botoes = ['instalar', 'instalar2'].map((id) => document.getElementById(id)).filter(Boolean);
  const instalado = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (instalado) return;
  let pedido = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pedido = e; });
  window.addEventListener('appinstalled', () => botoes.forEach((b) => { b.hidden = true; }));

  const ua = navigator.userAgent || '';
  const ios = /iPhone|iPad|iPod/i.test(ua);
  const dentroDeApp = /FBAN|FBAV|Instagram|Line\/|wv\)|; wv/i.test(ua);
  function passos() {
    if (ios) return ['Abra este link no <b>Safari</b>.', 'Toque no botão <b>Compartilhar</b> (quadrado com seta para cima).', 'Escolha <b>"Adicionar à Tela de Início"</b> e toque em <b>Adicionar</b>.'];
    if (dentroDeApp) return ['Toque nos <b>3 pontinhos</b> e escolha <b>"Abrir no Chrome"</b>.', 'No Chrome, toque de novo em <b>📲 Instalar app</b>.'];
    return ['Toque nos <b>3 pontinhos</b> (⋮) do Chrome, no canto de cima.', 'Escolha <b>"Instalar app"</b> ou <b>"Adicionar à tela inicial"</b>.', 'O ícone azul <b>K</b> do Kernex Finance aparece na tela do celular.'];
  }
  async function instalar() {
    if (pedido) {
      pedido.prompt();
      try { await pedido.userChoice; } catch { /* ignorado */ }
      pedido = null;
      return;
    }
    document.getElementById('dica-passos').innerHTML = passos().map((p) => `<li>${p}</li>`).join('');
    document.getElementById('dica').hidden = false;
  }
  document.getElementById('dica-ok').onclick = () => { document.getElementById('dica').hidden = true; };
  botoes.forEach((b) => { b.hidden = false; b.onclick = instalar; });
})();
