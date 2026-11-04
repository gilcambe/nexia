'use strict';
// Prumo: peças comuns das telas (estilo, dinheiro, formulário, redução de imagem). Carregado pelas abas.
(function () {
  const MB = window.MB;
  if (MB.ui) return;
  const st = document.createElement('style');
  st.textContent = `.card{background:var(--cartao);border:1px solid var(--borda);border-radius:16px;padding:14px;margin:0 0 12px}
.grande{font-size:30px;font-weight:700}.fraco{color:var(--fraco);font-size:14px}.verm{color:var(--perigo)}.verde{color:var(--verde2)}
.btn.sec{background:#1d3127;color:var(--texto)}.btn.perigo{background:#3a1717;color:#fecaca}.btn.mini{min-height:36px;padding:0 10px;font-size:14px;width:auto}
.linha{display:flex;gap:8px;flex-wrap:wrap}.linha>.btn{flex:1;width:auto;font-size:16px;min-height:46px}
.item{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--borda)}.item:last-child{border:0}
.item .n{font-weight:600}.item .v{font-weight:700;white-space:nowrap}
.barra{height:8px;background:#0e1a14;border-radius:8px;overflow:hidden;margin-top:4px}.barra i{display:block;height:100%;background:var(--verde2)}
#conteudo label{display:block;font-size:14px;color:var(--fraco);margin:10px 0 4px}dialog label{display:block;font-size:14px;color:var(--fraco);margin:10px 0 4px}
#conteudo input,#conteudo select,dialog input,dialog select{width:100%;min-height:44px;padding:8px 12px;border-radius:10px;border:1px solid var(--borda);background:#0e1a14;color:var(--texto);font-size:16px}
.aviso-c{background:#33260c;border:1px solid var(--aviso);color:#fde68a;border-radius:12px;padding:10px 12px;margin:0 0 12px}
.toast{position:fixed;left:16px;right:16px;bottom:110px;background:#0f3a20;color:#bbf7d0;padding:12px;border-radius:12px;z-index:9}
dialog{border:0;border-radius:16px;background:var(--cartao);color:var(--texto);width:min(560px,94vw);max-height:90vh;padding:16px}dialog::backdrop{background:#000a}
.chip{display:inline-block;padding:6px 10px;border-radius:20px;background:#1d3127;margin:3px;font-size:14px;cursor:pointer}`;
  document.head.appendChild(st);
  const brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let abaAtual = 'carteira';
  const recarregar = () => MB.abrirAba(abaAtual);
  const aba = (nome) => { abaAtual = nome; };
  const ok = (msg) => { const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; document.body.appendChild(d); setTimeout(() => d.remove(), 2500); };
  const TIPOS = { renda_fixa: 'Renda fixa', acoes: 'Ações', fiis: 'FIIs', fundos: 'Fundos', tesouro: 'Tesouro', cripto: 'Cripto', previdencia: 'Previdência', fgts: 'FGTS', poupanca: 'Poupança', outro: 'Outro' };
  const CATS = { mercado: 'Mercado', casa: 'Casa', transporte: 'Transporte', saude: 'Saúde', lazer: 'Lazer', educacao: 'Educação', restaurante: 'Restaurante', assinaturas: 'Assinaturas', outros: 'Outros' };
  const hoje = () => new Date().toISOString().slice(0, 10);
  const opcoes = (mapa, sel) => Object.entries(mapa).map(([k, v]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(v)}</option>`).join('');
  const barra = (pct, cor) => `<div class="barra"><i style="width:${Math.max(0, Math.min(100, pct))}%;${cor ? 'background:' + cor : ''}"></i></div>`;

  // Janela simples com formulário. campos: [{ nome, rotulo, tipo, valor, opcoes }]
  function formulario(titulo, campos, aoSalvar, aoApagar) {
    const d = document.createElement('dialog');
    d.innerHTML = `<h3 style="margin-top:0">${esc(titulo)}</h3><form method="dialog">${campos.map((c) => `<label>${esc(c.rotulo)}</label>${
      c.opcoes ? `<select name="${c.nome}">${c.opcoes}</select>` : `<input name="${c.nome}" type="${c.tipo || 'text'}" ${c.tipo === 'number' ? 'step="0.01" inputmode="decimal"' : ''} value="${esc(c.valor == null ? '' : c.valor)}">`
    }`).join('')}<div class="linha" style="margin-top:16px">${aoApagar ? '<button type="button" class="btn perigo" data-x="apagar">Apagar</button>' : ''}<button type="button" class="btn sec" data-x="fechar">Cancelar</button><button class="btn" data-x="salvar">Salvar</button></div></form>`;
    document.body.appendChild(d);
    d.showModal();
    d.addEventListener('close', () => d.remove());
    d.querySelector('[data-x=fechar]').onclick = () => d.close();
    if (aoApagar) d.querySelector('[data-x=apagar]').onclick = async () => { if (confirm('Apagar mesmo?')) { await aoApagar(); d.close(); recarregar(); } };
    d.querySelector('form').onsubmit = async (e) => {
      e.preventDefault();
      const dados = Object.fromEntries(new FormData(e.target).entries());
      try { await aoSalvar(dados); d.close(); recarregar(); } catch { /* erro já mostrado */ }
    };
  }

  // Reduz o print para no máximo 1600 px de largura (JPEG 0.8) antes de mandar.
  function reduzir(arquivo) {
    return new Promise((ok, falha) => {
      const img = new Image();
      img.onload = () => {
        const esc2 = Math.min(1, 1600 / img.width);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * esc2);
        c.height = Math.round(img.height * esc2);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        ok(c.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = falha;
      img.src = URL.createObjectURL(arquivo);
    });
  }


  MB.ui = { brl, esc, TIPOS, CATS, hoje, opcoes, barra, formulario, reduzir, recarregar, aba, ok };
})();
