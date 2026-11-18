'use strict';
// Kernex Finance: score de crédito no Início (Serasa, SPC, Boa Vista). Vem de print ou digitação; o app nunca pede senha.
(function () {
  const MB = window.MB = window.MB || {};
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const dmy = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
  const COR = { baixo: '#ef4444', regular: '#f59e0b', bom: '#84cc16', 'muito bom': '#22c55e', excelente: '#16a34a' };

  function cartao(r) {
    const biros = Object.values((r && r.por_biro) || {});
    const botoes = '<div class="linha" style="margin-top:10px"><button type="button" class="btn sec" id="score-atualizar">📷 Atualizar score</button><button type="button" class="btn sec" id="score-pdf">📄 PDF</button><button type="button" class="btn sec" id="score-digitar">✍️ Digitar</button></div>'
      + '<input type="file" id="score-arq" accept="image/*" multiple hidden><div id="score-res"></div>';
    if (!biros.length) {
      return '<div class="card" id="score-cartao"><div class="fraco">Seu score de crédito</div>'
        + '<p class="fraco">Ainda não tenho seu score. Mande o print do app do Serasa, SPC ou Boa Vista (ou digite o valor). Não existe consulta grátis automática e eu nunca peço sua senha.</p>'
        + botoes + '</div>';
    }
    // Compacto: só o número aparece; data, variação, dicas e botões abrem ao tocar.
    const topo = biros.map((b) => `<span class="kf-chip-score" data-biro="${esc(b.biro)}"><span class="fraco">${esc(b.nome)}</span> <b class="kf-num">${esc(b.score)}</b>`
      + ` <span style="color:${COR[b.faixa] || 'inherit'};font-size:12px">${esc(b.faixa)}</span></span>`).join('');
    const detalhes = biros.map((b) => {
      const v = b.variacao;
      const variacao = v === null || v === undefined ? 'primeiro registro' : v === 0 ? 'igual ao anterior' : `${v > 0 ? '▲ +' : '▼ '}${v} desde o anterior`;
      return `<div class="item"><div><div class="n">${esc(b.nome)}</div><div class="fraco">${esc(dmy(b.data))} · ${esc(variacao)}</div></div>`
        + `<div style="text-align:right"><div class="n">${esc(b.score)}<span class="fraco" style="font-size:11px">/1000</span></div>`
        + `<div class="fraco" style="font-size:12px">${esc(b.faixa)}${b.faixa_suposicao ? ' (faixa estimada)' : ''}</div></div></div>`;
    }).join('');
    return '<details class="card kf-dobra" id="score-cartao"><summary><span class="fraco">Score de crédito</span><span class="kf-scores">' + topo + '</span></summary>'
      + '<div class="kf-dobra-corpo">' + detalhes
      + '<div class="fraco" style="margin-top:8px">Como subir:</div>' + (r.dicas || []).slice(0, 3).map((d) => `<div class="fraco">• ${esc(d)}</div>`).join('')
      + botoes + '</div></details>';
  }

  function campos(s) {
    s = s || {};
    return [
      { nome: 'biro', rotulo: 'Birô', opcoes: [['serasa', 'Serasa'], ['spc', 'SPC'], ['boavista', 'Boa Vista']].map(([k, n]) => `<option value="${k}"${s.biro === k ? ' selected' : ''}>${n}</option>`).join('') },
      { nome: 'score', rotulo: 'Score (0 a 1000)', tipo: 'number', valor: s.score },
      { nome: 'data', rotulo: 'Data', tipo: 'date', valor: s.data },
    ];
  }
  const corpo = (s, d) => ({ biro: d.biro || s.biro, score: Number(d.score), data: d.data || s.data });

  /** Liga o cartão (já no DOM): botão, arquivo, leitura e conferência. Só liga o que foi desenhado. */
  function ligar(el, { api, pdf, reduzir, formulario, ok }) {
    const bt = el.querySelector('#score-atualizar'); const arq = el.querySelector('#score-arq'); const res = el.querySelector('#score-res');
    if (!bt || !arq) return;
    const conferir = (s, titulo) => formulario(titulo, campos(s), (d) => api('score_salvar', corpo(s, d)), null);
    bt.onclick = () => {
      // O arquivo é escolhido pelo botão; quem prefere digitar usa "Digitar" logo abaixo.
      arq.accept = 'image/*'; arq.value = ''; arq.click();
    };
    const btPdf = el.querySelector('#score-pdf');
    if (btPdf) btPdf.onclick = () => { arq.accept = 'application/pdf,.pdf'; arq.value = ''; arq.click(); };
    const dig = el.querySelector('#score-digitar'); if (dig) dig.onclick = () => conferir({ biro: 'serasa', data: new Date().toISOString().slice(0, 10) }, 'Digite seu score');
    arq.onchange = async (ev) => {
      const arqs = [...((ev && ev.target && ev.target.files) || arq.files || [])];
      if (!arqs.length) return;
      if (arqs.length > 5) { res.innerHTML = '<div class="aviso-c">Envie no máximo 5 arquivos por vez.</div>'; return; }
      res.innerHTML = '<div class="fraco">Lendo… pode levar um pouco.</div>';
      try {
        const { imagens } = await pdf.paraImagens(arqs, reduzir);
        const { lidos } = await api('score_print_ler', { imagens });
        res.innerHTML = '';
        const falhas = lidos.filter((l) => !l.ok).length;
        if (falhas) ok(`${falhas} print(s) não deu para ler. Tente de novo com uma imagem mais nítida ou digite o score.`);
        lidos.filter((l) => l.ok).forEach((l) => conferir(l.score, 'Confira o score'));
      } catch (e) { res.innerHTML = `<div class="aviso-c">${esc(e && e.message || 'Não consegui ler agora.')}</div>`; }
    };
  }

  MB.score = { cartao, campos, corpo, ligar };
})();
