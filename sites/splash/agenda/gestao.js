'use strict';
// Gestão do painel: Financeiro (com despesas e comissão), Clientes. Usa apiPost/CONFIG_CACHE do index.html.
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
  const vazio = '<p class="suave">Nada por aqui ainda.</p>';

  function iniciarPeriodo() {
    if ($('fin-de').value) return;
    const h = hojeIso(); const [a, m] = h.split('-').map(Number);
    $('fin-de').value = h.slice(0, 8) + '01';
    $('fin-ate').value = h.slice(0, 8) + String(new Date(a, m, 0).getDate()).padStart(2, '0');
  }
  function preencherSeletores() {
    const fu = $('fin-unidade');
    if (!fu.dataset.pronto) {
      fu.innerHTML = '<option value="total">Total da empresa</option>' + unidades().map(u => `<option value="${esc(u.id)}">${esc(u.nome)}</option>`).join('');
      $('desp-unidade').innerHTML = '<option value="geral">Geral (as duas unidades)</option>' + unidades().map(u => `<option value="${esc(u.id)}">${esc(u.nome)}</option>`).join('');
      $('desp-categoria').innerHTML = CATEGORIAS.map(c => `<option>${esc(c)}</option>`).join('');
      $('desp-data').value = hojeIso(); $('com-data').value = hojeIso();
      fu.dataset.pronto = '1';
    }
  }

  // ── Financeiro ──
  async function carregarFinanceiro() {
    preencherSeletores(); iniciarPeriodo();
    const de = $('fin-de').value, ate = $('fin-ate').value, un = $('fin-unidade').value;
    $('desp-de').value = de; $('desp-ate').value = ate;
    const alvo = $('fin-resumo'); alvo.innerHTML = '<p class="suave">Carregando...</p>';
    const [f, l] = await Promise.all([apiPost({ acao: 'financeiro', de, ate }), apiPost({ acao: 'listar', de, ate })]);
    if (f.status !== 200) { alvo.innerHTML = `<p style="color:var(--erro)">${esc(f.body.error || 'Não consegui carregar.')}</p>`; return; }
    const b = f.body;
    const dados = un === 'total' ? b.total : (b.por_unidade.find(u => u.id === un) || b.total);
    const terceira = un !== 'total' && dados.terceiro;
    const comTotal = un === 'total' && b.por_unidade.some(u => u.terceiro);
    const linha = (rot, val, cor) => `<div class="fin-l"><span>${rot}</span><b${cor ? ` style="color:${cor}"` : ''}>${val}</b></div>`;
    let html = '<div class="cartao-g">';
    if (terceira) {
      html += `<h4>${esc(dados.nome)}: unidade de outro dono</h4><p class="suave">Aqui você acompanha só a sua comissão (${dados.comissao ? (dados.comissao.tipo === 'valor' ? R(dados.comissao.valor) + ' por locação' : dados.comissao.valor + '% do valor') : 'defina em Ajustes'}).</p>` +
        linha('Locações no período', dados.reservas) + linha('Comissão que você deve receber', R(dados.comissao_devida)) +
        linha('Comissão já recebida', R(dados.comissao_recebida), 'var(--ok)') + linha('Comissão ainda a receber', R(dados.comissao_a_receber), dados.comissao_a_receber > 0 ? 'var(--alerta)' : '') +
        linha('Despesas desta unidade (suas)', R(dados.despesas)) + linha('Seu lucro', R(dados.meu_lucro), dados.meu_lucro < 0 ? 'var(--erro)' : 'var(--ok)');
    } else {
      html += `<h4>${esc(un === 'total' ? 'Total da empresa' : dados.nome)}</h4>` +
        linha('Locações', dados.reservas) + linha('Valor das locações', R(dados.faturamento)) + linha('Já recebido', R(dados.recebido), 'var(--ok)') + linha('A receber dos clientes', R(dados.a_receber), dados.a_receber > 0 ? 'var(--alerta)' : '') +
        (comTotal ? linha('Comissão recebida (outra unidade)', R(dados.comissao_recebida)) + linha('Comissão ainda a receber', R(dados.comissao_a_receber), dados.comissao_a_receber > 0 ? 'var(--alerta)' : '') : '') +
        linha('Despesas', R(dados.despesas)) + linha(un === 'total' && comTotal ? 'Seu lucro (locações recebidas + comissão - despesas)' : 'Lucro (recebido - despesas)', R(un === 'total' ? dados.meu_lucro : dados.lucro_caixa), (un === 'total' ? dados.meu_lucro : dados.lucro_caixa) < 0 ? 'var(--erro)' : 'var(--ok)');
    }
    html += '</div>';
    if (b.reservas_sem_valor) html += `<p class="aviso-g">${b.reservas_sem_valor} reserva(s) fechada(s) sem valor combinado. Abra a reserva e informe o valor para o lucro ficar certo.</p>`;
    if (b.meses && b.meses.length > 1) html += '<details><summary class="suave">Mês a mês</summary><div class="tabela-g">' + b.meses.map(m => `<div><span>${esc(m.mes.split('-').reverse().join('/'))}</span><span>Recebido ${R(m.recebido)}</span><span>Despesas ${R(m.despesas)}</span><b>${R(m.lucro_caixa)}</b></div>`).join('') + '</div></details>';
    alvo.innerHTML = html;

    $('com-bloco').style.display = terceira ? 'block' : 'none';
    $('desp-unidade').value = un === 'total' ? 'geral' : un;
    const itens = ((l.body && l.body.itens) || []).filter(r => ['confirmado', 'concluido', 'aguardando_sinal'].includes(r.status) && (un === 'total' || r.unidade === un)).sort((a, c) => (a.data || '').localeCompare(c.data || ''));
    $('fin-reservas').innerHTML = itens.length ? itens.map(linhaReserva).join('') : '<p class="suave">Nenhuma reserva neste período.</p>';
    carregarDespesas(de, ate, un, terceira);
  }

  function linhaReserva(r) {
    const pagos = (r.pagamentos || []).reduce((s, p) => s + (Number(p.valor) || 0), 0);
    const total = Number(r.valor_total) || 0;
    const lista = (r.pagamentos || []).map(p => `<li>${dbr(p.data)} · ${esc(FORMAS[p.forma] || p.forma)} · ${R(p.valor)} <button type="button" class="btn pequeno" data-g-remover="${esc(r.id)}|${esc(p.id)}">remover</button></li>`).join('');
    return `<div class="cartao-g" data-reserva="${esc(r.id)}">
      <h4>${esc(r.nome)} · ${dbr(r.data)}</h4>
      <p class="suave">${esc(nomeUnidade(r.unidade))}</p>
      <p>Valor: <b>${total ? R(total) : 'não definido'}</b> · Pago: <b>${R(pagos)}</b> · Falta: <b>${R(Math.max(0, total - pagos))}</b></p>
      <ul class="lista-g">${lista}</ul>
      <div class="linha-g"><input type="number" min="0" step="0.01" placeholder="Valor combinado" data-g-total value="${total || ''}"><button type="button" class="btn pequeno" data-g-salvar-total="${esc(r.id)}">Salvar valor</button></div>
      <div class="linha-g"><input type="number" min="0.01" step="0.01" placeholder="Pagou quanto?" data-g-valor><select data-g-forma>${Object.entries(FORMAS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><input type="date" data-g-data value="${hojeIso()}"><button type="button" class="btn pequeno ouro" data-g-pagar="${esc(r.id)}">Registrar pagamento</button></div></div>`;
  }

  async function clicouReserva(e) {
    const b = e.target.closest('button'); if (!b) return;
    const card = b.closest('[data-reserva]');
    if (b.dataset.gPagar) {
      const r = await apiPost({ acao: 'pagamento-registrar', id: b.dataset.gPagar, valor: Number(card.querySelector('[data-g-valor]').value), forma: card.querySelector('[data-g-forma]').value, data: card.querySelector('[data-g-data]').value });
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

  // ── Despesas e comissão recebida (mesma coleção, tipos diferentes) ──
  async function carregarDespesas(de, ate, un, terceira) {
    const r = await apiPost({ acao: 'despesa-listar', de, ate });
    if (r.status !== 200) { $('desp-lista').innerHTML = `<p style="color:var(--erro)">${esc(r.body.error || 'Erro')}</p>`; return; }
    const todas = r.body.despesas.filter(d => un === 'total' || d.unidade === un);
    const desp = todas.filter(d => d.tipo !== 'comissao'), com = todas.filter(d => d.tipo === 'comissao');
    $('desp-total').textContent = 'Total de despesas no período: ' + R(desp.reduce((s, d) => s + (Number(d.valor) || 0), 0));
    const card = d => `<div class="cartao-g"><h4>${esc(d.descricao || d.categoria)} · ${R(d.valor)}</h4><p class="suave">${dbr(d.data)} · ${esc(d.categoria)} · ${esc(nomeUnidade(d.unidade))}</p><button type="button" class="btn pequeno" data-g-excluir="${esc(d.id)}">Excluir</button></div>`;
    $('desp-lista').innerHTML = desp.length ? desp.map(card).join('') : '<p class="suave">Nenhuma despesa neste período.</p>';
    $('com-lista').innerHTML = com.length ? com.map(d => `<div class="cartao-g"><h4>Comissão ${R(d.valor)}</h4><p class="suave">${dbr(d.data)}${d.descricao ? ' · ' + esc(d.descricao) : ''}</p><button type="button" class="btn pequeno" data-g-excluir="${esc(d.id)}">Excluir</button></div>`).join('') : '<p class="suave">Nenhum recebimento de comissão neste período.</p>';
  }
  async function salvarDespesa(e) {
    e.preventDefault();
    const r = await apiPost({ acao: 'despesa-salvar', unidade: $('desp-unidade').value, data: $('desp-data').value, categoria: $('desp-categoria').value, descricao: $('desp-descricao').value, valor: Number($('desp-valor').value) });
    if (r.status === 200) { msg($('desp-msg'), 'Despesa salva.'); $('desp-valor').value = ''; $('desp-descricao').value = ''; carregarFinanceiro(); }
    else msg($('desp-msg'), r.body.error || 'Não foi possível salvar.', true);
  }
  async function salvarComissao(e) {
    e.preventDefault();
    const r = await apiPost({ acao: 'despesa-salvar', tipo: 'comissao', unidade: $('fin-unidade').value, data: $('com-data').value, categoria: 'Comissão', descricao: $('com-obs').value, valor: Number($('com-valor').value) });
    if (r.status === 200) { msg($('com-msg'), 'Comissão registrada.'); $('com-valor').value = ''; $('com-obs').value = ''; carregarFinanceiro(); }
    else msg($('com-msg'), r.body.error || 'Não foi possível salvar.', true);
  }
  async function clicouExcluir(e) {
    const b = e.target.closest('[data-g-excluir]'); if (!b || !confirm('Excluir este lançamento?')) return;
    const r = await apiPost({ acao: 'despesa-excluir', id: b.dataset.gExcluir });
    if (r.status === 200) carregarFinanceiro(); else alert(r.body.error || 'Não foi possível excluir.');
  }

  // ── Clientes (por unidade) ──
  async function carregarClientes() {
    const sel = $('cli-unidade');
    if (!sel.dataset.pronto) {
      sel.innerHTML = unidades().map(u => `<option value="${esc(u.id)}">${esc(u.nome)}</option>`).join('');
      if (typeof UNIDADE_ATUAL !== 'undefined') sel.value = UNIDADE_ATUAL;
      sel.dataset.pronto = '1';
    }
    const r = await apiPost({ acao: 'clientes', unidade: sel.value });
    if (r.status !== 200) { $('cli-lista').innerHTML = `<p style="color:var(--erro)">${esc(r.body.error || 'Erro')}</p>`; return; }
    const f = r.body.fidelidade || {};
    $('cli-regra').textContent = `Cliente fiel: ${f.minimo} aluguéis ou mais nesta unidade. Desconto sugerido: ${f.percentual}% (muda em Ajustes).`;
    const lista = r.body.clientes;
    $('cli-lista').innerHTML = lista.length ? lista.map((c, i) => {
      const zap = String(c.whatsapp || '').replace(/\D/g, '');
      const texto = encodeURIComponent(`Olá, ${c.nome}! Obrigada por alugar o Splash ${c.reservas} vezes. Você ganhou ${c.desconto_sugerido}% de desconto na próxima reserva!`);
      return `<div class="cartao-g"><h4>${i + 1}. ${esc(c.nome)} ${c.fiel ? '⭐' : ''}</h4>
        <p>Aluguéis: <b>${c.reservas}</b> · Gastou: <b>${R(c.total)}</b> · Pagou: <b>${R(c.pago)}</b></p>
        <p class="suave">${c.ultima ? 'Último: ' + dbr(c.ultima) + ' · ' : ''}${esc(c.whatsapp || '')}${c.cancelados ? ' · cancelou ' + c.cancelados : ''}</p>
        ${c.fiel ? `<p style="color:var(--ok)">Merece ${c.desconto_sugerido}% de desconto.</p>` : ''}
        ${zap.length >= 10 ? `<a class="btn pequeno ouro" target="_blank" rel="noopener" href="https://wa.me/${zap}${c.fiel ? '?text=' + texto : ''}">WhatsApp</a>` : ''}</div>`;
    }).join('') : '<p class="suave">Ainda não há clientes nesta unidade.</p>';
  }

  window.Gestao = {
    abrir(nome) { if (nome === 'financeiro') carregarFinanceiro(); else if (nome === 'clientes') carregarClientes(); },
  };
  document.addEventListener('DOMContentLoaded', () => {
    $('fin-reservas').addEventListener('click', clicouReserva);
    $('fin-atualizar').addEventListener('click', carregarFinanceiro);
    $('desp-form').addEventListener('submit', salvarDespesa);
    $('com-form').addEventListener('submit', salvarComissao);
    $('desp-lista').addEventListener('click', clicouExcluir);
    $('com-lista').addEventListener('click', clicouExcluir);
  });
})();
