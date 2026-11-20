'use strict';
// Redesign: Perfil (no avatar). Meus cadastros (ver, editar, apagar, desfazer), documentos, ajuda, preferências e Sair.
// Ações que apagam ficam só aqui.
(function () {
  const MB = window.MB;
  const carregar = () => MB.hub ? Promise.resolve(MB.hub) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/hubs.js'; s.onload = () => ok(MB.hub); s.onerror = falha; document.body.appendChild(s); });
  const dmy = (d) => (d && /^\d{4}-\d{2}/.test(d) ? (d.length >= 10 ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : `${d.slice(5, 7)}/${d.slice(0, 4)}`) : '');
  MB.telas.perfil = async (el) => {
    const H = await carregar(); const U = await H.ui(); U.aba('perfil');
    const u = (MB.usuario && MB.usuario()) || {};
    el.innerHTML = `<div class="kh">
      <section class="card kh-larga" style="display:flex;gap:12px;align-items:center"><div style="width:48px;height:48px;border-radius:50%;background:#1A2547;display:grid;place-items:center;font-weight:700;font-size:20px">${H.esc(String(u.displayName || u.email || '?').charAt(0).toUpperCase())}</div>
        <div><b>${H.esc(u.displayName || 'Você')}</b><div class="sub">${H.esc(u.email || '')}</div></div></section>
      <section class="card"><b>📋 Meus cadastros</b><div class="sub" style="margin-top:4px">Tudo que você cadastrou, de todas as telas. Dá para editar, apagar e desfazer.</div><button class="btn sec" id="kp-cad-btn" type="button">Ver meus cadastros</button><div id="kp-cad"></div></section>
      <section class="card kh-larga" id="kp-of"><b>🔗 Conectar banco (Open Finance)</b><div class="sub" style="margin-top:4px">Seus gastos e saldos entram sozinhos todo dia. Você autoriza no app do seu banco; o Kernex nunca vê sua senha.</div><div id="kp-of-corpo" class="sub" style="margin-top:8px">Verificando…</div></section>
      <section class="card"><b>📎 Documentos enviados</b><div class="sub" style="margin-top:4px">Apagar um documento apaga também os lançamentos que vieram dele.</div><button class="btn sec" id="kp-lot-btn" type="button">Ver documentos</button><div id="kp-lot"></div></section>
      ${H.lista([
        ['documentos', '🧾', 'Documentos e lançamentos', 'Tudo que você mandou'],
        ['assistente', '💬', 'Assistente', 'Pergunte sobre o seu dinheiro'],
        ['consultor', '🧠', 'Consultor', 'Análise do mês'],
        ['conexoes', '🔗', 'Bancos', 'Importar extrato sem senha'],
        ['familia', '👨‍👩‍👧', 'Família', 'Dividir com quem mora com você'],
        ['alertas', '🔔', 'Alertas', 'O que avisar e quando'],
        ['ajuda', '❓', 'Ajuda', 'Perguntas comuns'],
      ])}
      <section class="card"><b>Como usar</b><div class="sub" style="margin-top:4px">Um passo a passo de 1 minuto, com exemplo.</div><button class="btn sec" id="kp-tut" type="button">Ver o passo a passo</button></section>
      <section class="card"><b>🔒 Privacidade</b><div class="sub" style="margin-top:4px">Seus dados são só seus. O app nunca pede senha de banco nem de programa de pontos. O 👁 lá em cima esconde todos os valores.</div></section>
      <button class="btn sec kh-larga" id="kp-sair" type="button" style="color:#FF5A5F;border-color:#5a2730">Sair da conta</button>
    </div>`;
    H.ligar(el);
    el.querySelector('#kp-sair').onclick = () => { if (confirm('Sair da sua conta neste aparelho?')) MB.sair(); };
    el.querySelector('#kp-tut').onclick = () => { const s = document.createElement('script'); s.src = '/prumo/tutorial.js'; s.onload = () => MB.tutorial && MB.tutorial.abrir(); if (MB.tutorial) MB.tutorial.abrir(); else document.body.appendChild(s); };
    const cad = el.querySelector('#kp-cad');
    const desenhar = async (msg) => {
      const r = await MB.api('cadastros_listar');
      cad.innerHTML = `${msg ? `<div class="aviso-c" style="margin-top:10px">${msg}</div>` : ''}${r.pode_desfazer ? '<button class="btn sec mini" id="kp-desfazer" type="button">↩️ Desfazer o último apagado</button>' : ''}`
        + (r.grupos.length ? r.grupos.map((g) => `<div style="margin-top:12px"><b>${H.esc(g.nome)}</b>${g.itens.map((x) => `<div class="item"><span>${H.esc(x.titulo)} <span class="fraco">${dmy(x.data)}</span></span><span class="v">${x.valor === null ? '' : H.brl(x.valor)} <button type="button" class="btn sec mini" data-ed="${H.esc(g.aba)}" aria-label="Editar">✏️</button> <button type="button" class="btn sec mini" data-ap="${H.esc(g.colecao)}" data-id="${H.esc(x.id)}" aria-label="Apagar">🗑️</button></span></div>`).join('')}</div>`).join('')
          : '<p class="fraco">Você ainda não cadastrou nada. Toque em "+ Lançar" lá embaixo.</p>');
      const d = cad.querySelector('#kp-desfazer');
      if (d) d.onclick = async () => { try { const o = await MB.api('desfazer'); await desenhar(`↩️ Voltou: ${H.esc(o.devolvido.titulo)}`); } catch { /* erro já mostrado */ } };
      cad.querySelectorAll('[data-ed]').forEach((b) => { b.onclick = () => MB.abrirAba(b.dataset.ed === 'inicio' ? 'patrimonio' : b.dataset.ed); });
      cad.querySelectorAll('[data-ap]').forEach((b) => { b.onclick = async () => {
        if (!confirm('Apagar este item? Os números que vêm dele também mudam. Dá para desfazer logo em seguida.')) return;
        try { const o = await MB.api('cadastro_apagar', { colecao: b.dataset.ap, id: b.dataset.id }); await desenhar(`🗑️ Apagado: ${H.esc(o.apagado.titulo)}`); } catch { /* erro já mostrado */ }
      }; });
    };
    // Dono 20/11: Open Finance pelo Meu Pluggy (grátis, uso pessoal). Sem as chaves no servidor, mostra o passo a passo.
    const of = el.querySelector('#kp-of-corpo');
    const desenharOF = async (msg) => {
      const st = await MB.api('pluggy_status', {}, { silencioso: true }).catch(() => null);
      if (!st) { of.textContent = 'Não consegui ver agora.'; return; }
      if (!st.configurado) {
        of.innerHTML = '<b style="color:var(--texto)">Ainda não ligado. Passo a passo (uma vez só):</b><ol style="margin:6px 0 0;padding-left:18px;color:var(--texto)">'
          + '<li>Crie sua conta grátis em <b>meu.pluggy.ai</b> e conecte seus bancos lá (a autorização é feita no app do banco).</li>'
          + '<li>Crie a conta de desenvolvedor em <b>dashboard.pluggy.ai</b>, crie uma aplicação, ative o conector <b>MeuPluggy</b> e crie a aplicação de desenvolvimento. Ela mostra o <b>Client ID</b> e o <b>Client Secret</b> (o secret aparece só uma vez).</li>'
          + '<li>No GitHub do projeto (Settings › Secrets › Actions), crie <b>PLUGGY_CLIENT_ID</b> e <b>PLUGGY_CLIENT_SECRET</b> com esses valores. Não mande as chaves por mensagem.</li>'
          + '<li>Me avise: eu publico de novo e o botão "Conectar banco" aparece aqui.</li></ol>';
        return;
      }
      const quando = st.ultima_sync ? new Date(st.ultima_sync).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;
      of.innerHTML = (msg ? `<div class="aviso-c">${msg}</div>` : '') + (st.conectado ? `<div style="color:var(--texto)">✅ ${st.itens} conexão(ões) ativa(s).${quando ? ' Última atualização: ' + quando + '.' : ''}</div><button class="btn" type="button" id="kp-of-sync">Atualizar agora</button>` : '')
        + `<button class="btn ${st.conectado ? 'sec' : ''}" type="button" id="kp-of-con">${st.conectado ? 'Conectar outro banco' : 'Conectar banco'}</button>`
        + (st.conectado ? '<button class="btn sec mini" type="button" id="kp-of-off" style="color:#FF5A5F">Desligar a conexão</button>' : '');
      const sync = of.querySelector('#kp-of-sync');
      if (sync) sync.onclick = async () => { sync.disabled = true; sync.textContent = 'Atualizando…'; try { const r = await MB.api('pluggy_sincronizar'); await desenharOF(`✅ ${r.novos} lançamento(s) novo(s), ${r.contas} conta(s) e ${r.faturas} fatura(s) atualizadas.`); } catch { sync.disabled = false; sync.textContent = 'Atualizar agora'; } };
      const off = of.querySelector('#kp-of-off');
      if (off) off.onclick = async () => { if (!confirm('Desligar a conexão com os bancos? O que já entrou continua no app.')) return; await MB.api('pluggy_desligar'); try { localStorage.removeItem('kf-pluggy'); } catch { /* segue */ } desenharOF('Conexão desligada.'); };
      of.querySelector('#kp-of-con').onclick = async (ev) => {
        const bt = ev.currentTarget; bt.disabled = true; bt.textContent = 'Abrindo…';
        try {
          const { token } = await MB.api('pluggy_token');
          const mod = await import('https://cdn.jsdelivr.net/npm/pluggy-connect-sdk@2.14.2/+esm');
          const PluggyConnect = mod.default || mod.PluggyConnect;
          const w = new PluggyConnect({ connectToken: token,
            onSuccess: async (dados) => { const item = (dados && (dados.item || dados)) || {}; await MB.api('pluggy_item_salvar', { itemId: item.id }); try { localStorage.setItem('kf-pluggy', '1'); } catch { /* segue */ } const r = await MB.api('pluggy_sincronizar').catch(() => null); desenharOF(r ? `✅ Banco conectado: ${r.novos} lançamento(s) entraram.` : '✅ Banco conectado.'); },
            onError: () => { desenharOF('Não deu para conectar agora. Tente de novo.'); } });
          w.init();
        } catch { bt.disabled = false; bt.textContent = 'Conectar banco'; }
      };
    };
    desenharOF('');
    const lot = el.querySelector('#kp-lot');
    const lotes = async (msg) => {
      const r = await MB.api('lote_listar');
      lot.innerHTML = (msg ? `<div class="aviso-c" style="margin-top:10px">${msg}</div>` : '') + (r.lotes.length ? r.lotes.map((x) => `<div class="item"><span>${H.esc(x.nome)}<br><span class="fraco">${x.qtd} lançamento(s) · ${dmy(String(x.criado_em).slice(0, 10))}</span></span><span class="v">${x.despesas ? '− ' + H.brl(x.despesas) : ''}${x.receitas ? ' + ' + H.brl(x.receitas) : ''} <button type="button" class="btn sec mini" data-lot="${H.esc(x.id)}" data-qtd="${x.qtd}" aria-label="Apagar documento">🗑️</button></span></div>`).join('')
        : '<p class="fraco">Nenhum documento gravado ainda (os antigos, de antes desta versão, ficam só em Meus cadastros).</p>');
      lot.querySelectorAll('[data-lot]').forEach((b) => { b.onclick = async () => {
        if (!confirm(`Apagar este documento e os ${b.dataset.qtd} lançamento(s) que vieram dele? Os números do mês mudam.`)) return;
        try { const o = await MB.api('lote_apagar', { id: b.dataset.lot }); await lotes(`🗑️ Documento apagado (${o.apagados} lançamento(s)).`); } catch { /* erro já mostrado */ }
      }; });
    };
    el.querySelector('#kp-lot-btn').onclick = () => { if (lot.innerHTML) { lot.innerHTML = ''; return; } lotes('').catch(() => { lot.innerHTML = '<p class="fraco">Não consegui abrir agora.</p>'; }); };
    el.querySelector('#kp-cad-btn').onclick = () => { if (cad.innerHTML) { cad.innerHTML = ''; return; } desenhar('').catch(() => { cad.innerHTML = '<p class="fraco">Não consegui abrir agora.</p>'; }); };
  };
})();
