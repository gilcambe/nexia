'use strict';
// Gestão do painel (Financeiro, Despesas, Clientes). Usa apiPost/apiGet/CONFIG_CACHE/UNIDADE_ATUAL do index.html.
(function () {
  const esc = s => SplashPainel.escapeHtml(String(s == null ? '' : s));
  const R = v => SplashPainel.formatarMoeda(Number(v) || 0);
  const dbr = d => (d || '').split('-').reverse().join('/');
  const $ = id => document.getElementById(id);
  const hojeIso = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const FORMAS = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão', transferencia: 'Transferência', outro: 'Outro' };
  const CATEGORIAS = ['Limpeza', 'Água e luz', 'Manutenção', 'Funcionários', 'Produtos da piscina', 'Decoração', 'Marketing', 'Impostos', 'Outros'];
  const unidades = () => (CONFIG_CACHE && CONFIG_CACHE.unidades) || [];
  const nomeUnidade = id => (unidades().find(u => u.id === id) || { nome: id === 'geral' ? 'Geral' : id }).nome;
  const msg = (el, texto, erro) => { el.textContent = texto || ''; el.style.color = erro ? 'var(--erro)' : 'var(--ok)'; };

  function periodo(prefixo) {
    return { de: $(prefixo + '-de').value, ate: $(prefixo + '-ate').value };
  }
  function iniciarPeriodo(prefixo) {
    if ($(prefixo + '-de').value) return;
    const h = hojeIso(); const [a, m] = h.split('-').map(Number);
    $(prefixo + '-de').value = h.slice(0, 8) + '01';
    $(prefixo + '-ate').value = h.slice(0, 8) + String(new Date(a, m, 0).getDate()).padStart(2, '0');
  }

  // ── Financeiro ──
  async function carregarFinanceiro() {
    iniciarPeriodo('fin');
    const { de, ate } = periodo('fin');
    const alvo = $('fin-resumo'); alvo.innerHTML = '<p class="suave">Carregando...</p>';
    const [f, l] = await Promise.all([apiPost({ acao: 'financeiro', de, ate }), apiPost({ acao: 'listar', de, ate })]);
    if (f.status !== 200) { alvo.innerHTML = `<p style="color:var(--erro)">${esc(f.body.error || 'Não consegui carregar.')}</p>`; return; }
    const b = f.body, t = b.total;
    const card = (nome, x) => `<div class="cartao-g"><h4>${esc(nome)}</h4>
      <p>Reservas: <b>${x.reservas}</b></p><p>Faturamento: <b>${R(x.faturamento)}</b></p><p>Recebido: <b>${R(x.recebido)}</b></p>
      <p>A receber: <b>${R(x.a_receber)}</b></p><p>Despesas: <b>${R(x.despesas)}</b></p>
      <p>Lucro (caixa): <b style="color:${x.lucro_caixa < 0 ? 'var(--erro)' : 'var(--ok)'}">${R(x.lucro_caixa)}</b></p></div>`;
    let html = '<div class="grade-g">' + b.por_unidade.map(u => card(u.nome, u)).join('') + card('Total da empresa', t) + '</div>';
    if (b.reservas_sem_valor) html += `<p class="aviso-g">${b.reservas_sem_valor} reserva(s) fechada(s) sem valor combinado. Informe o valor abaixo para o lucro ficar certo.</p>`;
    if (b.meses && b.meses.length) {
      html += '<h4 class="tit-g">Mês a mês</h4><div class="tabela-g">' + b.meses.map(m => `<div><span>${esc(m.mes.split('-').reverse().join('/'))}</span><span>Recebido ${R(m.recebido)}</span><span>Despesas ${R(m.despesas)}</span><b>${R(m.lucro_caixa)}</b></div>`).join('') + '</div>';
    }
    alvo.innerHTML = html;
    const itens = ((l.body && l.body.itens) || []).filter(r => ['confirmado', 'concluido', 'aguardando_sinal'].includes(r.status)).sort((a, b) => (a.data || '').localeCompare(b.data || ''));
    $('fin-reservas').innerHTML = itens.length ? itens.map(linhaReserva).join('') : '<p class="suave">Nenhuma reserva neste período.</p>';
  }

  function linhaReserva(r) {
    const pagos = (r.pagamentos || []).reduce((s, p) => s + (Number(p.valor) || 0), 0);
    const total = Number(r.valor_total) || 0;
    const lista = (r.pagamentos || []).map(p => `<li>${dbr(p.data)} · ${esc(FORMAS[p.forma] || p.forma)} · ${R(p.valor)} <button class="btn pequeno" data-g-remover="${esc(r.id)}|${esc(p.id)}" aria-label="Remover pagamento">remover</button></li>`).join('');
    return `<div class="cartao-g" data-reserva="${esc(r.id)}">
      <h4>${esc(r.nome)} · ${dbr(r.data)}</h4>
      <p class="suave">${esc(nomeUnidade(r.unidade))} · ${esc(r.status)}</p>
      <p>Valor combinado: <b>${total ? R(total) : 'não definido'}</b> · Pago: <b>${R(pagos)}</b> · Falta: <b>${R(Math.max(0, total - pagos))}</b></p>
      <ul class="lista-g">${lista}</ul>
      <div class="linha-g">
        <input type="number" min="0" step="0.01" placeholder="Valor combinado" data-g-total value="${total || ''}">
        <button class="btn pequeno" data-g-salvar-total="${esc(r.id)}">Salvar valor</button>
      </div>
      <div class="linha-g">
        <input type="number" min="0.01" step="0.01" placeholder="Pagou quanto?" data-g-valor>
        <select data-g-forma>${Object.entries(FORMAS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <input type="date" data-g-data value="${hojeIso()}">
        <button class="btn pequeno ouro" data-g-pagar="${esc(r.id)}">Registrar pagamento</button>
      </div></div>`;
  }

  async function clicouReserva(e) {
    const b = e.target.closest('button'); if (!b) return;
    const card = b.closest('[data-reserva]');
    if (b.dataset.gPagar) {
      const valor = Number(card.querySelector('[data-g-valor]').value);
      const r = await apiPost({ acao: 'pagamento-registrar', id: b.dataset.gPagar, valor, forma: card.querySelector('[data-g-forma]').value, data: card.querySelector('[data-g-data]').value });
      if (r.status === 201) carregarFinanceiro(); else alert(r.body.error || 'Não foi possível registrar.');
    } else if (b.dataset.gSalvarTotal) {
      const r = await apiPost({ acao: 'editar', id: b.dataset.gSalvarTotal, campos: { valor_total: Number(card.querySelector('[data-g-total]').value) || 0 } });
      if (r.status === 200) carregarFinanceiro(); else alert(r.body.error || 'Não foi possível salvar.');
    } else if (b.dataset.gRemover) {
      const [id, pid] = b.dataset.gRemover.split('|');
      if (!confirm('Remover este pagamento?')) return;
      const r = await apiPost({ acao: 'pagamento-remover', id, pagamento_id: pid });
      if (r.status === 200) carregarFinanceiro(); else alert(r.body.error || 'Não foi possível remover.');
    }
  }

  // ── Despesas ──
  async function carregarDespesas() {
    iniciarPeriodo('desp');
    const sel = $('desp-unidade');
    if (!sel.dataset.pronto) {
      sel.innerHTML = '<option value="geral">Geral (as duas unidades)</option>' + unidades().map(u => `<option value="${esc(u.id)}">${esc(u.nome)}</option>`).join('');
      $('desp-categoria').innerHTML = CATEGORIAS.map(c => `<option>${esc(c)}</option>`).join('');
      $('desp-data').value = hojeIso(); sel.dataset.pronto = '1';
    }
    const { de, ate } = periodo('desp');
    const r = await apiPost({ acao: 'despesa-listar', de, ate });
    if (r.status !== 200) { $('desp-lista').innerHTML = `<p style="color:var(--erro)">${esc(r.body.error || 'Erro')}</p>`; return; }
    $('desp-total').textContent = 'Total no período: ' + R(r.body.total);
    $('desp-lista').innerHTML = r.body.despesas.length ? r.body.despesas.map(d => `<div class="cartao-g"><h4>${esc(d.descricao || d.categoria)} · ${R(d.valor)}</h4>
      <p class="suave">${dbr(d.data)} · ${esc(d.categoria)} · ${esc(nomeUnidade(d.unidade))}</p>
      <button class="btn pequeno" data-g-excluir="${esc(d.id)}">Excluir</button></div>`).join('') : '<p class="suave">Nenhuma despesa neste período.</p>';
  }
  async function salvarDespesa(e) {
    e.preventDefault();
    const r = await apiPost({ acao: 'despesa-salvar', unidade: $('desp-unidade').value, data: $('desp-data').value, categoria: $('desp-categoria').value, descricao: $('desp-descricao').value, valor: Number($('desp-valor').value) });
    if (r.status === 200) { msg($('desp-msg'), 'Despesa salva.'); $('desp-valor').value = ''; $('desp-descricao').value = ''; carregarDespesas(); }
    else msg($('desp-msg'), r.body.error || 'Não foi possível salvar.', true);
  }
  async function clicouDespesa(e) {
    const b = e.target.closest('[data-g-excluir]'); if (!b || !confirm('Excluir esta despesa?')) return;
    const r = await apiPost({ acao: 'despesa-excluir', id: b.dataset.gExcluir });
    if (r.status === 200) carregarDespesas(); else alert(r.body.error || 'Não foi possível excluir.');
  }

  // ── Clientes ──
  async function carregarClientes() {
    const r = await apiPost({ acao: 'clientes' });
    if (r.status !== 200) { $('cli-lista').innerHTML = `<p style="color:var(--erro)">${esc(r.body.error || 'Erro')}</p>`; return; }
    const f = r.body.fidelidade || {};
    $('cli-regra').textContent = `Cliente fiel: ${f.minimo} aluguéis ou mais. Desconto sugerido: ${f.percentual}% (muda em Ajustes).`;
    const lista = r.body.clientes;
    $('cli-lista').innerHTML = lista.length ? lista.map((c, i) => {
      const zap = String(c.whatsapp || '').replace(/\D/g, '');
      const texto = encodeURIComponent(`Olá, ${c.nome}! Obrigada por alugar o Splash ${c.reservas} vezes. Você ganhou ${c.desconto_sugerido}% de desconto na próxima reserva!`);
      return `<div class="cartao-g"><h4>${i + 1}. ${esc(c.nome)} ${c.fiel ? '⭐' : ''}</h4>
        <p>Aluguéis: <b>${c.reservas}</b> · Gastou: <b>${R(c.total)}</b> · Pagou: <b>${R(c.pago)}</b></p>
        <p class="suave">${c.ultima ? 'Último: ' + dbr(c.ultima) + ' · ' : ''}${esc((c.unidades || []).map(nomeUnidade).join(', '))}${c.cancelados ? ' · cancelou ' + c.cancelados : ''}</p>
        ${c.fiel ? `<p style="color:var(--ok)">Merece ${c.desconto_sugerido}% de desconto.</p>` : ''}
        ${zap.length >= 10 ? `<a class="btn pequeno ouro" target="_blank" rel="noopener" href="https://wa.me/${zap}${c.fiel ? '?text=' + texto : ''}">WhatsApp</a>` : ''}</div>`;
    }).join('') : '<p class="suave">Ainda não há clientes.</p>';
  }

  window.Gestao = {
    abrir(nome) { if (nome === 'financeiro') carregarFinanceiro(); else if (nome === 'despesas') carregarDespesas(); else if (nome === 'clientes') carregarClientes(); },
  };
  document.addEventListener('DOMContentLoaded', () => {
    $('fin-reservas').addEventListener('click', clicouReserva);
    $('fin-atualizar').addEventListener('click', carregarFinanceiro);
    $('desp-form').addEventListener('submit', salvarDespesa);
    $('desp-lista').addEventListener('click', clicouDespesa);
    $('desp-atualizar').addEventListener('click', carregarDespesas);
  });
})();
