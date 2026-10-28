// Quero viajar — script independente, sem dependências.
// Botão flutuante com chat em passos que cria lead de viagem.
// Sem internet: guarda no localStorage e reenvia ao voltar online.
(() => {
  'use strict';

  const API_URL = 'https://nexia.gcbezerra.workers.dev/api/viagem';
  const LS_KEY = 'viajantepro:lead:pendente';
  const LS_TS = 'viajantepro:lead:ts';

  // Lê WhatsApp e telefone do site (mesmos usados no formulário de contato e rodapé).
  function lerContatos() {
    const form = document.querySelector('.form');
    let whatsapp = '';
    if (form) whatsapp = form.dataset.whatsapp || '';
    if (!whatsapp) {
      const link = document.querySelector('a[href^="https://wa.me/"]');
      if (link) whatsapp = link.getAttribute('href').replace('https://wa.me/', '').split('?')[0];
    }
    let telefone = '';
    const telLink = document.querySelector('a[href^="tel:"]');
    if (telLink) telefone = telLink.getAttribute('href').replace('tel:', '');
    return { whatsapp, telefone };
  }

  const contatos = lerContatos();
  const leadPendente = JSON.parse(localStorage.getItem(LS_KEY) || 'null');

  // ---------- UI ----------
  const style = document.createElement('style');
  style.textContent = `
    .qv-wrap{position:fixed;z-index:1000;bottom:22px;right:22px;direction:ltr;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
    .qv-btn{display:inline-flex;align-items:center;gap:10px;background:#007380;color:#fff;border:none;border-radius:50px;padding:12px 18px;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(0,115,128,.35);transition:transform .2s,box-shadow .2s}
    .qv-btn:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(0,115,128,.45)}
    .qv-btn svg{width:20px;height:20px;display:block}
    .qv-panel{display:none;position:fixed;z-index:1001;bottom:92px;right:22px;width:min(340px,92vw);max-height:84vh;background:#fff;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.25);flex-direction:column;overflow:hidden;animation:qvAparece .22s ease both}
    @keyframes qvAparece{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
    .qv-head{background:#007380;color:#fff;padding:14px 16px;font-weight:700;font-size:16px;display:flex;align-items:center;justify-content:space-between}
    .qv-close{background:transparent;border:none;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:0 4px}
    .qv-body{padding:16px;overflow-y:auto;max-height:60vh;display:flex;flex-direction:column;gap:14px}
    .qv-passo{display:none;animation:qvFade .2s ease both}
    .qv-passo.ativo{display:flex;flex-direction:column;gap:10px}
    @keyframes qvFade{from{opacity:0}to{opacity:1}}
    .qv-label{font-size:13px;color:#555;margin:0}
    .qv-campo{width:100%;padding:10px 12px;border:1px solid #ccc;border-radius:8px;font-size:15px}
    .qv-campo:focus{border-color:#007380;outline:none}
    .qv-opcoes{display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:8px}
    .qv-opcao{border:1px solid #ccc;background:#fff;border-radius:8px;padding:10px 6px;text-align:center;font-size:14px;cursor:pointer;user-select:none}
    .qv-opcao.ativo{border-color:#007380;background:#e8f4f7;color:#007380;font-weight:700}
    .qv-acao{margin-top:8px;display:flex;gap:8px}
    .qv-btn-sec{flex:1;background:#fff;color:#007380;border:1px solid #007380;border-radius:8px;padding:10px 14px;font-size:14px;font-weight:700;cursor:pointer}
    .qv-btn-sec:disabled{opacity:.5;cursor:not-allowed}
    .qv-btn-prim{flex:1;background:#007380;color:#fff;border:none;border-radius:8px;padding:10px 14px;font-size:14px;font-weight:700;cursor:pointer}
    .qv-btn-prim:disabled{opacity:.6;cursor:not-allowed}
    .qv-msg{font-size:13px;color:#d32f2f;margin:0;min-height:1.2em}
    .qv-rodape{padding:10px 14px;background:#f5f5f5;border-top:1px solid #ddd;font-size:13px;color:#666;display:flex;flex-direction:column;gap:6px}
    .qv-linha{display:flex;align-items:center;gap:10px;text-decoration:none;color:#007380;font-weight:600;font-size:14px}
    .qv-linha svg{width:18px;height:18px;flex-shrink:0}
    .qv-linha:hover{text-decoration:underline}
    .qv-ico-whatsapp{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;background:#25d366;border-radius:50%;color:#fff}
    .qv-ico-tel{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;background:#007380;border-radius:50%;color:#fff}
    .qv-hidden{display:none!important}
    .qv-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}
  `;
  document.head.appendChild(style);

  const svgFone = '<svg class="i" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 0 7h3c.11 0 .21-.07.29-.18"/><path d="M22 12h-4"/></svg>';
  const svgMsg = '<svg class="i" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="16" y1="8" x2="21" y2="13"/><line x1="10" y1="13" x2="15" y2="15"/></svg>';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'qv-btn';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-label', 'Quero viajar — abrir chat');
  btn.innerHTML = '<span>Quero viajar</span>' + svgMsg;

  const wrap = document.createElement('div');
  wrap.className = 'qv-wrap';

  const panel = document.createElement('div');
  panel.className = 'qv-panel';
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'qv-titulo');

  const head = document.createElement('div');
  head.className = 'qv-head';
  head.innerHTML = '<span id="qv-titulo">Quero viajar</span><button class="qv-close" type="button" aria-label="Fechar">×</button>';

  const body = document.createElement('div');
  body.className = 'qv-body';

  const rodape = document.createElement('div');
  rodape.className = 'qv-rodape';
  const linhas = [];
  if (contatos.whatsapp) {
    linhas.push('<a class="qv-linha" href="https://wa.me/' + contatos.whatsapp + '" target="_blank" rel="noopener"><span class="qv-ico-whatsapp">💬</span><span>WhatsApp: ' + contatos.whatsapp + '</span></a>');
  }
  if (contatos.telefone) {
    linhas.push('<a class="qv-linha" href="tel:' + contatos.telefone + '" aria-label="Ligar para ' + contatos.telefone + '"><span class="qv-ico-tel">📞</span><span>Telefone: ' + contatos.telefone + '</span></a>');
  }
  rodape.innerHTML = linhas.join('') || '<p>Sem contato disponível no momento.</p>';

  panel.appendChild(head);
  panel.appendChild(body);
  panel.appendChild(rodape);
  wrap.appendChild(btn);
  wrap.appendChild(panel);
  document.body.appendChild(wrap);

  // ---------- Estado do chat ----------
  const passos = [
    { chave: 'destino', label: 'Para onde você quer viajar?', tipo: 'texto', placeholder: 'Ex: Porto de Galinhas, Gramado...' },
    { chave: 'datas', label: 'Qual a data da viagem?', tipo: 'texto', placeholder: 'Ex: 15 a 22 de julho' },
    { chave: 'pessoas', label: 'Quantas pessoas vão?', tipo: 'opcao', opcoes: ['1', '2', '3', '4 ou mais'] },
    { chave: 'nome', label: 'Seu nome', tipo: 'texto', placeholder: 'Ex: Maria Silva' },
    { chave: 'whatsapp', label: 'Seu WhatsApp (com DDD)', tipo: 'tel', placeholder: 'Ex: (11) 99999-9999' }
  ];
  let indice = 0;
  const dados = {};
  let enviando = false;

  function montarPasso() {
    const p = passos[indice];
    body.innerHTML = '';
    const h3 = document.createElement('h3');
    h3.textContent = p.label;
    h3.style = 'margin:0 0 4px 0;font-size:17px;color:#111';
    body.appendChild(h3);

    if (p.tipo === 'opcao') {
      const grid = document.createElement('div');
      grid.className = 'qv-opcoes';
      p.opcoes.forEach(o => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'qv-opcao';
        b.textContent = o;
        b.addEventListener('click', () => {
          grid.querySelectorAll('.qv-opcao').forEach(x => x.classList.remove('ativo'));
          b.classList.add('ativo');
          dados[p.chave] = o;
          proximo.disabled = false;
        });
        grid.appendChild(b);
      });
      body.appendChild(grid);
    } else {
      const input = document.createElement('input');
      input.type = p.tipo;
      input.className = 'qv-campo';
      input.placeholder = p.placeholder;
      input.required = true;
      input.addEventListener('input', () => {
        dados[p.chave] = input.value.trim();
        proximo.disabled = !dados[p.chave];
      });
      body.appendChild(input);
    }

    const acao = document.createElement('div');
    acao.className = 'qv-acao';
    const voltar = document.createElement('button');
    voltar.type = 'button';
    voltar.className = 'qv-btn-sec';
    voltar.textContent = indice > 0 ? 'Voltar' : 'Fechar';
    voltar.disabled = indice === 0;
    voltar.addEventListener('click', () => {
      if (indice === 0) fechar();
      else { indice--; montarPasso(); }
    });

    const proximo = document.createElement('button');
    proximo.type = 'button';
    proximo.className = 'qv-btn-prim';
    proximo.textContent = indice === passos.length - 1 ? 'Enviar' : 'Próximo';
    proximo.disabled = true;
    proximo.addEventListener('click', () => {
      if (indice === passos.length - 1) enviar();
      else { indice++; montarPasso(); }
    });

    acao.appendChild(voltar);
    acao.appendChild(proximo);
    body.appendChild(acao);

    const err = document.createElement('p');
    err.className = 'qv-msg qv-hidden';
    body.appendChild(err);

    if (indice === passos.length - 1 && dados[p.chave]) proximo.disabled = false;
  }

  function abrir() {
    panel.style.display = 'flex';
    btn.setAttribute('aria-expanded', 'true');
    indice = 0;
    montarPasso();
    const primeiro = body.querySelector('.qv-campo, .qv-opcao');
    if (primeiro) primeiro.focus();
  }

  function fechar() {
    panel.style.display = 'none';
    btn.setAttribute('aria-expanded', 'false');
    btn.focus();
  }

  btn.addEventListener('click', () => {
    const aberto = btn.getAttribute('aria-expanded') === 'true';
    if (aberto) fechar(); else abrir();
  });
  head.querySelector('.qv-close').addEventListener('click', fechar);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && panel.style.display !== 'none') fechar(); });

  // ---------- Envio ----------
  function mostrarErro(msg) {
    const err = body.querySelector('.qv-msg');
    if (err) { err.textContent = msg; err.classList.remove('qv-hidden'); }
  }
  function limparErro() {
    const err = body.querySelector('.qv-msg');
    if (err) { err.textContent = ''; err.classList.add('qv-hidden'); }
  }

  async function enviar() {
    limparErro();
    const p = passos[indice];
    if (!dados[p.chave]) { mostrarErro('Preencha este campo.'); return; }

    const payload = { acao: 'lead_criar', site: 'viajantepro', ...dados };
    enviando = true;
    const proximo = body.querySelector('.qv-btn-prim');
    if (proximo) { proximo.disabled = true; proximo.textContent = 'Enviando...'; }

    try {
      const res = await fetch(API_URL + '?site=viajantepro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Erro ' + res.status);
      await res.json();
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(LS_TS);
      body.innerHTML = '';
      const ok = document.createElement('div');
      ok.style = 'text-align:center;padding:16px';
      ok.innerHTML = '<p style="margin:0 0 8px 0;color:#2e7d32;font-weight:700">Obrigado!</p><p style="margin:0;font-size:14px;color:#444">Seu pedido de viagem foi enviado. Em breve entraremos em contato.</p>';
      body.appendChild(ok);
      setTimeout(fechar, 1500);
    } catch (err) {
      // Sem internet ou erro no servidor: guarda e tenta reenviar ao voltar online.
      try { localStorage.setItem(LS_KEY, JSON.stringify(payload)); localStorage.setItem(LS_TS, String(Date.now())); } catch (e) {}
      mostrarErro('Sem conexão no momento. Salvei sua mensagem e envio quando a internet voltar.');
      if (proximo) { proximo.disabled = false; proximo.textContent = 'Tentar novamente'; }
    } finally {
      enviando = false;
    }
  }

  // Reenvio quando volta a ficar online
  async function reenviarPendente() {
    if (!leadPendente || enviando) return;
    try {
      const res = await fetch(API_URL + '?site=viajantepro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        body: JSON.stringify(leadPendente)
      });
      if (!res.ok) throw new Error('Erro ' + res.status);
      await res.json();
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(LS_TS);
    } catch (e) {
      // mantém no localStorage para próxima tentativa
    }
  }

  window.addEventListener('online', reenviarPendente);

  // Se houver lead pendente do armazenamento, tenta reenviar ao carregar (sem mostrar UI)
  if (leadPendente && navigator.onLine) {
    reenviarPendente();
  }
})();
