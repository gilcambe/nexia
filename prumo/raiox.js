'use strict';
// Redesign (fase 4, começo): Raio-X = cadastro aos poucos. Um cartão por vez, do essencial (salário, saldo, contas fixas)
// ao completo. Cada cartão diz por que importa e tem 2 caminhos: mandar um print (o app lê) ou preencher na tela.
// "Pular" esconde o cartão por 7 dias neste aparelho.
(function () {
  const MB = window.MB;
  const POR_QUE = {
    salario: ['💼', 'Sem o salário eu não sei quanto ainda vai cair no mês.', 'Mande o holerite (foto ou PDF) ou digite o salário base.'],
    contas: ['🏦', 'O saldo das contas é o "Tenho". Sem ele não dá para calcular o "Pode gastar".', 'Mande um print do saldo do app do banco.'],
    fixas: ['🧾', 'Aluguel, luz, internet, escola… Sem elas o "Pode gastar" fica estimado.', 'Cadastre as contas fixas do mês.'],
    cartoes: ['💳', 'A fatura do cartão entra no "A pagar".', 'Mande o print ou PDF da fatura.'],
    dividas: ['📉', 'Dívidas e parcelas pesam no score. Se não tem nenhuma, diga que não tem.', 'Cadastre ou marque "não tenho dívidas".'],
    investimentos: ['📈', 'Investimentos contam no pilar Futuro do score.', 'Mande o print da corretora ou digite.'],
    gastos: ['🛒', 'Os gastos do mês mostram para onde vai o dinheiro.', 'Mande uma fatura ou extrato, ou digite um gasto.'],
    aposentadoria: ['🧓', 'O extrato do INSS (CNIS) e o FGTS mostram seu futuro.', 'Mande o PDF do Meu INSS e o print do FGTS.'],
  };
  const chave = (id) => 'kf-raiox-pular-' + id;
  const pulado = (id) => { try { const t = Number(localStorage.getItem(chave(id)) || 0); return t && Date.now() - t < 7 * 86400000; } catch { return false; } };

  function abrir(painel) {
    const faltam = ((painel && painel.confianca && painel.confianca.faltam) || []).slice().sort((a, b) => a.nivel - b.nivel);
    let lista = faltam.filter((x) => !pulado(x.id));
    if (!lista.length) lista = faltam; // tudo pulado: mostra de novo
    if (!lista.length) return;
    let i = 0;
    const d = document.createElement('dialog');
    document.body.appendChild(d);
    let feitos = 0;
    const proximo = () => { i += 1; if (i >= lista.length) { d.close(); if (feitos) MB.abrirAba('inicio'); } else desenhar(); };
    // Essencial em menos de 3 minutos: salário, saldo, contas fixas e dívidas se resolvem AQUI, sem sair da janela.
    const RAPIDO = {
      salario: '<label for="rx-v">Salário bruto (R$, do holerite)</label><input id="rx-v" inputmode="decimal" placeholder="Ex.: 5.000,00">',
      contas: '<label for="rx-n">Banco da conta principal</label><input id="rx-n" placeholder="Ex.: Itaú" maxlength="40"><label for="rx-v">Saldo hoje (R$)</label><input id="rx-v" inputmode="decimal" placeholder="Ex.: 1.250,00">',
      fixas: '<label for="rx-n">Conta fixa</label><input id="rx-n" placeholder="Ex.: Aluguel, luz, internet" maxlength="40"><div class="linha"><div style="flex:1"><label for="rx-v">Valor (R$)</label><input id="rx-v" inputmode="decimal"></div><div style="flex:1"><label for="rx-d">Dia que vence</label><input id="rx-d" inputmode="numeric" placeholder="1 a 31"></div></div>',
      dividas: '',
    };
    const num = (s) => Number(String(s || '').replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'));
    const gravar = async (x) => {
      const v = d.querySelector('#rx-v'); const n = d.querySelector('#rx-n'); const dia = d.querySelector('#rx-d');
      const valor = v ? num(v.value) : 0;
      if (x.id !== 'dividas' && !(valor >= 0 && v.value.trim())) throw new Error('Digite o valor.');
      if (x.id === 'salario') await MB.api('salario_config', { salario_base: valor });
      if (x.id === 'contas') await MB.api('conta_salvar', { nome: (n && n.value.trim()) || 'Conta principal', tipo: 'corrente', saldo: valor });
      if (x.id === 'fixas') {
        if (!(n && n.value.trim())) throw new Error('Diga o nome da conta.');
        const r = await MB.api('orcamento_resumo', {}, { silencioso: true });
        const o = (r && r.orcamento) || { fixas: [], guardar: [], limites: {}, renda_extra: 0 };
        const d1 = Number(dia && dia.value);
        await MB.api('orcamento_salvar', { ...o, fixas: [...(o.fixas || []), { nome: n.value.trim(), valor, dia: d1 >= 1 && d1 <= 31 ? d1 : null }] });
      }
      feitos += 1;
    };
    const desenhar = () => {
      const x = lista[i]; const [ic, porque, como] = POR_QUE[x.id] || ['📌', '', ''];
      const rapido = Object.prototype.hasOwnProperty.call(RAPIDO, x.id);
      d.innerHTML = `<div class="fraco">${x.nivel === 1 ? 'Essencial' : 'Completo'} · ${i + 1} de ${lista.length}</div>
        <h3 style="margin:6px 0 4px">${ic} ${x.nome}</h3><p style="margin:0 0 6px">${porque}</p><p class="fraco" style="margin:0 0 10px">${como}</p>
        ${rapido && x.id !== 'dividas' ? `${RAPIDO[x.id]}<button class="btn" type="button" data-r="ok" style="margin-top:12px">Salvar e continuar</button>${x.id === 'fixas' ? '<button class="btn sec" type="button" data-r="mais">Salvar e cadastrar outra</button>' : ''}<div id="rx-msg"></div><div class="fraco" style="margin:12px 0 6px;text-align:center">ou</div>` : ''}
        ${x.id === 'dividas' ? '<button class="btn" type="button" data-r="nenhuma">Não tenho dívidas</button><button class="btn sec" type="button" data-r="tela">Tenho: cadastrar</button>' : `<button class="btn ${rapido ? 'sec' : ''}" type="button" data-r="print">📷 Mandar print ou PDF</button>${rapido ? '' : '<button class="btn sec" type="button" data-r="tela">✍️ Preencher na tela</button>'}`}
        <div class="linha" style="margin-top:10px"><button class="btn sec mini" type="button" data-r="pular" style="margin-top:0">Pular por 7 dias</button><button class="btn sec mini" type="button" data-r="fechar" style="margin-top:0">Fechar</button></div>`;
      const on = (r, f) => { const b = d.querySelector(`[data-r=${r}]`); if (b) b.onclick = f; };
      const salvar = async (depois) => { const m = d.querySelector('#rx-msg'); try { await gravar(x); depois(); } catch (e) { if (m) m.innerHTML = `<div class="aviso-c" style="margin-top:8px">${(e && e.message) || 'Não consegui salvar.'}</div>`; } };
      on('ok', () => salvar(proximo));
      on('mais', () => salvar(desenhar));
      on('nenhuma', async () => { try { await MB.api('divida_nenhuma', { sem: true }); feitos += 1; proximo(); } catch { /* erro já mostrado */ } });
      on('print', () => { d.close(); MB.abrirLancar(); });
      on('tela', () => { d.close(); MB.abrirAba(x.aba); });
      on('pular', () => { try { localStorage.setItem(chave(x.id), String(Date.now())); } catch { /* sem guardar */ } proximo(); });
      on('fechar', () => { d.close(); if (feitos) MB.abrirAba('inicio'); });
      const f1 = d.querySelector('input'); if (f1) setTimeout(() => f1.focus(), 50);
    };
    d.addEventListener('close', () => d.remove());
    desenhar();
    d.showModal();
  }
  MB.raiox = { abrir };
})();
