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
    const desenhar = () => {
      const x = lista[i]; const [ic, porque, como] = POR_QUE[x.id] || ['📌', '', ''];
      d.innerHTML = `<div class="fraco">${x.nivel === 1 ? 'Essencial' : 'Completo'} · ${i + 1} de ${lista.length}</div>
        <h3 style="margin:6px 0 4px">${ic} ${x.nome}</h3><p style="margin:0 0 6px">${porque}</p><p class="fraco" style="margin:0 0 14px">${como}</p>
        <button class="btn" type="button" data-r="print">📷 Mandar print ou PDF</button>
        <button class="btn sec" type="button" data-r="tela">✍️ Preencher na tela</button>
        <div class="linha" style="margin-top:10px"><button class="btn sec mini" type="button" data-r="pular" style="margin-top:0">Pular por 7 dias</button><button class="btn sec mini" type="button" data-r="fechar" style="margin-top:0">Fechar</button></div>`;
      d.querySelector('[data-r=print]').onclick = () => { d.close(); MB.abrirLancar(); };
      d.querySelector('[data-r=tela]').onclick = () => { d.close(); MB.abrirAba(x.aba); };
      d.querySelector('[data-r=pular]').onclick = () => { try { localStorage.setItem(chave(x.id), String(Date.now())); } catch { /* sem guardar */ } i += 1; if (i >= lista.length) d.close(); else desenhar(); };
      d.querySelector('[data-r=fechar]').onclick = () => d.close();
    };
    d.addEventListener('close', () => d.remove());
    desenhar();
    d.showModal();
  }
  MB.raiox = { abrir };
})();
