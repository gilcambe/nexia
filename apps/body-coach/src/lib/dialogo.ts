// Janela de confirmação e aviso no visual do app (no lugar de window.confirm / window.alert).
function abrir(texto: string, botoes: { rotulo: string; valor: boolean; forte?: boolean }[]): Promise<boolean> {
  return new Promise((resolve) => {
    const fundo = document.createElement('div');
    fundo.setAttribute('role', 'dialog');
    fundo.setAttribute('aria-modal', 'true');
    fundo.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.45)';
    const caixa = document.createElement('div');
    caixa.style.cssText = 'width:100%;max-width:360px;border-radius:20px;background:#fff;color:#1c1917;padding:20px;box-shadow:0 10px 40px rgba(0,0,0,.25);font:500 16px/1.45 Inter,system-ui,sans-serif';
    const p = document.createElement('p');
    p.textContent = texto;
    p.style.cssText = 'margin:0 0 18px;white-space:pre-line';
    const linha = document.createElement('div');
    linha.style.cssText = 'display:flex;gap:10px;justify-content:flex-end';
    const fechar = (v: boolean) => { fundo.remove(); document.removeEventListener('keydown', tecla); resolve(v); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(false); };
    for (const b of botoes) {
      const el = document.createElement('button');
      el.type = 'button';
      el.textContent = b.rotulo;
      el.style.cssText = `min-height:44px;padding:0 18px;border-radius:12px;font:600 15px Inter,system-ui,sans-serif;border:${b.forte ? '0' : '1px solid #e7e5e4'};background:${b.forte ? '#ea580c' : '#fff'};color:${b.forte ? '#fff' : '#1c1917'}`;
      el.onclick = () => fechar(b.valor);
      linha.appendChild(el);
    }
    fundo.onclick = (e) => { if (e.target === fundo) fechar(false); };
    document.addEventListener('keydown', tecla);
    caixa.append(p, linha);
    fundo.appendChild(caixa);
    document.body.appendChild(fundo);
    (linha.lastElementChild as HTMLButtonElement | null)?.focus();
  });
}

export function confirmar(texto: string, sim = 'Sim', nao = 'Cancelar'): Promise<boolean> {
  return abrir(texto, [{ rotulo: nao, valor: false }, { rotulo: sim, valor: true, forte: true }]);
}

export async function avisar(texto: string): Promise<void> {
  await abrir(texto, [{ rotulo: 'Entendi', valor: true, forte: true }]);
}
