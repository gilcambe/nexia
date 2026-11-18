'use strict';
// Kernex Finance: aba "Aposentadoria e FGTS" (INSS, FGTS, previdência privada, quanto guardar).
// Cálculos são do servidor (apos_*); aqui só desenha, lê arquivos e confere antes de salvar.
(function () {
  const MB = window.MB;
  const carregar = (url, teste) => teste() ? Promise.resolve() : new Promise((ok, falha) => { const s = document.createElement('script'); s.src = url; s.onload = () => ok(); s.onerror = falha; document.body.appendChild(s); });
  const carregarPdf = () => carregar('/prumo/pdf.js', () => !!MB.pdf).then(() => MB.pdf);
  const carregarApos = () => carregar('/prumo/apos.js', () => !!MB.apos).then(() => MB.apos);
  const carregarUi = () => carregar('/prumo/ui.js', () => !!MB.ui).then(() => MB.ui);

  // Lembra o que a pessoa pediu enquanto a aba é redesenhada.
  const estado = { prev: null, prevCampos: null, guardar: null, imovel: null, perfil: null, vinculos: null };

  MB.telas.aposentadoria = async (el) => {
    const ui = await carregarUi(); const A = await carregarApos();
    const { formulario, reduzir, ok } = ui;
    ui.aba('aposentadoria');
    const corpoVisao = {};
    if (estado.guardar) Object.assign(corpoVisao, estado.guardar);
    if (estado.imovel) corpoVisao.imovel = estado.imovel;
    const v = await MB.api('apos_visao', corpoVisao);
    estado.perfil = v.inss ? v.inss.perfil : null;
    const p = estado.perfil;

    el.innerHTML = `
      <div class="card"><h3 style="margin:0 0 6px">Aposentadoria e FGTS</h3>
        <div class="fraco">Tudo aqui é estimativa com as regras de 2026. Eu nunca peço sua senha do gov.br: o dado entra por digitação, PDF ou print.</div>
        <div class="linha" style="margin-top:10px">
          <button class="btn" type="button" id="apo-perfil">${p ? '✍️ Editar meus dados' : '✍️ Informar meus dados'}</button>
          <button class="btn sec" type="button" id="apo-cnis">📷 Ler CNIS (print)</button>
          <button class="btn sec" type="button" id="apo-cnis-pdf">📄 CNIS em PDF</button>
          <button class="btn sec" type="button" id="apo-fgts-btn">💰 FGTS</button>
          <button class="btn sec" type="button" id="apo-fgts-print">📷 Saldo do FGTS por print</button>
          <button class="btn sec" type="button" id="apo-imovel">🏠 FGTS no imóvel</button>
          <button class="btn sec" type="button" id="apo-prev-btn">🏦 Simular previdência</button>
          <button class="btn sec" type="button" id="apo-guardar-btn">🎯 Quanto guardar</button>
        </div>
        <input type="file" id="apo-arq" accept="image/*" multiple hidden>
        <input type="file" id="apo-fgts-arq" accept="image/*" multiple hidden>
        <div id="apo-alertas"></div>
        ${(v.faltando || []).map((f) => `<div class="aviso-c">${A.esc(f)}</div>`).join('')}</div>
      ${A.cartaoInss(v.inss)}${A.cartaoFgts(v.fgts)}${A.cartaoPrev(estado.prev)}${A.cartaoGuardar(v.quanto_guardar)}`;

    const salvarPerfil = (base, extra) => formulario('Confira seus dados', A.camposPerfil(base), (d) => MB.api('apos_perfil_salvar', A.corpoPerfil(d, extra)).then(() => ok('✅ Dados salvos.')));
    el.querySelector('#apo-perfil').onclick = () => salvarPerfil(p, null);
    el.querySelector('#apo-fgts-btn').onclick = () => formulario('FGTS', A.camposFgts(v.fgts), (d) => MB.api('fgts_salvar', A.corpoFgts(d)).then(() => ok('✅ FGTS salvo.')));
    el.querySelector('#apo-imovel').onclick = () => formulario('FGTS no imóvel', A.camposImovel(estado.imovel), (d) => { estado.imovel = A.corpoImovel(d); });
    el.querySelector('#apo-prev-btn').onclick = () => formulario('Previdência privada', A.camposPrev(estado.prevCampos), async (d) => {
      const corpo = A.corpoPrev(d); estado.prevCampos = corpo; estado.prev = await MB.api('prev_simular', corpo);
    });
    el.querySelector('#apo-guardar-btn').onclick = () => formulario('Quanto guardar', A.camposGuardar(estado.guardar), (d) => { estado.guardar = A.corpoGuardar(d); });

    // CNIS: PDF vira imagens; a IA lê; a pessoa confere antes de salvar.
    const arqCnis = el.querySelector('#apo-arq');
    // CNIS: print/foto pelo seletor de imagens; o botão "PDF" abre o de documentos.
    el.querySelector('#apo-cnis').onclick = () => { arqCnis.accept = 'image/*'; arqCnis.value = ''; arqCnis.click(); };
    const cnisPdf = el.querySelector('#apo-cnis-pdf');
    if (cnisPdf) cnisPdf.onclick = () => { arqCnis.accept = 'application/pdf,.pdf'; arqCnis.value = ''; arqCnis.click(); };
    arqCnis.onchange = async () => {
      const arquivos = [...arqCnis.files];
      if (!arquivos.length) return;
      if (arquivos.length > 5) { ok('Envie no máximo 5 arquivos por vez.'); return; }
      try {
        ok('Lendo o CNIS… pode levar até 2 minutos.');
        const pdf = await carregarPdf();
        const { imagens, cortou } = await pdf.paraImagens(arquivos, reduzir);
        const r = await MB.api('apos_cnis_ler', { imagens });
        const falhas = r.lidos.filter((l) => !l.ok).length;
        if (falhas) ok(`Não consegui ler ${falhas} imagem(ns). Tente de novo com uma foto mais nítida.`);
        if (cortou) ok('Li só as 5 primeiras páginas. Mande as outras depois.');
        const res = r.resumo;
        el.querySelector('#apo-alertas').innerHTML = (res.alertas || []).map((a) => `<div class="aviso-c">${A.esc(a)}</div>`).join('');
        if (!res.vinculos.length && !res.contribuicoes_lidas) return;
        const base = Object.assign({}, p || {}, { tc_2019_meses: res.tc_2019_meses, tc_total_meses: res.tc_total_meses });
        if (res.media_salarial != null) base.media_salarial = res.media_salarial;
        salvarPerfil(base, { vinculos: res.vinculos });
      } catch (e) { ok((e && e.message) || 'Não consegui ler agora.'); }
    };

    // Saldo do FGTS por print.
    const arqFgts = el.querySelector('#apo-fgts-arq');
    el.querySelector('#apo-fgts-print').onclick = () => arqFgts.click();
    arqFgts.onchange = async () => {
      const arquivos = [...arqFgts.files];
      if (!arquivos.length) return;
      try {
        const pdf = await carregarPdf();
        const { imagens } = await pdf.paraImagens(arquivos, reduzir);
        const r = await MB.api('fgts_salvar', { imagens });
        const lido = (r.lidos || []).find((l) => l.ok);
        if (!lido) { ok('Não consegui ler o saldo. Digite o valor.'); return; }
        formulario('Confira o saldo do FGTS', A.camposFgts({ saldo: lido.saldo, modalidade: lido.modalidade }), (d) => MB.api('fgts_salvar', A.corpoFgts(d)).then(() => ok('✅ FGTS salvo.')));
      } catch (e) { ok((e && e.message) || 'Não consegui ler agora.'); }
    };
  };
})();
