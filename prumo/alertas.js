'use strict';
// Kernex Finance: aba Alertas. Você liga e desliga cada tipo e cada canal. Desligado não aparece e não sai por e-mail.
// Aviso no aparelho: só enquanto o app é aberto (não é push de servidor). WhatsApp: só guarda sua autorização, não envia.
(function () {
  const MB = window.MB;
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });
  const lerFlag = () => { try { return localStorage.getItem('kf-aviso-aparelho') === '1'; } catch { return false; } };
  const gravarFlag = (v) => { try { localStorage.setItem('kf-aviso-aparelho', v ? '1' : '0'); } catch { /* sem armazenamento */ } };

  MB.telas.alertas = async (el) => {
    const { esc, aba } = await carregarUi();
    aba('alertas');
    const [{ config: cfg, tipos }, { alertas }] = await Promise.all([MB.api('alertas_config'), MB.api('alertas_listar')]);
    const podeNotificar = typeof Notification !== 'undefined';
    el.innerHTML = `
      <div class="card"><h3 style="margin:0 0 6px">🔔 Precisam de atenção</h3>${alertas.map((a) => `<div class="fraco" data-tipo="${esc(a.tipo)}">• ${esc(a.texto)}</div>`).join('') || '<div class="fraco">Nada agora. Só aviso dos tipos que você deixou ligados.</div>'}</div>
      <div class="card"><h3 style="margin:0 0 6px">O que avisar</h3>${Object.entries(tipos).map(([k, rot]) => `<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-tipo-cfg="${esc(k)}" ${cfg.tipos[k] ? 'checked' : ''}> ${esc(rot)}</label>`).join('')}</div>
      <div class="card"><h3 style="margin:0 0 6px">Por onde avisar</h3>
        <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="al-app" ${cfg.canais.app ? 'checked' : ''}> Dentro do app</label>
        ${podeNotificar ? `<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="al-disp" ${lerFlag() && Notification.permission === 'granted' ? 'checked' : ''}> Aviso neste aparelho ao abrir o app</label>` : ''}
        <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="al-email" ${cfg.canais.email ? 'checked' : ''}> E-mail</label>
        <label>Seu e-mail</label><input id="al-mail" type="email" value="${esc(cfg.email_para || '')}" placeholder="voce@exemplo.com">
        <label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="al-wa" ${cfg.whatsapp.consentimento ? 'checked' : ''}> Autorizo avisos por WhatsApp (em breve; por enquanto só guardo sua autorização)</label>
        <label>Seu WhatsApp com DDD</label><input id="al-wanum" type="tel" value="${esc(cfg.whatsapp.numero || '')}">
        <button class="btn" id="al-salvar" type="button" style="margin-top:10px">Salvar</button>
        <button class="btn sec" id="al-enviar" type="button" style="margin-top:8px">Mandar um e-mail agora com o que precisa de atenção</button>
        <div id="al-msg" class="fraco" style="margin-top:6px"></div></div>`;
    const msg = (t, erro) => { const m = el.querySelector('#al-msg'); m.textContent = t; m.className = 'fraco' + (erro ? ' verm' : ''); };
    el.querySelector('#al-salvar').onclick = async () => {
      const t = {}; el.querySelectorAll('[data-tipo-cfg]').forEach((cb) => { t[cb.dataset.tipoCfg] = cb.checked; });
      try {
        const disp = el.querySelector('#al-disp');
        if (disp) { if (disp.checked && Notification.permission !== 'granted') { const r = await Notification.requestPermission(); if (r !== 'granted') disp.checked = false; } gravarFlag(disp.checked); }
        await MB.api('alertas_salvar', { tipos: t, canais: { app: el.querySelector('#al-app').checked, email: el.querySelector('#al-email').checked }, email_para: el.querySelector('#al-mail').value,
          whatsapp: { consentimento: el.querySelector('#al-wa').checked, numero: el.querySelector('#al-wanum').value } });
        msg('Salvo.');
        MB.abrirAba('alertas');
      } catch (e) { msg(e.message || 'Não consegui salvar.', true); }
    };
    el.querySelector('#al-enviar').onclick = async () => {
      try { const r = await MB.api('alertas_enviar_email'); msg(r.mensagem || `E-mail enviado com ${r.enviados} alerta(s).`); } catch (e) { msg(e.message || 'Não consegui enviar.', true); }
    };
    if (podeNotificar && lerFlag() && Notification.permission === 'granted' && alertas.length) {
      try { new Notification('Kernex Finance', { body: alertas.slice(0, 3).map((a) => a.texto).join('\n'), tag: 'kf-alertas' }); } catch { /* aparelho não deixa */ }
    }
  };
})();
