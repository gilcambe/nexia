'use strict';
// Kernex Finance: aba Ajuda. Fale com o suporte, veja seu plano, baixe ou apague seus dados (LGPD)
// e autorize o suporte por tempo limitado. Se quem entrou é o administrador master, aparece também
// o painel do administrador: pessoas, planos, uso e mensagens. Nunca mostra documentos nem valores de ninguém.
(function () {
  const MB = window.MB;
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });
  const NOMES = { gratis: 'Grátis', pro: 'Pro', master: 'Master' };
  const dataBr = (iso) => { try { return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); } catch { return iso || ''; } };

  async function admin(metodo, parametros, corpo) {
    const u = MB.usuario(); if (!u) throw new Error('Entre com sua conta.');
    const token = await u.getIdToken();
    const qs = parametros ? '?' + new URLSearchParams(parametros).toString() : '';
    const r = await fetch('/api/prumo-admin' + qs, { method: metodo, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: corpo ? JSON.stringify(corpo) : undefined });
    let j = {}; try { j = await r.json(); } catch { /* vazio */ }
    if (!r.ok) { const e = new Error(j.error || 'Erro no painel.'); e.status = r.status; throw e; }
    return j;
  }

  async function painelAdmin(caixa, esc) {
    let d;
    try { d = await admin('GET', { parte: 'resumo' }); } catch (e) { if (e.status === 403 || e.status === 401) { caixa.hidden = true; return; } throw e; }
    caixa.hidden = false;
    caixa.innerHTML = `<div class="card"><h3 style="margin:0 0 6px">🛡️ Painel do administrador</h3>
      <div class="fraco">Mês ${esc(d.mes)}: ${d.total_pessoas} pessoa(s), ${d.leituras_mes} leitura(s) de documento, ${d.mensagens_abertas} mensagem(ns) esperando resposta.</div>
      <div class="fraco">Por plano: ${Object.entries(d.por_plano).map(([p, n]) => `${esc(NOMES[p] || p)} ${n}`).join(' · ') || 'ninguém ainda'}</div>
      <div class="fraco" style="margin-top:4px">Aqui você não vê documentos nem valores de ninguém, só uso e mensagens.</div>
      ${d.pessoas.map((p) => `<div style="border-top:1px solid #8883;margin-top:8px;padding-top:8px" data-uid="${esc(p.uid)}">
        <div><b>${esc(p.uid.slice(0, 8))}…</b> desde ${esc(p.desde ? dataBr(p.desde) : '?')} · ${p.leituras_mes} leitura(s)${p.mensagens_abertas ? ` · <b>${p.mensagens_abertas} mensagem(ns) nova(s)</b>` : ''}</div>
        <label>Plano</label><select data-plano>${d.planos.map((n) => `<option value="${esc(n)}" ${n === p.plano ? 'selected' : ''}>${esc(NOMES[n] || n)}</option>`).join('')}</select>
        <button class="btn sec" type="button" data-ver>Ver mensagens</button><div data-conversa></div></div>`).join('')}
      <div id="adm-msg" class="fraco"></div></div>`;
    const aviso = (t) => { caixa.querySelector('#adm-msg').textContent = t; };
    caixa.querySelectorAll('[data-uid]').forEach((linha) => {
      const uid = linha.dataset.uid;
      linha.querySelector('[data-plano]').onchange = async (ev) => {
        try { await admin('POST', null, { acao: 'plano_definir', uid, plano: ev.target.value }); aviso('Plano trocado.'); } catch (e) { aviso(e.message); }
      };
      linha.querySelector('[data-ver]').onclick = async () => {
        const alvo = linha.querySelector('[data-conversa]');
        try {
          const { mensagens } = await admin('GET', { parte: 'mensagens', uid });
          alvo.innerHTML = (mensagens.map((m) => `<div class="fraco">${m.de === 'admin' ? '🛡️ Você' : '🙋 Pessoa'} (${esc(dataBr(m.em))}): ${esc(m.texto)}</div>`).join('') || '<div class="fraco">Sem mensagens.</div>')
            + '<textarea data-resp rows="2" placeholder="Sua resposta"></textarea><button class="btn" type="button" data-responder>Responder</button>';
          alvo.querySelector('[data-responder]').onclick = async () => {
            try { await admin('POST', null, { acao: 'mensagem_responder', uid, texto: alvo.querySelector('[data-resp]').value }); aviso('Resposta enviada.'); painelAdmin(caixa, esc); } catch (e) { aviso(e.message); }
          };
        } catch (e) { aviso(e.message); }
      };
    });
  }

  MB.telas.ajuda = async (el) => {
    const { esc, aba } = await carregarUi();
    aba('ajuda');
    const [{ mensagens, suporte_ate: ate }, plano] = await Promise.all([MB.api('ajuda_listar'), MB.api('meu_plano')]);
    el.innerHTML = `
      <div class="card"><h3 style="margin:0 0 6px">💬 Fale com a gente</h3>
        ${mensagens.map((m) => `<div class="fraco">${m.de === 'admin' ? '🛡️ Suporte' : '🙋 Você'} (${esc(dataBr(m.em))}): ${esc(m.texto)}</div>`).join('') || '<div class="fraco">Escreva sua dúvida ou problema. A resposta aparece aqui.</div>'}
        <textarea id="aj-texto" rows="3" maxlength="1500" placeholder="Escreva aqui"></textarea>
        <button class="btn" id="aj-enviar" type="button">Enviar</button></div>
      <div class="card"><h3 style="margin:0 0 6px">⭐ Seu plano</h3>
        <div class="fraco">Plano ${esc(NOMES[plano.plano] || plano.plano)}: ${plano.limite == null ? `${plano.usadas} leitura(s) de documento este mês, sem limite.` : `${plano.usadas} de ${plano.limite} leituras de documento usadas este mês.`}</div></div>
      <div class="card"><h3 style="margin:0 0 6px">🔐 Suporte ver sua conta</h3>
        <div class="fraco">${ate ? `Autorizado até ${esc(dataBr(ate))}.` : 'Ninguém do suporte pode olhar sua conta. Se precisar, autorize por um tempo curto.'}</div>
        <button class="btn sec" type="button" data-horas="24">Autorizar por 24 horas</button>
        <button class="btn sec" type="button" data-horas="72">Autorizar por 72 horas</button>
        ${ate ? '<button class="btn sec" type="button" data-horas="0">Cancelar autorização</button>' : ''}</div>
      <div class="card"><h3 style="margin:0 0 6px">📦 Seus dados (LGPD)</h3>
        <button class="btn sec" id="aj-baixar" type="button">Baixar uma cópia de tudo</button>
        <label style="margin-top:8px">Para apagar tudo, escreva APAGAR</label><input id="aj-conf" autocomplete="off">
        <button class="btn sec verm" id="aj-apagar" type="button">Apagar todos os meus dados</button></div>
      <div id="aj-msg" class="fraco"></div>
      <div id="aj-admin" hidden></div>`;
    const msg = (t) => { el.querySelector('#aj-msg').textContent = t; };
    el.querySelector('#aj-enviar').onclick = async () => {
      try { await MB.api('ajuda_enviar', { texto: el.querySelector('#aj-texto').value }); MB.abrirAba('ajuda'); } catch (e) { msg(e.message); }
    };
    el.querySelectorAll('[data-horas]').forEach((b) => { b.onclick = async () => { try { await MB.api('suporte_autorizar', { horas: Number(b.dataset.horas) }); MB.abrirAba('ajuda'); } catch (e) { msg(e.message); } }; });
    el.querySelector('#aj-baixar').onclick = async () => {
      try {
        const dados = await MB.api('meus_dados_exportar');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }));
        a.download = 'kernex-finance-meus-dados.json'; document.body.appendChild(a); a.click(); a.remove();
        msg('Cópia baixada.');
      } catch (e) { msg(e.message); }
    };
    el.querySelector('#aj-apagar').onclick = async () => {
      const c = el.querySelector('#aj-conf').value.trim().toUpperCase();
      if (c !== 'APAGAR') { msg('Escreva APAGAR para confirmar.'); return; }
      try { const r = await MB.api('meus_dados_apagar', { confirmacao: 'APAGAR' }); msg(`Pronto. ${r.apagados} item(ns) apagado(s).`); } catch (e) { msg(e.message); }
    };
    painelAdmin(el.querySelector('#aj-admin'), esc).catch((e) => { const c = el.querySelector('#aj-admin'); c.hidden = false; c.textContent = e.message; });
  };
})();
