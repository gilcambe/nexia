// Viajante Pro — painel da agência (login pela API /api/viagem).
(function () {
  'use strict';
  const P = window.VPP;
  const SITE = 'viajantepro';
  const API = window.VP_API || 'https://nexia.gcbezerra.workers.dev/api/viagem';
  const ORIGEM = location.origin + location.pathname.replace(/\/painel\/.*$/, '').replace(/\/painel$/, '');
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const hoje = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const dataBR = iso => (/^\d{4}-\d{2}-\d{2}/.test(iso || '') ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
  const quando = iso => { try { return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };

  let TOKEN = '';
  try { TOKEN = localStorage.getItem('vp_painel_token') || ''; } catch (e) { /* sem storage */ }
  const D = { viagens: [], clientes: [], leads: [], conversas: [], site: {} };
  let aba = 'inicio';
  let conversaAberta = '';

  function aviso(txt, ruim) { const a = $('aviso'); a.textContent = txt; a.className = 'toast' + (ruim ? ' ruim' : ''); clearTimeout(aviso.t); aviso.t = setTimeout(() => a.classList.add('oculto'), 3500); }

  async function api(corpo) {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ site: SITE, token: TOKEN, ...corpo }) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && j.sair) { sair(); throw new Error(j.error); }
    if (!r.ok) throw new Error(j.error || 'Erro ' + r.status);
    return j;
  }

  function sair() {
    if (TOKEN) api({ acao: 'sair' }).catch(() => {});
    TOKEN = ''; try { localStorage.removeItem('vp_painel_token'); } catch (e) { /* ok */ }
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
    $('tela-login').classList.add('ativa'); $('menu').classList.add('oculto'); $('btn-sair').classList.add('oculto');
  }

  function irPara(nome) {
    aba = nome;
    document.querySelectorAll('.tela').forEach(s => s.classList.toggle('ativa', s.dataset.aba === nome));
    document.querySelectorAll('#menu button').forEach(b => b.classList.toggle('ativo', b.dataset.ir === nome));
    desenhar();
    window.scrollTo(0, 0);
  }

  async function recarregar() {
    const [v, c, l, cv, s] = await Promise.all([api({ acao: 'viagem_listar' }), api({ acao: 'cliente_listar' }), api({ acao: 'leads_listar' }), api({ acao: 'conversas_listar' }), api({ acao: 'site_obter' })]);
    D.viagens = v.viagens || []; D.clientes = c.clientes || []; D.leads = l.leads || []; D.conversas = cv.conversas || []; D.site = s.site || {};
    badge();
    desenhar();
  }

  const nomeViagem = id => { const v = D.viagens.find(x => x.id === id); return v ? `${v.cliente_nome || ''} · ${v.titulo}` : 'Viagem apagada'; };
  function badge() { const n = D.conversas.reduce((s, c) => s + c.nao_lidas, 0); $('badge').textContent = n; $('badge').classList.toggle('oculto', !n); return n; }

  function desenhar() {
    ({ inicio: telaInicio, leads: telaLeads, clientes: telaClientes, viagens: telaViagens, conversas: telaConversas, appcliente: telaApp, site: telaSite, conta: telaConta })[aba]();
  }

  // ── Início ──
  function linhaViagem(v, extra) {
    const pend = P.pendencias(v);
    return `<div class="item"><div><b>${esc(v.cliente_nome || 'Sem cliente')}</b> — ${esc(v.titulo)}<div class="det">${esc(dataBR(v.data_saida))} → ${esc(dataBR(v.data_retorno))} · ${esc(v.destino)}</div>${pend.length ? pend.map(p => `<span class="chip">falta ${esc(p)}</span>`).join('') : '<span class="chip ok">tudo pronto</span>'}${extra || ''}</div><button class="btn contorno" data-editar-viagem="${esc(v.id)}">Abrir</button></div>`;
  }
  function telaInicio() {
    const h = hoje();
    const emb = P.embarcamHoje(D.viagens, h), vol = P.voltamHoje(D.viagens, h), agora = P.viajandoAgora(D.viagens, h), prob = P.voosComProblema(D.viagens), prox = P.proximas(D.viagens, h, 30);
    const naoLidas = badge();
    const novosLeads = D.leads.length;
    $('tela-inicio').innerHTML = `
      <div class="cont"><div class="cartao"><b>${emb.length}</b>embarcam hoje</div><div class="cartao"><b>${vol.length}</b>voltam hoje</div><div class="cartao"><b>${agora.length}</b>viajando agora</div><div class="cartao"><b>${naoLidas}</b>mensagens não lidas</div><div class="cartao"><b>${novosLeads}</b>leads</div></div>
      ${prob.length ? `<div class="cartao" style="border-color:var(--vermelho)"><h2>⚠️ Voos com problema</h2>${prob.map(p => `<div class="item"><div><b>${esc(p.viagem.cliente_nome)}</b> — ${esc(p.voo.trecho || p.voo.numero)}: ${esc(p.voo.status)}</div></div>`).join('')}</div>` : ''}
      <div class="cartao"><h2>Viajando agora</h2>${agora.map(v => linhaViagem(v)).join('') || '<p class="vazio">Ninguém viajando hoje.</p>'}</div>
      <div class="cartao"><h2>Próximas viagens (30 dias)</h2>${prox.map(v => linhaViagem(v)).join('') || '<p class="vazio">Nenhuma viagem nos próximos 30 dias.</p>'}</div>`;
  }

  // ── Leads ──
  function telaLeads() {
    $('tela-leads').innerHTML = `<div class="cartao"><h2>Leads (interessados do site e telefone)</h2>
      <details><summary>+ Anotar lead de telefone</summary><form id="form-lead" class="grade"><label>Nome<input name="nome" required></label><label>WhatsApp<input name="whatsapp" required></label><label>Destino<input name="destino"></label><label>Mensagem<input name="mensagem"></label><button class="btn" type="submit">Salvar lead</button></form></details>
      ${D.leads.map(l => `<div class="item"><div><b>${esc(l.nome)}</b> ${l.destino ? '— ' + esc(l.destino) : ''}<div class="det">${esc(l.whatsapp || '')} ${esc(l.email || '')} · ${esc(quando(l.criado_em))}</div><div>${esc(l.mensagem)}</div></div>
        <div class="linha-btns">${l.whatsapp ? `<a class="btn contorno" target="_blank" rel="noopener" href="https://wa.me/${esc(l.whatsapp.length <= 11 ? '55' + l.whatsapp : l.whatsapp)}">WhatsApp</a>` : ''}<button class="btn" data-virar="${esc(l.id)}">Virar cliente</button><button class="btn contorno" data-orcar="${esc(l.id)}">Criar orçamento</button></div></div>`).join('') || '<p class="vazio">Nenhum lead ainda.</p>'}</div>`;
  }

  async function virarCliente(id, comViagem) {
    const l = D.leads.find(x => x.id === id);
    const r = await api({ acao: 'cliente_salvar', cliente: { nome: l.nome, email: l.email, whatsapp: l.whatsapp, obs: l.mensagem } });
    if (comViagem) {
      const v = await api({ acao: 'viagem_salvar', viagem: { titulo: 'Orçamento ' + (l.destino || l.nome), destino: l.destino, cliente_id: r.id, cliente_nome: l.nome, cliente_whatsapp: l.whatsapp, status: 'orcamento', descricao: l.mensagem } });
      await recarregar(); abrirEditor(v.id); return;
    }
    aviso('Cliente criado.'); await recarregar();
  }

  // ── Clientes ──
  let busca = '';
  function telaClientes() {
    const lista = D.clientes.filter(c => !busca || `${c.nome} ${c.email} ${c.whatsapp}`.toLowerCase().includes(busca.toLowerCase()));
    $('tela-clientes').innerHTML = `<div class="cartao"><h2>Clientes</h2><input id="busca-cli" placeholder="Buscar por nome, e-mail ou WhatsApp" value="${esc(busca)}">
      <details><summary>+ Novo cliente</summary><form id="form-cli" class="grade"><input type="hidden" name="id"><label>Nome<input name="nome" required></label><label>WhatsApp<input name="whatsapp"></label><label>E-mail<input name="email" type="email"></label><label>Documento<input name="doc"></label><label>Nascimento<input name="nasc" type="date"></label><label>Observações<input name="obs"></label><button class="btn" type="submit">Salvar cliente</button></form></details>
      ${lista.map(c => { const vs = D.viagens.filter(v => v.cliente_id === c.id); return `<div class="item"><div><b>${esc(c.nome)}</b><div class="det">${esc(c.whatsapp)} ${esc(c.email)} ${c.obs ? '· ' + esc(c.obs) : ''}</div>${vs.map(v => `<span class="chip ok">${esc(v.titulo)}</span>`).join('')}</div><div class="linha-btns"><button class="btn" data-nova-viagem="${esc(c.id)}">Nova viagem</button><button class="btn contorno" data-editar-cli="${esc(c.id)}">Editar</button></div></div>`; }).join('') || '<p class="vazio">Nenhum cliente.</p>'}</div>`;
  }

  // ── Viagens (editor completo: tudo que aparece no app) ──
  const CAMPOS = {
    voos: [['trecho', 'Trecho (ex.: GRU → LIS)'], ['cia', 'Companhia'], ['numero', 'Número do voo'], ['data', 'Data', 'date'], ['partida', 'Saída', 'time'], ['chegada', 'Chegada', 'time'], ['terminal', 'Terminal'], ['portao', 'Portão'], ['assento', 'Assento'], ['localizador', 'Localizador'], ['bagagem_mao', 'Bagagem de mão'], ['bagagem_despachada', 'Bagagem despachada'], ['status', 'Status', 'select:no horário|atrasado|cancelado|portão trocado|embarcando'], ['nova_partida', 'Nova saída (se atrasou)', 'time'], ['link_checkin', 'Link do check-in da companhia', 'url'], ['checkin_horas', 'Check-in abre quantas horas antes', 'number']],
    hoteis: [['nome', 'Hotel'], ['endereco', 'Endereço'], ['endereco_local', 'Endereço na língua local (para o motorista)'], ['telefone', 'Telefone'], ['checkin', 'Check-in', 'date'], ['checkin_hora', 'Hora check-in', 'time'], ['checkout', 'Check-out', 'date'], ['checkout_hora', 'Hora check-out', 'time'], ['voucher', 'Voucher / reserva']],
    carros: [['locadora', 'Locadora'], ['retirada', 'Retirada', 'date'], ['retirada_hora', 'Hora retirada', 'time'], ['devolucao', 'Devolução', 'date'], ['endereco', 'Endereço da loja'], ['reserva', 'Reserva']],
    transfers: [['data', 'Data', 'date'], ['hora', 'Hora', 'time'], ['de', 'De'], ['para', 'Para'], ['motorista', 'Motorista'], ['telefone', 'Telefone do motorista']],
    documentos: [['titulo', 'Nome (ex.: Seguro viagem, Voucher hotel)'], ['url', 'Link (opcional)', 'url'], ['arquivo', 'Arquivo', 'arquivo']],
    avisos: [['texto', 'Aviso para o viajante']],
  };
  const TITULOS = { voos: '✈️ Voos', hoteis: '🏨 Hotéis', carros: '🚗 Carros', transfers: '🚐 Transfers', documentos: '📄 Documentos', avisos: '📢 Avisos' };
  let edit = null;

  function campo(lista, i, [k, rot, tipo], val) {
    const nome = `${lista}.${i}.${k}`;
    if (tipo && tipo.startsWith('select:')) return `<label>${rot}<select name="${nome}"><option value=""></option>${tipo.slice(7).split('|').map(o => `<option ${o === val ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`;
    if (tipo === 'arquivo') return `<label>${rot} ${val ? '<span class="chip ok">enviado</span>' : ''}<input type="hidden" name="${nome}" value="${esc(val)}"><input type="file" accept="application/pdf,image/*" data-arquivo="${nome}"></label>`;
    return `<label>${rot}<input name="${nome}" type="${tipo || 'text'}" value="${esc(val)}"></label>`;
  }
  function blocos(lista) {
    const itens = edit[lista] || [];
    return `<div class="cartao"><h3>${TITULOS[lista]}</h3>${itens.map((it, i) => `<div class="bloco"><div class="grade">${CAMPOS[lista].map(c => campo(lista, i, c, it[c[0]])).join('')}</div><button class="btn-mini" type="button" data-tirar="${lista}.${i}">Remover</button></div>`).join('')}<button class="btn contorno" type="button" data-por="${lista}">+ Adicionar</button></div>`;
  }

  function lerFormViagem() {
    const f = $('form-viagem');
    if (!f) return;
    const fd = new FormData(f);
    for (const [k, v] of fd.entries()) {
      const p = k.split('.');
      if (p.length === 3) { edit[p[0]][Number(p[1])][p[2]] = p[2] === 'checkin_horas' ? Number(v) || 0 : v; continue; }
      if (k.startsWith('em_')) { edit.emergencia[k.slice(3)] = v; continue; }
      if (k.startsWith('bag_')) { edit.bagagem[k.slice(4)] = v; continue; }
      if (k === 'roteiro_txt') { edit.roteiro = P.roteiroDeTexto(v); continue; }
      if (k === 'passageiros_txt') { edit.passageiros = v.split('\n').map(s => s.trim()).filter(Boolean).map(nome => ({ nome })); continue; }
      if (k === 'pago') { edit.pendencias.pagamento = v === 'sim' ? true : v === 'nao' ? false : null; continue; }
      edit[k] = v;
    }
    if (edit.cliente_id) { const c = D.clientes.find(x => x.id === edit.cliente_id); if (c) { edit.cliente_nome = c.nome; edit.cliente_whatsapp = c.whatsapp; } }
  }

  function abrirEditor(id, clienteId) {
    const v = id ? D.viagens.find(x => x.id === id) : null;
    edit = JSON.parse(JSON.stringify(v || { titulo: '', destino: '', cliente_id: clienteId || '', status: 'ativo' }));
    ['voos', 'hoteis', 'carros', 'transfers', 'documentos', 'avisos', 'roteiro', 'passageiros'].forEach(k => { if (!Array.isArray(edit[k])) edit[k] = []; });
    ['emergencia', 'bagagem', 'pendencias'].forEach(k => { if (!edit[k] || typeof edit[k] !== 'object') edit[k] = {}; });
    if (!edit.emergencia.telefone_24h) edit.emergencia.telefone_24h = D.site.telefone || D.site.whatsapp || '5511941247074';
    aba = 'viagens'; document.querySelectorAll('#menu button').forEach(b => b.classList.toggle('ativo', b.dataset.ir === 'viagens'));
    document.querySelectorAll('.tela').forEach(s => s.classList.toggle('ativa', s.dataset.aba === 'viagens'));
    desenharEditor();
  }

  function desenharEditor() {
    const e = edit;
    const link = e.token ? P.linkApp(ORIGEM, e.token) : '';
    const cli = D.clientes.find(c => c.id === e.cliente_id) || {};
    $('tela-viagens').innerHTML = `<form id="form-viagem">
      <div class="cartao"><div class="item"><h2>${e.id ? 'Editar viagem' : 'Nova viagem'}</h2><button class="btn contorno" type="button" data-voltar-viagens>← Voltar</button></div>
        <div class="grade">
          <label>Título<input name="titulo" required value="${esc(e.titulo)}" placeholder="Ex.: Lisboa e Porto"></label>
          <label>Destino<input name="destino" value="${esc(e.destino)}"></label>
          <label>Cliente<select name="cliente_id"><option value="">—</option>${D.clientes.map(c => `<option value="${esc(c.id)}" ${c.id === e.cliente_id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></label>
          <label>Saída<input name="data_saida" type="date" value="${esc(e.data_saida)}"></label>
          <label>Volta<input name="data_retorno" type="date" value="${esc(e.data_retorno)}"></label>
          <label>Status<select name="status">${['orcamento', 'ativo', 'concluida', 'cancelada'].map(s => `<option ${s === e.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
          <label>Pagamento<select name="pago"><option value="">—</option><option value="sim" ${e.pendencias.pagamento === true ? 'selected' : ''}>pago</option><option value="nao" ${e.pendencias.pagamento === false ? 'selected' : ''}>falta pagar</option></select></label>
          <label>Valor (R$)<input name="valor" type="number" min="0" step="0.01" value="${esc(e.valor || '')}"></label>
        </div>
        <label>Passageiros (um por linha)<textarea name="passageiros_txt">${esc((e.passageiros || []).map(p => p.nome).join('\n'))}</textarea></label>
        <label>Descrição<textarea name="descricao">${esc(e.descricao)}</textarea></label>
        ${link ? `<p class="det">Link do app: <a href="${esc(link)}" target="_blank" rel="noopener">${esc(link)}</a></p><div class="linha-btns"><button class="btn" type="button" data-copiar-link>Copiar link do app</button><a class="btn verde" target="_blank" rel="noopener" href="${esc(P.linkWhatsApp(cli.whatsapp && cli.whatsapp.length <= 11 ? '55' + cli.whatsapp : cli.whatsapp, cli.nome, link))}">Mandar link no WhatsApp</a><button class="btn contorno" type="button" data-novo-link>Gerar novo link</button></div>` : '<p class="det">Salve a viagem para gerar o link do app.</p>'}
      </div>
      ${['voos', 'hoteis', 'carros', 'transfers'].map(blocos).join('')}
      <div class="cartao"><h3>🗺️ Roteiro dia a dia</h3><p class="det">Uma linha com a data abre o dia (ex.: <code>2026-12-02 Lisboa</code>). Depois, uma linha por passeio: <code>10:00 | Torre de Belém | Av. Brasília, Lisboa</code></p><textarea name="roteiro_txt" rows="8">${esc(P.roteiroParaTexto(e.roteiro))}</textarea></div>
      <div class="cartao"><h3>🧳 Bagagem</h3><div class="grade"><label>Mão<input name="bag_mao" value="${esc(e.bagagem.mao)}"></label><label>Despachada<input name="bag_despachada" value="${esc(e.bagagem.despachada)}"></label><label>Dicas<input name="bag_dicas" value="${esc(e.bagagem.dicas)}"></label></div></div>
      ${blocos('documentos')}${blocos('avisos')}
      <div class="cartao"><h3>🆘 Emergência</h3><div class="grade"><label>Telefone 24h da agência<input name="em_telefone_24h" value="${esc(e.emergencia.telefone_24h)}"></label><label>Número de emergência do país<input name="em_numero_pais" value="${esc(e.emergencia.numero_pais)}"></label><label>Consulado<input name="em_consulado" value="${esc(e.emergencia.consulado)}"></label><label>Contato do viajante (nome)<input name="em_contato_nome" value="${esc(e.emergencia.contato_nome)}"></label><label>Contato do viajante (telefone)<input name="em_contato_telefone" value="${esc(e.emergencia.contato_telefone)}"></label><label>Seguro viagem (telefone/apólice)<input name="em_seguro" value="${esc(e.emergencia.seguro)}"></label></div></div>
      <div class="linha-btns"><button class="btn" type="submit">💾 Salvar viagem</button>${e.id ? '<button class="btn contorno" type="button" data-apagar-viagem>Apagar viagem</button>' : ''}</div>
    </form>`;
  }

  function telaViagens() {
    if (edit) return desenharEditor();
    $('tela-viagens').innerHTML = `<div class="cartao"><div class="item"><h2>Viagens</h2><button class="btn" data-nova-viagem="">+ Nova viagem</button></div>${D.viagens.map(v => linhaViagem(v)).join('') || '<p class="vazio">Nenhuma viagem ainda.</p>'}</div>`;
  }

  async function salvarViagem() {
    lerFormViagem();
    const r = await api({ acao: 'viagem_salvar', viagem: edit });
    aviso('Viagem salva. O app do cliente já mostra.');
    await recarregar();
    edit = JSON.parse(JSON.stringify(r.viagem));
    desenharEditor();
  }

  async function enviarArquivo(input) {
    const f = input.files[0];
    if (!f) return;
    if (f.size > 700 * 1024) { aviso('Arquivo grande demais (máximo 700 KB).', true); input.value = ''; return; }
    const dados = await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(f); });
    lerFormViagem();
    const j = await api({ acao: 'arquivo_enviar', nome: f.name, dados });
    const [lista, i, k] = input.dataset.arquivo.split('.');
    edit[lista][Number(i)][k] = j.id;
    if (!edit[lista][Number(i)].titulo) edit[lista][Number(i)].titulo = f.name;
    aviso('Arquivo enviado. Clique em Salvar viagem.');
    desenharEditor();
  }

  // ── Conversas ──
  async function telaConversas() {
    const lado = conversaAberta ? `<div class="cartao"><h3>${esc(nomeViagem(conversaAberta))}</h3><div id="msgs-painel" class="msgs"><p class="vazio">Carregando…</p></div><form id="form-resp" class="form-msg" style="bottom:0"><input id="resp-texto" placeholder="Responder…" maxlength="2000"><button class="btn">Enviar</button></form></div>` : '';
    $('tela-conversas').innerHTML = `<div class="lado"><div class="cartao"><h2>Conversas</h2>${D.conversas.map(c => `<div class="item"><div><b>${esc(nomeViagem(c.viagem_id))}</b><div class="det">${esc(c.ultima.de === 'equipe' ? 'Você: ' : '')}${esc(String(c.ultima.texto).slice(0, 80))} · ${esc(quando(c.ultima.criado_em))}</div>${c.nao_lidas ? `<span class="chip">${c.nao_lidas} não lida(s)</span>` : ''}</div><button class="btn contorno" data-conversa="${esc(c.viagem_id)}">Abrir</button></div>`).join('') || '<p class="vazio">Nenhuma conversa ainda. Quando um viajante escrever pelo app, aparece aqui.</p>'}</div>${lado}</div>`;
    if (conversaAberta) carregarMsgs(conversaAberta, 'msgs-painel');
  }
  async function carregarMsgs(vid, alvo) {
    const j = await api({ acao: 'msg_listar', viagem_id: vid });
    const el = $(alvo); if (!el) return;
    el.innerHTML = (j.mensagens || []).map(m => `<div class="msg ${m.de === 'equipe' ? 'eu' : ''}">${esc(m.texto)}<small>${esc(quando(m.criado_em))}</small></div>`).join('') || '<p class="vazio">Sem mensagens.</p>';
    el.scrollTop = el.scrollHeight;
    const c = D.conversas.find(x => x.viagem_id === vid); if (c) c.nao_lidas = 0; badge();
  }
  async function responder(vid, input, alvo) {
    const texto = input.value.trim(); if (!texto) return;
    input.value = '';
    await api({ acao: 'msg_enviar', viagem_id: vid, texto, id_local: 'e' + Date.now().toString(36) });
    await carregarMsgs(vid, alvo);
  }

  // ── App do cliente (vê exatamente o que o cliente vê) ──
  let appViagem = '';
  function telaApp() {
    const v = D.viagens.find(x => x.id === appViagem);
    $('tela-appcliente').innerHTML = `<div class="cartao"><label>Escolha a viagem<select id="sel-app"><option value="">—</option>${D.viagens.map(x => `<option value="${esc(x.id)}" ${x.id === appViagem ? 'selected' : ''}>${esc(x.cliente_nome || '')} · ${esc(x.titulo)}</option>`).join('')}</select></label></div>
      ${v ? `<div class="lado"><iframe title="App do cliente" src="${esc(P.linkApp(ORIGEM, v.token))}"></iframe><div class="cartao"><h3>Conversa</h3><div id="msgs-app" class="msgs"></div><form id="form-resp-app" class="form-msg" style="bottom:0"><input id="resp-app" placeholder="Responder…"><button class="btn">Enviar</button></form></div></div>` : ''}`;
    if (v) carregarMsgs(v.id, 'msgs-app');
  }

  // ── Site ──
  const TEXTOS_SITE = [['hero_titulo', 'Título grande do topo'], ['hero_texto', 'Texto abaixo do título'], ['sobre_titulo', 'Título "Sobre"'], ['sobre_texto', 'Texto "Sobre"']];
  function telaSite() {
    const s = D.site; const t = s.textos || {};
    $('tela-site').innerHTML = `<form id="form-site" class="cartao"><h2>Site público</h2><p class="det">Deixe em branco para usar o texto atual do site. <a href="${esc(ORIGEM)}/" target="_blank" rel="noopener">Ver o site</a></p>
      <div class="grade"><label>Nome<input name="nome" value="${esc(s.nome)}"></label><label>Telefone 24h<input name="telefone" value="${esc(s.telefone)}"></label><label>WhatsApp<input name="whatsapp" value="${esc(s.whatsapp)}"></label><label>E-mail<input name="email" type="email" value="${esc(s.email)}"></label><label>Instagram<input name="instagram" value="${esc(s.instagram)}"></label></div>
      ${TEXTOS_SITE.map(([k, r]) => `<label>${r}<textarea name="t_${k}" rows="2">${esc(t[k])}</textarea></label>`).join('')}
      <label>Foto do topo (JPG/PNG/WebP até 500 KB) ${s.fotos && s.fotos.capa ? '<span class="chip ok">tem foto</span>' : ''}<input type="file" id="foto-capa" accept="image/jpeg,image/png,image/webp"></label>
      <button class="btn" type="submit">💾 Salvar site</button></form>`;
  }
  async function salvarSite() {
    const fd = new FormData($('form-site'));
    const c = { nome: fd.get('nome'), telefone: fd.get('telefone'), whatsapp: fd.get('whatsapp'), email: fd.get('email'), instagram: fd.get('instagram'), textos: {}, fotos: { ...(D.site.fotos || {}) } };
    TEXTOS_SITE.forEach(([k]) => { c.textos[k] = fd.get('t_' + k) || ''; });
    const f = $('foto-capa').files[0];
    if (f) { if (f.size > 500 * 1024) { aviso('Foto grande demais (máximo 500 KB).', true); return; } c.fotos.capa = await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(f); }); }
    const r = await api({ acao: 'site_salvar', conteudo: c });
    D.site = r.site; aviso('Site salvo. Já aparece para os visitantes.'); telaSite();
  }

  // ── Conta ──
  function telaConta() {
    $('tela-conta').innerHTML = `<form id="form-senha" class="cartao estreito"><h2>Trocar senha</h2><label>Senha nova (6 ou mais)<input id="senha-nova" type="password" minlength="6" required autocomplete="new-password"></label><button class="btn">Salvar senha</button></form>`;
  }

  // ── Eventos ──
  document.addEventListener('click', async ev => {
    const b = ev.target.closest('button,[data-ir]');
    if (!b) return;
    const d = b.dataset;
    try {
      if (d.ir) { if (d.ir === 'viagens') edit = null; irPara(d.ir); }
      else if (d.editarViagem) abrirEditor(d.editarViagem);
      else if (d.novaViagem !== undefined) abrirEditor(null, d.novaViagem);
      else if (d.voltarViagens !== undefined) { edit = null; telaViagens(); }
      else if (d.por) { lerFormViagem(); edit[d.por].push({}); desenharEditor(); }
      else if (d.tirar) { lerFormViagem(); const [l, i] = d.tirar.split('.'); edit[l].splice(Number(i), 1); desenharEditor(); }
      else if (d.copiarLink !== undefined) { await navigator.clipboard.writeText(P.linkApp(ORIGEM, edit.token)); aviso('Link copiado.'); }
      else if (d.novoLink !== undefined) { if (!confirm('O link antigo para de funcionar. Gerar novo link?')) return; const r = await api({ acao: 'viagem_novo_token', id: edit.id }); edit.token = r.token; await recarregar(); edit = JSON.parse(JSON.stringify(D.viagens.find(x => x.id === r.id))); desenharEditor(); aviso('Novo link gerado. Mande para o cliente.'); }
      else if (d.apagarViagem !== undefined) { if (!confirm('Apagar esta viagem? O link do app para de funcionar.')) return; await api({ acao: 'viagem_apagar', id: edit.id }); edit = null; await recarregar(); aviso('Viagem apagada.'); }
      else if (d.virar) await virarCliente(d.virar, false);
      else if (d.orcar) await virarCliente(d.orcar, true);
      else if (d.editarCli) { const c = D.clientes.find(x => x.id === d.editarCli); const f = $('form-cli'); f.closest('details').open = true; ['id', 'nome', 'whatsapp', 'email', 'doc', 'nasc', 'obs'].forEach(k => { f[k].value = c[k] || ''; }); f.scrollIntoView(); }
      else if (d.conversa) { conversaAberta = d.conversa; telaConversas(); }
    } catch (e) { aviso(e.message, true); }
  });

  document.addEventListener('submit', async ev => {
    ev.preventDefault();
    const f = ev.target;
    try {
      if (f.id === 'form-login') {
        $('login-erro').textContent = '';
        const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ site: SITE, acao: 'login', senha: $('login-senha').value }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { $('login-erro').textContent = j.error || 'Não consegui entrar.'; return; }
        TOKEN = j.token; try { localStorage.setItem('vp_painel_token', TOKEN); } catch (e) { /* ok */ }
        entrar();
      } else if (f.id === 'form-viagem') await salvarViagem();
      else if (f.id === 'form-lead') { const fd = new FormData(f); await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ site: SITE, acao: 'lead_criar', nome: fd.get('nome'), whatsapp: fd.get('whatsapp'), destino: fd.get('destino'), mensagem: fd.get('mensagem') }) }); await recarregar(); aviso('Lead salvo.'); }
      else if (f.id === 'form-cli') { const fd = Object.fromEntries(new FormData(f)); await api({ acao: 'cliente_salvar', cliente: fd }); await recarregar(); aviso('Cliente salvo.'); }
      else if (f.id === 'form-resp') await responder(conversaAberta, $('resp-texto'), 'msgs-painel');
      else if (f.id === 'form-resp-app') await responder(appViagem, $('resp-app'), 'msgs-app');
      else if (f.id === 'form-site') await salvarSite();
      else if (f.id === 'form-senha') { await api({ acao: 'senha_trocar', nova: $('senha-nova').value }); aviso('Senha trocada.'); f.reset(); }
    } catch (e) { aviso(e.message, true); }
  });
  document.addEventListener('change', ev => {
    if (ev.target.dataset && ev.target.dataset.arquivo) enviarArquivo(ev.target).catch(e => aviso(e.message, true));
    if (ev.target.id === 'sel-app') { appViagem = ev.target.value; telaApp(); }
  });
  document.addEventListener('input', ev => { if (ev.target.id === 'busca-cli') { busca = ev.target.value; telaClientes(); const i = $('busca-cli'); i.focus(); i.setSelectionRange(busca.length, busca.length); } });
  $('btn-sair').addEventListener('click', sair);

  // som curto quando chega mensagem nova
  function bip() { try { const c = new (window.AudioContext || window.webkitAudioContext)(); const o = c.createOscillator(); o.frequency.value = 880; o.connect(c.destination); o.start(); o.stop(c.currentTime + 0.15); } catch (e) { /* sem som */ } }
  async function vigiarConversas() {
    if (!TOKEN) return;
    try {
      const antes = D.conversas.reduce((s, c) => s + c.nao_lidas, 0);
      const r = await api({ acao: 'conversas_listar' });
      D.conversas = r.conversas || [];
      const agora = badge();
      if (agora > antes) { bip(); aviso('Nova mensagem de viajante.'); if (aba === 'conversas') telaConversas(); if (aba === 'inicio') telaInicio(); }
    } catch (e) { /* tenta de novo */ }
  }

  async function entrar() {
    document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
    $('menu').classList.remove('oculto'); $('btn-sair').classList.remove('oculto');
    irPara('inicio');
    try { await recarregar(); } catch (e) { aviso(e.message, true); }
  }
  if (TOKEN) entrar();
  setInterval(vigiarConversas, 20000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
