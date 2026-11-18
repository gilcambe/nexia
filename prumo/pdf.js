'use strict';
// Kernex Finance: transforma PDF (fatura, extrato) em imagens no próprio celular, para a mesma leitura das fotos.
// Usa o pdf.js (grátis) de CDN com versão fixa, carregado só quando a pessoa escolhe um PDF.
(function (raiz) {
  const MAX = 5;
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const ehPdf = (a) => !!a && (a.type === 'application/pdf' || /\.pdf$/i.test(a.name || ''));
  /** Quantas páginas ler de cada arquivo sem passar de MAX imagens no total. */
  function planejar(arquivos, max = MAX) {
    let resta = max; const plano = []; let cortou = false;
    for (const a of arquivos) {
      if (resta <= 0) { cortou = true; break; }
      const n = a.pdf ? Math.min(a.paginas || 1, resta) : 1;
      if (a.pdf && (a.paginas || 1) > n) cortou = true;
      plano.push(n); resta -= n;
    }
    return { plano, cortou };
  }
  let carregando = null;
  function carregarPdfJs() {
    if (raiz.pdfjsLib) return Promise.resolve(raiz.pdfjsLib);
    if (!carregando) carregando = new Promise((ok, falha) => {
      const s = document.createElement('script'); s.src = PDFJS;
      s.onload = () => { raiz.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER; ok(raiz.pdfjsLib); };
      s.onerror = () => { carregando = null; falha(new Error('Não consegui abrir o leitor de PDF. Confira a internet ou mande um print.')); };
      document.head.appendChild(s);
    });
    return carregando;
  }
  async function abrir(arquivo) {
    const lib = await carregarPdfJs();
    // 17/11: no celular do dono o PDF do holerite 'não abria' sem dizer por quê. Agora a mensagem traz o motivo (código curto).
    let bytes;
    try { bytes = new Uint8Array(await arquivo.arrayBuffer()); } catch (e) {
      throw new Error('O celular não entregou o arquivo (' + ((e && e.name) || 'erro') + '). Baixe o PDF para o aparelho e escolha de novo, ou tire um print.');
    }
    if (!bytes.length) throw new Error('O arquivo veio vazio. Baixe o PDF para o aparelho e escolha de novo, ou tire um print.');
    // O pdf.js leva os bytes para o worker (o buffer fica vazio depois): cabeçalho e tamanho são lidos ANTES.
    const cab = String.fromCharCode.apply(null, bytes.slice(0, 5)); const kb = Math.round(bytes.length / 1024);
    try { return await lib.getDocument({ data: bytes }).promise; } catch (e) {
      if (/password/i.test(String(e && e.name) + String(e && e.message))) throw new Error('Este PDF tem senha. Abra no app do banco e tire um print da página.');
      const motivo = cab === '%PDF-' ? ((e && e.name) || 'erro') : 'não é PDF: ' + cab.replace(/[^ -~]/g, '?');
      throw new Error('Não consegui abrir este PDF (' + motivo + ', ' + kb + ' KB). Tire um print da página.');
    }
  }
  async function pagina(doc, n) {
    const p = await doc.getPage(n);
    const vp0 = p.getViewport({ scale: 1 });
    const vp = p.getViewport({ scale: Math.min(2, 1600 / vp0.width) });
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await p.render({ canvasContext: ctx, viewport: vp }).promise;
    return c.toDataURL('image/jpeg', 0.8);
  }
  /** Fotos e PDFs → lista de imagens (data-URL), no máximo 5. `reduzir` é o mesmo das fotos. */
  async function paraImagens(arquivos, reduzir, max = MAX) {
    const itens = [];
    for (const a of arquivos) itens.push(ehPdf(a) ? { pdf: true, a, doc: await abrir(a) } : { pdf: false, a });
    itens.forEach((x) => { if (x.pdf) x.paginas = x.doc.numPages; });
    const { plano, cortou } = planejar(itens, max);
    const imagens = [];
    for (let i = 0; i < plano.length; i++) {
      const x = itens[i];
      if (!x.pdf) imagens.push(await reduzir(x.a));
      else for (let n = 1; n <= plano[i]; n++) imagens.push(await pagina(x.doc, n));
    }
    return { imagens, cortou };
  }
  const api = { ehPdf, planejar, paraImagens, MAX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { raiz.MB = raiz.MB || {}; raiz.MB.pdf = api; }
})(typeof window !== 'undefined' ? window : globalThis);
