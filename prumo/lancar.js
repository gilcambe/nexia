'use strict';
// Redesign (fases 2 e 3): "+ Lançar" é uma folha que sobe de baixo, com tudo que entra no app num lugar só:
// foto/print, PDF, extrato do banco (.ofx/.csv) e digitar rápido. Documento: a IA diz o que é e a tela certa abre
// já lendo, para a pessoa conferir. Depois de gravar, um aviso mostra o que mudou no "Pode gastar hoje".
(function () {
  const MB = window.MB;
  const CATS = { alimentacao: 'Mercado e comida', moradia: 'Casa e contas', transporte: 'Transporte', saude: 'Saúde', educacao: 'Educação', lazer: 'Lazer', compras: 'Compras', assinaturas: 'Assinaturas', familia: 'Família', impostos: 'Impostos', investimentos: 'Investimentos', renda: 'Salário e renda', outros: 'Outros' };
  const st = document.createElement('style');
  st.textContent = `.kl-fundo{position:fixed;inset:0;background:#000a;z-index:30;display:flex;align-items:flex-end;justify-content:center}
.kl-folha{background:var(--cartao);width:100%;max-width:560px;border-radius:20px 20px 0 0;padding:10px 16px calc(16px + env(safe-area-inset-bottom));border:1px solid var(--borda);animation:kl-sobe .18s ease-out}
@keyframes kl-sobe{from{transform:translateY(40px);opacity:.4}to{transform:none;opacity:1}}
.kl-pega{width:40px;height:4px;border-radius:4px;background:var(--borda);margin:0 auto 10px}
.kl-folha h3{margin:0 0 4px;font-size:18px}.kl-folha p{margin:0 0 12px;color:var(--fraco);font-size:13px}
.kl-grade{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.kl-op{background:#16214080;border:1px solid var(--borda);border-radius:16px;color:var(--texto);min-height:84px;padding:12px;text-align:left;font:inherit;cursor:pointer;display:flex;flex-direction:column;gap:4px}
.kl-op b{font-size:15px}.kl-op span{color:var(--fraco);font-size:12px}.kl-op i{font-style:normal;font-size:22px}
.kl-op:active{border-color:var(--verde)}.kl-msg{margin-top:12px}
.kl-folha label{display:block;font-size:13px;color:var(--fraco);margin:10px 0 4px}
.kl-folha input,.kl-folha select{width:100%;min-height:44px;padding:8px 12px;border-radius:12px;border:1px solid var(--borda);background:#0B1530;color:var(--texto);font-size:16px}
.kl-dois{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.kl-tipo{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px}.kl-tipo button{min-height:44px;border-radius:12px;border:1px solid var(--borda);background:none;color:var(--fraco);font:inherit;font-weight:600}
.kl-tipo button[aria-pressed=true][data-t=despesa]{border-color:var(--perda);color:var(--perda)}.kl-tipo button[aria-pressed=true][data-t=receita]{border-color:var(--ganho);color:var(--ganho)}
.kl-mudou{position:fixed;left:16px;right:16px;bottom:96px;max-width:520px;margin:0 auto;background:#14203F;border:1px solid var(--verde);color:var(--texto);padding:12px 14px;border-radius:14px;z-index:31;font-size:14px;box-shadow:0 8px 24px #0008}`;
  if (document.head) document.head.appendChild(st);
  const brl = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hojeLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const carregar = (chave, src) => MB[chave] ? Promise.resolve(MB[chave]) : new Promise((ok) => { const s = document.createElement('script'); s.src = src; s.onload = () => ok(MB[chave]); s.onerror = () => ok(null); document.body.appendChild(s); });

  /** "O que mudou": compara o painel antes e depois de gravar e mostra num aviso que some sozinho. */
  async function oQueMudou(antes, extra) {
    let depois = null;
    try { if (MB.api.limpar) MB.api.limpar(); depois = await MB.api('painel_resumo', {}, { silencioso: true }); } catch { depois = null; }
    const linhas = [];
    if (extra) linhas.push(extra);
    if (antes && depois) {
      const a = antes.kpis || {}; const d = depois.kpis || {};
      if (a.posso_hoje !== d.posso_hoje && d.posso_hoje != null) linhas.push(`Pode gastar hoje: ${brl(a.posso_hoje)} → <b>${brl(d.posso_hoje)}</b>`);
      if (a.a_pagar !== d.a_pagar) linhas.push(`A pagar: ${brl(a.a_pagar)} → ${brl(d.a_pagar)}`);
      if (a.recebi !== d.recebi) linhas.push(`Recebi no mês: ${brl(a.recebi)} → ${brl(d.recebi)}`);
      const sa = antes.score && antes.score.total; const sd = depois.score && depois.score.total;
      if (sa !== sd && sd != null) linhas.push(`Score: ${sa == null ? '–' : sa} → <b>${sd}</b>`);
    }
    if (!linhas.length) return;
    const t = document.createElement('div'); t.className = 'kl-mudou'; t.setAttribute('role', 'status');
    t.innerHTML = '✅ ' + linhas.join('<br>');
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 6000);
    t.onclick = () => t.remove();
  }

  function fechar(f) { if (f && f.parentNode) f.remove(); }

  function abrir() {
    const antesP = MB.api('painel_resumo', {}, { silencioso: true }).catch(() => null);
    MB.painelAntes = antesP; // as telas que gravam um documento usam para o "o que mudou"
    const f = document.createElement('div'); f.className = 'kl-fundo';
    f.innerHTML = `<div class="kl-folha" role="dialog" aria-modal="true" aria-label="Lançar"><div class="kl-pega"></div>
      <h3>O que você quer lançar?</h3><p>Mande o documento que eu leio e você confere antes de gravar. Nunca peço senha de banco.</p>
      <div class="kl-grade">
        <button type="button" class="kl-op" data-o="foto"><i>📷</i><b>Foto ou print</b><span>Fatura, holerite, extrato, comprovante</span></button>
        <button type="button" class="kl-op" data-o="pdf"><i>📄</i><b>PDF</b><span>Fatura, holerite, INSS, FGTS</span></button>
        <button type="button" class="kl-op" data-o="extrato"><i>🏦</i><b>Extrato do banco</b><span>Arquivo .ofx ou .csv</span></button>
        <button type="button" class="kl-op" data-o="digitar"><i>✍️</i><b>Digitar rápido</b><span>Um gasto ou uma entrada</span></button>
      </div>
      <input type="file" id="kl-arq" multiple hidden><div class="kl-msg" id="kl-msg"></div></div>`;
    document.body.appendChild(f);
    f.onclick = (e) => { if (e.target === f) fechar(f); };
    const esc2 = (e) => { if (e.key === 'Escape') { fechar(f); document.removeEventListener('keydown', esc2); } };
    document.addEventListener('keydown', esc2);
    const arq = f.querySelector('#kl-arq'); const msg = f.querySelector('#kl-msg');
    let modo = 'foto';
    const escolher = (aceita) => { arq.accept = aceita; arq.value = ''; arq.click(); };
    f.querySelector('[data-o=foto]').onclick = () => { modo = 'foto'; escolher('image/*'); };
    f.querySelector('[data-o=pdf]').onclick = () => { modo = 'pdf'; escolher('application/pdf,.pdf'); };
    f.querySelector('[data-o=extrato]').onclick = () => { modo = 'extrato'; escolher('.ofx,.csv'); };
    f.querySelector('[data-o=digitar]').onclick = () => digitar(f, antesP);
    arq.onchange = async (ev) => {
      const arqs = [...((ev && ev.target && ev.target.files) || arq.files || [])].slice(0, 5);
      if (!arqs.length) return;
      if (modo === 'extrato' || arqs.every((a) => /\.(ofx|csv)$/i.test(a.name || ''))) { // extrato vai direto para Documentos
        MB.deixarPendente('documentos', 'doc', arqs); fechar(f); MB.abrirAba('documentos'); return;
      }
      msg.innerHTML = '<div class="aviso-c">⏳ Vendo que documento é…</div>';
      try {
        if (!MB.ui) await carregar('ui', '/prumo/ui.js');
        const pdf = await carregar('pdf', '/prumo/pdf.js');
        const { imagens } = await pdf.paraImagens(arqs.slice(0, 1), MB.ui.reduzir);
        const r = await MB.api('doc_tipo', { imagens });
        msg.innerHTML = `<div class="aviso-c">✅ Entendi: ${esc(r.nome)}. Abrindo para você conferir…</div>`;
        MB.deixarPendente(r.aba, r.modo, arqs);
        setTimeout(() => { fechar(f); MB.abrirAba(r.aba); }, 400);
      } catch (e) { msg.innerHTML = `<div class="aviso-c">${esc((e && e.message) || 'Não consegui ler agora.')} Tente de novo.</div>`; }
    };
  }

  function digitar(f, antesP) {
    const folha = f.querySelector('.kl-folha');
    let tipo = 'despesa';
    folha.innerHTML = `<div class="kl-pega"></div><h3>Digitar rápido</h3>
      <div class="kl-tipo"><button type="button" data-t="despesa" aria-pressed="true">− Saiu (gasto)</button><button type="button" data-t="receita" aria-pressed="false">+ Entrou</button></div>
      <form id="kl-form"><label for="kl-v">Valor (R$)</label><input id="kl-v" name="valor" inputmode="decimal" placeholder="0,00" required autocomplete="off">
      <label for="kl-d">O que foi?</label><input id="kl-d" name="descricao" placeholder="Ex.: mercado, gasolina, Pix do João" required maxlength="80">
      <div class="kl-dois"><div><label for="kl-dt">Data</label><input id="kl-dt" name="data" type="date" value="${hojeLocal()}"></div>
      <div><label for="kl-c">Categoria</label><select id="kl-c" name="categoria">${Object.entries(CATS).map(([k, v]) => `<option value="${k}"${k === 'outros' ? ' selected' : ''}>${v}</option>`).join('')}</select></div></div>
      <div class="linha" style="margin-top:16px"><button type="button" class="btn sec" id="kl-voltar" style="margin-top:0">Cancelar</button><button class="btn" id="kl-ok">Gravar</button></div>
      <div class="kl-msg" id="kl-msg"></div></form>`;
    folha.querySelectorAll('.kl-tipo button').forEach((b) => { b.onclick = () => { tipo = b.dataset.t; folha.querySelectorAll('.kl-tipo button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); if (tipo === 'receita') folha.querySelector('#kl-c').value = 'renda'; }; });
    folha.querySelector('#kl-voltar').onclick = () => fechar(f);
    setTimeout(() => folha.querySelector('#kl-v').focus(), 50);
    folha.querySelector('#kl-form').onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target).entries());
      const valor = Number(String(d.valor).replace(/\./g, '').replace(',', '.'));
      const m = folha.querySelector('#kl-msg');
      if (!(valor > 0)) { m.innerHTML = '<div class="aviso-c">Digite um valor maior que zero.</div>'; return; }
      const ok = folha.querySelector('#kl-ok'); ok.disabled = true; ok.textContent = 'Gravando…';
      try {
        const antes = await antesP;
        await MB.api('doc_confirmar', { lancamentos: [{ data: d.data || hojeLocal(), descricao: d.descricao, valor, tipo, categoria: d.categoria, documento: 'manual' }] });
        fechar(f);
        await oQueMudou(antes, `${tipo === 'despesa' ? 'Gasto' : 'Entrada'} gravado: ${esc(d.descricao)} ${brl(valor)}`);
        const atual = (() => { try { return localStorage.getItem('prumo-aba') || 'inicio'; } catch { return 'inicio'; } })();
        MB.abrirAba(atual);
      } catch { ok.disabled = false; ok.textContent = 'Gravar'; }
    };
  }

  MB.lancar = { abrir, oQueMudou, CATS };
})();
