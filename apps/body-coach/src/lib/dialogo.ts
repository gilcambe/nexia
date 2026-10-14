// Janela de confirmação e aviso no visual do app (no lugar de window.confirm / window.alert).
function abrir(texto: string, botoes: { rotulo: string; valor: boolean; forte?: boolean }[]): Promise<boolean> {
  return new Promise((resolve) => {
    const fundo = document.createElement('div');
    fundo.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 16px;
      font-family: inherit;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      background: var(--bg-card, #fff);
      color: var(--text-primary, #000);
      border-radius: 12px;
      padding: 24px;
      max-width: 90vw;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      text-align: center;
    `;

    const mensagem = document.createElement('p');
    mensagem.textContent = texto;
    mensagem.style.cssText = `margin: 0 0 20px; line-height: 1.5;`;

    const containerBotoes = document.createElement('div');
    containerBotoes.style.cssText = `display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;`;

    botoes.forEach(({ rotulo, valor, forte }) => {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.textContent = rotulo;
      botao.style.cssText = `
        padding: 12px 24px;
        border-radius: 8px;
        border: none;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.15s, transform 0.1s;
        ${forte
          ? 'background: var(--accent, #0066cc); color: #fff;'
          : 'background: var(--bg-secondary, #f0f0f0); color: var(--text-primary, #000);'}
      `;
      botao.addEventListener('mouseenter', () => (botao.style.opacity = '0.85'));
      botao.addEventListener('mouseleave', () => (botao.style.opacity = '1'));
      botao.addEventListener('mousedown', () => (botao.style.transform = 'scale(0.98)'));
      botao.addEventListener('mouseup', () => (botao.style.transform = 'scale(1)'));
      botao.addEventListener('click', () => {
        limpar();
        resolve(valor);
      });
      containerBotoes.appendChild(botao);
    });

    const limpar = () => {
      if (fundo.parentNode) {
        fundo.parentNode.removeChild(fundo);
      }
      document.removeEventListener('keydown', onKeyDown);
    };

    // Fechar com ESC
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        limpar();
        resolve(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);

    modal.appendChild(mensagem);
    modal.appendChild(containerBotoes);
    fundo.appendChild(modal);
    document.body.appendChild(fundo);

    // Foco no primeiro botão para acessibilidade
    const primeiroBotao = containerBotoes.querySelector('button') as HTMLElement;
    primeiroBotao?.focus();
  });
}
