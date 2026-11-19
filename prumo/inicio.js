'use strict';
// Kernex Finance: tela Início (redesign, plano do dono). Responde em 5 segundos e sem rolar: score de saúde (0-100),
// Tenho / Recebi / A pagar e "Pode gastar hoje". Todos os números vêm de UMA fonte no servidor ('painel_resumo').
// Zero fica cinza (nunca vermelho); faltou dado = selo "estimado" ou "sem dados". Cada número tem "como calculamos?".
(function () {
  const MB = window.MB;
  const carregarUi = () => MB.ui ? Promise.resolve(MB.ui) : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = '/prumo/ui.js'; s.onload = () => ok(MB.ui); s.onerror = falha; document.body.appendChild(s); });
  const FAIXA = { critico: ['Crítico', '#FF5A5F'], atencao: ['Atenção', '#F5A623'], tranquilo: ['Tranquilo', '#5B8DFF'], excelente: ['Excelente', '#2ECC71'], sem_dados: ['Sem dados', '#5D6886'] };
  const COMO = {
    hoje: ['Pode gastar hoje', 'Tenho + Falta receber − A pagar = quanto dá para gastar no mês. Dividimos pelos dias que faltam (contando hoje).'],
    tenho: ['Tenho', 'Soma do saldo das suas contas e do dinheiro. Não entra investimento longo nem FGTS.'],
    recebi: ['Recebi no mês', 'Entradas deste mês que já caíram: salário, adiantamento, 13º e o que você lançou.'],
    pagar: ['A pagar', 'Contas e parcelas com data até o fim do mês + faturas dos cartões + contas fixas que ainda vão vencer.'],
    falta: ['Falta receber', 'O que ainda vai cair no mês. Ex.: salário líquido previsto − adiantamento que já caiu.'],
  };
  const st = document.createElement('style');
  st.textContent = `.ki{display:grid;gap:12px}.ki .card{margin:0;border-radius:16px;padding:16px}
.ki-topo{display:flex;justify-content:space-between;align-items:baseline;gap:8px}.ki-topo h2{margin:0;font-size:18px;font-weight:600}.ki-topo span{color:var(--fraco);font-size:12px}
.ki-hero{display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:center;background:linear-gradient(140deg,#17255A 0%,#121B33 65%)!important}
.ki-anel{position:relative;width:104px;height:104px;cursor:pointer;background:none;border:0;padding:0;color:inherit}
.ki-anel svg{width:104px;height:104px;transform:rotate(-90deg)}.ki-anel .n{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.ki-anel b{font-size:32px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums}.ki-anel small{font-size:11px;color:var(--fraco);margin-top:4px}
.ki-rot{font-size:12px;color:var(--fraco)}.ki-hoje{font-size:32px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums;line-height:1.15;margin:2px 0}
.ki-selo{display:inline-block;font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;border:1px solid currentColor;vertical-align:middle;margin-left:4px}
.ki-selo.est{color:#F5A623}.ki-selo.sd{color:#8B97B8}.ki-selo.ok{color:#2ECC71}
.ki-como{background:none;border:0;color:var(--verde2);font:inherit;font-size:12px;padding:6px 0;cursor:pointer;min-height:32px}
.ki-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.ki-kpis .card{padding:12px;cursor:pointer;text-align:left;font:inherit;color:inherit}
.ki-kpis .v{font-size:clamp(13px,3.7vw,18px);font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;letter-spacing:-.02em}.ki-kpis .r{font-size:12px;color:var(--fraco)}
.ki-zero{color:#5D6886!important}.ki-in{color:#2ECC71}.ki-out{color:#F5A623}.ki-neg{color:#FF5A5F}
.ki-bar{height:8px;border-radius:8px;background:#0B1530;overflow:hidden;margin:8px 0 4px}.ki-bar i{display:block;height:100%;border-radius:8px}
.ki-lin{display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:13px}.ki-lin .fraco{font-size:12px}
.ki-alerta{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--borda);font-size:14px;cursor:pointer}.ki-alerta:last-child{border:0;padding-bottom:0}
.ki-alerta .p{width:8px;height:8px;border-radius:50%;margin-top:6px;flex:none}
.ki-perg{display:flex;gap:8px}.ki-perg input{flex:1;min-height:44px;border-radius:12px;border:1px solid var(--borda);background:#0B1530;color:var(--texto);padding:0 12px;font-size:15px}
.ki-perg button{min-height:44px;border-radius:12px;border:0;background:var(--verde);color:#fff;padding:0 14px;font-weight:600}
.ki-ult{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--borda);font-size:14px}.ki-ult:last-child{border:0}
.ki-ult .d{color:var(--fraco);font-size:12px}.ki-ult .val{font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.ki-vazio{text-align:center;padding:8px 0}.ki-vazio p{color:var(--fraco);margin:0 0 10px}
.ki-pil{padding:10px 0;border-bottom:1px solid var(--borda)}.ki-pil:last-child{border:0}
@media(min-width:900px){.ki{grid-template-columns:1.2fr 1fr;align-items:start}.ki>.ki-larga{grid-column:1/-1}}`;
  if (document.head) document.head.appendChild(st);

  MB.telas.inicio = async (el) => {
    const { brl, esc, aba } = await carregarUi();
    aba('inicio');
    const p = await MB.api('painel_resumo');
    const k = p.kpis || {}; const sc = p.score || {}; const cf = p.confianca || { pct: 0, faltam: [] };
    const [nomeF, corF] = FAIXA[sc.faixa] || FAIXA.sem_dados;
    const nome = (MB.usuario && MB.usuario() && MB.usuario().displayName || '').split(' ')[0];
    const hora = new Date().getHours();
    const saud = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
    const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const mesNome = MESES[Number(String(p.mes).slice(5, 7)) - 1] || '';
    const ultimoDia = new Date(Number(p.mes.slice(0, 4)), Number(p.mes.slice(5, 7)), 0).getDate();
    const selo = (estado) => estado === 'estimado' ? '<span class="ki-selo est">estimado</span>' : estado === 'sem_dados' ? '<span class="ki-selo sd">sem dados</span>' : '';
    const val = (v, cls) => (v == null ? '<span class="ki-zero">—</span>' : Number(v) === 0 ? `<span class="ki-zero">${brl(0)}</span>` : `<span class="${cls}">${brl(v)}</span>`);
    const total = sc.total;
    const C = 2 * Math.PI * 46; const fr = total == null ? 0 : Math.max(0, Math.min(100, total)) / 100;
    const variacao = sc.variacao == null ? '' : `<div class="ki-rot">${sc.variacao >= 0 ? '▲ +' : '▼ '}${sc.variacao} desde o mês passado</div>`;
    const hojeTxt = k.posso_hoje == null ? '—' : brl(k.posso_hoje);
    const corHoje = k.alerta ? 'ki-neg' : k.posso_hoje > 0 ? '' : 'ki-zero';
    const barraMes = p.barra_mes;
    const corBarra = (pct) => (pct >= 100 ? '#FF5A5F' : pct >= 80 ? '#F5A623' : '#2F6BFF');
    const NIV = { risco: '#FF5A5F', atencao: '#F5A623', info: '#5B8DFF' };
    const credito = p.credito ? `<div class="ki-rot" style="margin-top:6px">Score de crédito: <b style="color:var(--texto)">${esc(p.credito.score)}</b> ${esc(p.credito.biro || '')}${p.credito.data ? ' · ' + esc(String(p.credito.data).slice(8, 10) + '/' + String(p.credito.data).slice(5, 7)) : ''}</div>` : '';

    el.innerHTML = `<div class="ki">
      <div class="ki-topo ki-larga"><h2>${saud}${nome ? ', ' + esc(nome) : ''}</h2><span>${p.dias_restantes} dia(s) para acabar ${esc(mesNome)}</span></div>
      <section class="card ki-hero ki-larga" aria-label="Resumo">
        <button class="ki-anel" id="ki-por" type="button" aria-label="Score de saúde ${total == null ? 'sem dados' : total}. Ver por quê">
          <svg viewBox="0 0 104 104" aria-hidden="true"><circle cx="52" cy="52" r="46" fill="none" stroke="#0B1530" stroke-width="10"/>${total == null ? "" : `<circle cx="52" cy="52" r="46" fill="none" stroke="${corF}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(C * fr).toFixed(1)} ${C.toFixed(1)}"/>`}</svg>
          <span class="n"><b style="color:${total == null ? '#5D6886' : 'var(--texto)'}">${total == null ? '–' : total}</b><small>${nomeF}</small></span>
        </button>
        <div>
          <div class="ki-rot">Pode gastar hoje ${selo(k.estado)}</div>
          <div class="ki-hoje ${corHoje}">${hojeTxt}</div>
          <div class="ki-rot">${k.posso_mes == null ? 'Cadastre o saldo das suas contas para eu calcular.' : k.alerta ? `Faltam ${brl(Math.abs(k.posso_mes))} para fechar o mês.` : `${brl(k.posso_mes)} até dia ${ultimoDia}`}${k.estado === 'estimado' ? ' · faltam despesas fixas' : ''}</div>
          ${total == null ? '<div class="ki-rot">O score aparece quando houver dados de 3 áreas (toque no anel).</div>' : ''}${variacao}${sc.estimado && total != null ? '<div class="ki-rot">Score estimado: faltam dados de alguns pilares.</div>' : ''}${credito}
          <button class="ki-como" type="button" data-como="hoje">Como calculamos?</button>
        </div>
      </section>
      <div class="ki-kpis ki-larga">
        <button class="card" type="button" data-como="tenho"><div class="r">Tenho</div><div class="v">${val(k.tenho, '')}</div></button>
        <button class="card" type="button" data-como="recebi"><div class="r">Recebi</div><div class="v">${val(k.recebi, 'ki-in')}</div></button>
        <button class="card" type="button" data-como="pagar"><div class="r">A pagar</div><div class="v">${val(k.a_pagar, 'ki-out')}</div></button>
      </div>
      <div style="display:grid;gap:12px">
        <section class="card" aria-label="Mês">
          <div class="ki-lin"><b>Gasto do mês</b><span class="fraco">${barraMes ? barraMes.pct + '% da renda' : ''}</span></div>
          ${barraMes ? `<div class="ki-bar"><i style="width:${barraMes.pct}%;background:${corBarra(barraMes.pct)}"></i></div><div class="ki-lin"><span>${brl(barraMes.gasto)}</span><span class="fraco">de ${brl(barraMes.renda)}</span></div>`
            : '<div class="ki-rot" style="margin-top:6px">Mande seu holerite ou informe o salário para ver quanto do mês já foi.</div>'}
          ${k.falta_receber > 0 ? `<div class="ki-lin" style="margin-top:8px"><span>Falta receber até dia ${ultimoDia}</span><b class="ki-in">${brl(k.falta_receber)}</b></div>` : ''}
        </section>
        <section class="card" aria-label="Confiança dos dados">
          <div class="ki-lin"><b>Seus dados</b><span class="fraco">${cf.pct}% completo</span></div>
          <div class="ki-bar"><i style="width:${cf.pct}%;background:#2F6BFF"></i></div>
          ${cf.faltam.length ? `<div class="ki-rot">Falta: ${cf.faltam.slice(0, 3).map((x) => esc(x.nome)).join(', ')}${cf.faltam.length > 3 ? '…' : ''}</div><button class="btn" id="ki-raiox" type="button" style="margin-top:10px">Completar meus dados</button>` : '<div class="ki-rot">✅ Tudo cadastrado. Os números estão completos.</div>'}
        </section>
      </div>
      <div style="display:grid;gap:12px">
        ${p.alertas && p.alertas.length ? `<section class="card" aria-label="Atenção"><b>Atenção</b>${p.alertas.map((a) => `<div class="ki-alerta" data-aba="${esc(a.aba)}"><span class="p" style="background:${NIV[a.nivel] || '#5B8DFF'}"></span><span>${esc(a.texto)}</span></div>`).join('')}</section>` : ''}
        <section class="card" aria-label="Pergunte"><b>Pergunte</b><form class="ki-perg" id="ki-perg" style="margin-top:8px"><input name="q" placeholder="Posso comprar um celular de R$ 1.500?" aria-label="Pergunta"><button type="submit">Perguntar</button></form></section>
        <section class="card" aria-label="Últimos lançamentos"><div class="ki-lin"><b>Últimos lançamentos</b>${p.ultimos.length ? '<button class="ki-como" id="ki-todos" type="button">Ver todos</button>' : ''}</div>
          ${p.ultimos.length ? p.ultimos.map((l) => `<div class="ki-ult"><span>${esc(l.descricao)}<br><span class="d">${esc(String(l.data).slice(8, 10) + '/' + String(l.data).slice(5, 7))}</span></span><span class="val ${l.tipo === 'receita' ? 'ki-in' : ''}">${l.tipo === 'receita' ? '+' : '−'} ${brl(l.valor)}</span></div>`).join('')
            : '<div class="ki-vazio"><p>Nenhum lançamento ainda.</p><button class="btn" id="ki-primeiro" type="button">Mande sua primeira fatura</button></div>'}
        </section>
      </div>
    </div>`;

    const dialogo = (titulo, corpo) => {
      const d = document.createElement('dialog');
      d.innerHTML = `<h3 style="margin-top:0">${titulo}</h3>${corpo}<button class="btn" type="button" style="margin-top:14px">Entendi</button>`;
      document.body.appendChild(d); d.showModal();
      d.addEventListener('close', () => d.remove());
      d.querySelector('button.btn').onclick = () => d.close();
      return d;
    };
    el.querySelectorAll('[data-como]').forEach((b) => { b.onclick = () => { const [t, x] = COMO[b.dataset.como]; dialogo(esc(t), `<p>${esc(x)}</p><p class="fraco">Origem: ${esc((k.origem || {})[b.dataset.como === 'pagar' ? 'a_pagar' : b.dataset.como === 'tenho' ? 'tenho' : 'renda'] || '')}</p>`); }; });
    el.querySelector('#ki-por').onclick = () => {
      const corpo = (sc.pilares || []).map((x) => `<div class="ki-pil"><div class="ki-lin"><b>${esc(x.nome)}</b><span>${x.pontos == null ? '<span class="ki-selo sd">sem dados</span>' : `${String(x.pontos).replace('.', ',')} de ${x.peso}`}</span></div>`
        + `${x.pontos == null ? '' : `<div class="ki-bar"><i style="width:${Math.round((x.pontos / x.peso) * 100)}%;background:#2F6BFF"></i></div>`}`
        + `${x.medido ? `<div class="ki-rot">${esc(x.medido)}</div>` : ''}${x.dica ? `<div class="ki-rot" style="color:var(--texto)">💡 ${esc(x.dica)}</div>` : ''}</div>`).join('');
      dialogo(`Score de saúde: ${total == null ? 'sem dados' : total + ' (' + esc(nomeF) + ')'}`, `<p class="fraco">Cinco pilares somam 100 pontos. Pilar sem dado não conta como zero: o score fica "estimado".</p>${corpo}<p class="fraco">0–39 crítico · 40–59 atenção · 60–79 tranquilo · 80–100 excelente. Não é consultoria financeira.</p>`);
    };
    const rx = el.querySelector('#ki-raiox');
    if (rx) rx.onclick = () => (MB.raiox ? MB.raiox.abrir(p) : MB.abrirAba((cf.faltam[0] && cf.faltam[0].aba) || 'perfil'));
    el.querySelectorAll('.ki-alerta').forEach((a) => { a.onclick = () => MB.abrirAba(a.dataset.aba === 'raiox' ? 'perfil' : a.dataset.aba); });
    const todos = el.querySelector('#ki-todos'); if (todos) todos.onclick = () => MB.abrirAba('documentos');
    const pri = el.querySelector('#ki-primeiro'); if (pri) pri.onclick = () => MB.abrirLancar();
    el.querySelector('#ki-perg').onsubmit = (e) => { e.preventDefault(); const q = String(new FormData(e.target).get('q') || '').trim(); MB.perguntaPendente = q || null; MB.abrirAba('assistente'); };
    // Raio-X (cadastro aos poucos) carrega à parte e não segura a tela.
    if (!MB.raiox) { const s = document.createElement('script'); s.src = '/prumo/raiox.js'; s.onerror = () => {}; document.body.appendChild(s); }
  };
})();
