'use strict';
// Kernex Finance, fase 6: aba Bancos (Open Finance). Só mostra o estado: nenhum provedor pago foi contratado.
// Nunca pede senha do banco. Enquanto não houver provedor, os documentos (foto, print ou PDF) cobrem.
(function () {
  const MB = window.MB;
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });

  MB.telas.conexoes = async (el) => {
    const { esc, aba } = await carregarUi();
    aba('conexoes');
    const st = await MB.api('openfinance_status');
    const data = (d) => (d ? new Date(d).toLocaleString('pt-BR') : 'nunca');
    el.innerHTML = `
      <div class="card"><h3 style="margin:0 0 6px">🔗 Conectar bancos (Open Finance)</h3>
        <p class="fraco">${st.ativo ? `Conexão feita por ${esc(st.provedor)}.` : esc(st.aviso)}</p>
        <p class="fraco">O Kernex Finance nunca pede a senha do seu banco. A autorização é feita no app do próprio banco, e você pode cancelar quando quiser.</p>
        <button class="btn" id="of-conectar" type="button" ${st.ativo ? '' : 'disabled'}>Conectar um banco</button>
        ${st.ativo ? '' : '<button class="btn sec" id="of-docs" type="button" style="margin-top:8px">Mandar foto, print ou PDF agora</button>'}
        <div id="of-msg" class="fraco" style="margin-top:6px"></div></div>
      <div class="card"><h3 style="margin:0 0 6px">Suas conexões</h3>${st.conexoes.map((c) => `<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin:6px 0">
          <div><b>${esc(c.banco)}</b><div class="fraco">Última atualização: ${esc(data(c.ultima_sync))} · Autorização até: ${esc(c.consentimento_ate || '—')}</div></div>
          <button class="btn sec" type="button" data-desc="${esc(c.id)}">Desconectar</button></div>`).join('') || '<div class="fraco">Nenhuma conexão.</div>'}</div>`;
    const docs = el.querySelector('#of-docs'); if (docs) docs.onclick = () => { const b = document.querySelector('[data-aba="documentos"]'); if (b) b.click(); };
    el.querySelector('#of-conectar').onclick = async () => { try { await MB.api('openfinance_conectar', {}); MB.telas.conexoes(el); } catch (e) { el.querySelector('#of-msg').textContent = (e && e.message) || 'Não deu certo.'; } };
    el.querySelectorAll('[data-desc]').forEach((b) => { b.onclick = async () => { if (!confirm('Desconectar este banco?')) return; await MB.api('openfinance_desconectar', { id: b.dataset.desc }); MB.telas.conexoes(el); }; });
  };
})();
