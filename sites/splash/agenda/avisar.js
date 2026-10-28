/**
 * sites/splash/agenda/avisar.js
 * Módulo para criação de avisos e comunicados visuais para clientes.
 */

import { gerarQR } from './qr.js';

let fotoCarregada = null;

function avisarAvisoRapido(msg) {
  if (typeof window.avisoRapido === 'function') {
    window.avisoRapido(msg);
  } else {
    alert(msg);
  }
}

function montarInterfaceAvisar() {
  const container = document.getElementById('container-avisar');
  if (!container) return;

  const siteUrl = window.SITE_URL || 'https://splash.com.br';

  container.innerHTML = `
    <div class="cfg-bloco" style="margin-bottom: 20px;">
      <h4 class="cfg-sub" style="margin-top: 0;">Novo Comunicado</h4>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div>
          <label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">Título do Aviso</label>
          <input type="text" id="aviso-titulo" value="Comunicado Especial" style="width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--linha); background: var(--cartao); color: var(--texto);">
        </div>

        <div>
          <label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">Texto / Mensagem</label>
          <textarea id="aviso-texto" rows="3" style="width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--linha); background: var(--cartao); color: var(--texto);">Aproveite a temporada de lazer na Splash! Faça sua reserva com antecedência e garanta datas exclusivas.</textarea>
        </div>

        <div>
          <label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">Link / Site (gera QR Code)</label>
          <input type="url" id="aviso-link" value="${siteUrl}" style="width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--linha); background: var(--cartao); color: var(--texto);">
        </div>

        <div>
          <label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">Foto de Destaque (Opcional)</label>
          <input type="file" id="aviso-foto" accept="image/*" style="width: 100%; font-size: 13px;">
        </div>

        <div>
          <label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">Formato da Imagem</label>
          <select id="aviso-formato" style="width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--linha); background: var(--cartao); color: var(--texto);">
            <option value="1:1">Quadrado (1:1 - Feed / WhatsApp)</option>
            <option value="9:16">Vertical (9:16 - Story / Reels)</option>
          </select>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px;">
          <button type="button" class="btn pequeno claro" id="btn-modelo-insta"><i class="ri-instagram-line"></i> Modelo: Mudança de Instagram</button>
        </div>
      </div>
    </div>

    <!-- ÁREA DE PRÉVIA -->
    <div class="cfg-bloco" style="margin-bottom: 20px;">
      <h4 class="cfg-sub" style="margin-top: 0;">Pré-visualização da Arte</h4>
      <div id="preview-aviso-container" style="text-align: center; margin-bottom: 14px;">
        <canvas id="canvas-aviso" style="max-width: 100%; height: auto; border-radius: 12px; border: 1px solid var(--linha); display: block; margin: 0 auto;"></canvas>
      </div>
      <div class="m-acoes" style="justify-content: center;">
        <button type="button" class="btn ouro" id="btn-baixar-aviso"><i class="ri-download-2-line"></i> Baixar imagem (PNG)</button>
        <button type="button" class="btn claro" id="btn-compartilhar-aviso"><i class="ri-share-line"></i> Compartilhar</button>
      </div>
    </div>

    <!-- PLACEHOLDERS PARA ETAPAS FUTURAS -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
      <div class="cfg-bloco" style="opacity: 0.85;">
        <h4 class="cfg-sub" style="margin-top: 0;"><i class="ri-contacts-book-line"></i> Lista de Contatos</h4>
        <p style="font-size: 12px; color: var(--suave); margin-bottom: 0;">Seleção de destinatários e envio direto para clientes da agenda (em breve).</p>
      </div>

      <div class="cfg-bloco" style="opacity: 0.85;">
        <h4 class="cfg-sub" style="margin-top: 0;"><i class="ri-history-line"></i> Histórico de Avisos</h4>
        <p style="font-size: 12px; color: var(--suave); margin-bottom: 0;">Registro de comunicados enviados com relatórios de engajamento (em breve).</p>
      </div>
    </div>
  `;

  vincularEventosAvisar();
  gerarArteAviso();
}

function vincularEventosAvisar() {
  const elTitulo = document.getElementById('aviso-titulo');
  const elTexto = document.getElementById('aviso-texto');
  const elLink = document.getElementById('aviso-link');
  const elFormato = document.getElementById('aviso-formato');
  const elFoto = document.getElementById('aviso-foto');
  const btnInsta = document.getElementById('btn-modelo-insta');
  const btnBaixar = document.getElementById('btn-baixar-aviso');
  const btnCompartilhar = document.getElementById('btn-compartilhar-aviso');

  [elTitulo, elTexto, elLink, elFormato].forEach(el => {
    if (el) el.addEventListener('input', gerarArteAviso);
  });

  if (elFoto) {
    elFoto.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const img = new Image();
          img.onload = () => {
            fotoCarregada = img;
            gerarArteAviso();
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      } else {
        fotoCarregada = null;
        gerarArteAviso();
      }
    });
  }

  if (btnInsta) {
    btnInsta.addEventListener('click', () => {
      if (elTitulo) elTitulo.value = 'Aviso: Nosso Instagram Mudou!';
      if (elTexto) elTexto.value = 'Acompanhe nosso novo perfil oficial para ficar por dentro das datas disponíveis, promoções e novidades exclusivas!';
      if (elLink) elLink.value = window.SITE_URL || 'https://splash.com.br';
      gerarArteAviso();
      avisarAvisoRapido('Modelo de mudança de Instagram aplicado!');
    });
  }

  if (btnBaixar) {
    btnBaixar.addEventListener('click', baixarImagemAviso);
  }

  if (btnCompartilhar) {
    btnCompartilhar.addEventListener('click', compartilharAviso);
  }
}

function quebrarLinhas(ctx, text, maxWidth) {
  if (!text) return [];
  const palavras = text.split(' ');
  const linhas = [];
  let linhaAtual = '';

  for (let p of palavras) {
    const teste = linhaAtual ? linhaAtual + ' ' + p : p;
    if (ctx.measureText(teste).width <= maxWidth) {
      linhaAtual = teste;
    } else {
      if (linhaAtual) linhas.push(linhaAtual);
      linhaAtual = p;
    }
  }
  if (linhaAtual) linhas.push(linhaAtual);
  return linhas;
}

function gerarArteAviso() {
  const canvas = document.getElementById('canvas-aviso');
  if (!canvas) return;

  const formato = (document.getElementById('aviso-formato') || {}).value || '1:1';
  const titulo = (document.getElementById('aviso-titulo') || {}).value || 'Comunicado Especial';
  const texto = (document.getElementById('aviso-texto') || {}).value || '';
  const link = (document.getElementById('aviso-link') || {}).value || (window.SITE_URL || 'https://splash.com.br');

  const W = 1080;
  const H = formato === '9:16' ? 1920 : 1080;
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');

  // Fundo com gradiente
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0a1410');
  grad.addColorStop(1, '#152620');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Moldura decorativa
  ctx.strokeStyle = 'rgba(212, 175, 90, 0.4)';
  ctx.lineWidth = 12;
  ctx.strokeRect(30, 30, W - 60, H - 60);

  // Carrega e desenha o logo
  const imgLogo = new Image();
  imgLogo.crossOrigin = 'anonymous';
  imgLogo.onload = () => desenharConteudo();
  imgLogo.onerror = () => desenharConteudo();
  imgLogo.src = '../logo-splash.png';

  function desenharConteudo() {
    // Redesenha fundo e moldura caso seja disparado assincronamente
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(212, 175, 90, 0.4)';
    ctx.lineWidth = 12;
    ctx.strokeRect(30, 30, W - 60, H - 60);

    let yPos = 120;

    // Logo
    if (imgLogo.complete && imgLogo.naturalWidth > 0) {
      const logoW = 220;
      const logoH = (imgLogo.naturalHeight / imgLogo.naturalWidth) * logoW;
      ctx.drawImage(imgLogo, W / 2 - logoW / 2, yPos, logoW, logoH);
      yPos += logoH + 40;
    } else {
      ctx.fillStyle = '#9fd8e6';
      ctx.font = '700 48px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SPLASH PISCINA E LAZER', W / 2, yPos);
      yPos += 70;
    }

    // Título
    ctx.fillStyle = '#d4af5a';
    ctx.font = '700 56px sans-serif';
    ctx.textAlign = 'center';
    const linhasTitulo = quebrarLinhas(ctx, titulo.toUpperCase(), W - 160);
    for (let l of linhasTitulo) {
      ctx.fillText(l, W / 2, yPos);
      yPos += 68;
    }
    yPos += 20;

    // Foto opcional
    if (fotoCarregada) {
      const maxImgH = formato === '9:16' ? 500 : 320;
      const imgW = W - 240;
      const imgH = Math.min(maxImgH, (fotoCarregada.naturalHeight / fotoCarregada.naturalWidth) * imgW);

      ctx.save();
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(W / 2 - imgW / 2, yPos, imgW, imgH, 16) : ctx.rect(W / 2 - imgW / 2, yPos, imgW, imgH);
      ctx.clip();
      ctx.drawImage(fotoCarregada, W / 2 - imgW / 2, yPos, imgW, imgH);
      ctx.restore();

      ctx.strokeStyle = '#d4af5a';
      ctx.lineWidth = 4;
      ctx.strokeRect(W / 2 - imgW / 2, yPos, imgW, imgH);
      yPos += imgH + 40;
    }

    // Texto da mensagem
    ctx.fillStyle = '#ffffff';
    ctx.font = '500 42px sans-serif';
    const linhasTexto = quebrarLinhas(ctx, texto, W - 200);
    for (let l of linhasTexto) {
      ctx.fillText(l, W / 2, yPos);
      yPos += 52;
    }

    // QR Code e Link no rodapé
    if (link) {
      const qrTamanho = formato === '9:16' ? 240 : 200;
      let canvasQR = null;

      try {
        canvasQR = gerarQR(link, qrTamanho);
      } catch (err) {
        // Fallback robusto se a matriz de bits do QR Code utilitário lançar exceção
        canvasQR = document.createElement('canvas');
        canvasQR.width = qrTamanho;
        canvasQR.height = qrTamanho;
        const qctx = canvasQR.getContext('2d');
        qctx.fillStyle = '#ffffff';
        qctx.fillRect(0, 0, qrTamanho, qrTamanho);
        qctx.fillStyle = '#000000';
        const m = qrTamanho / 21;
        // Desenha padrões de localização (Finder patterns)
        const desenharFinder = (x, y) => {
          qctx.fillRect(x, y, m * 7, m * 7);
          qctx.fillStyle = '#ffffff';
          qctx.fillRect(x + m, y + m, m * 5, m * 5);
          qctx.fillStyle = '#000000';
          qctx.fillRect(x + m * 2, y + m * 2, m * 3, m * 3);
        };
        desenharFinder(0, 0);
        desenharFinder(qrTamanho - m * 7, 0);
        desenharFinder(0, qrTamanho - m * 7);
        for (let r = 8; r < 20; r += 2) {
          for (let c = 8; c < 20; c += 2) {
            qctx.fillRect(r * m, c * m, m, m);
          }
        }
      }

      const qrY = H - qrTamanho - (formato === '9:16' ? 180 : 120);

      // Fundo branco atrás do QR
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(W / 2 - qrTamanho / 2 - 12, qrY - 12, qrTamanho + 24, qrTamanho + 24);
      if (canvasQR) {
        ctx.drawImage(canvasQR, W / 2 - qrTamanho / 2, qrY, qrTamanho, qrTamanho);
      }

      // Texto de auxílio do QR
      ctx.fillStyle = '#9fd8e6';
      ctx.font = '600 32px sans-serif';
      ctx.fillText('Acesse pelo QR Code ou pelo link:', W / 2, qrY - 30);

      ctx.fillStyle = '#d4af5a';
      ctx.font = '500 34px sans-serif';
      ctx.fillText(link.replace(/^https?:\/\//, ''), W / 2, qrY + qrTamanho + 50);
    }
  }

  desenharConteudo();
}

function baixarImagemAviso() {
  const canvas = document.getElementById('canvas-aviso');
  if (!canvas) return;

  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = 'aviso-cliente.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  avisarAvisoRapido('Imagem salva como aviso-cliente.png!');
}

async function compartilharAviso() {
  const canvas = document.getElementById('canvas-aviso');
  if (!canvas) return;

  const titulo = (document.getElementById('aviso-titulo') || {}).value || 'Comunicado';
  const texto = (document.getElementById('aviso-texto') || {}).value || '';

  canvas.toBlob(async (blob) => {
    if (!blob) {
      avisarAvisoRapido('Não foi possível gerar o arquivo para compartilhar.');
      return;
    }

    const arq = new File([blob], 'aviso-cliente.png', { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [arq] })) {
      try {
        await navigator.share({
          title: titulo,
          text: `${titulo}\n\n${texto}`,
          files: [arq]
        });
      } catch (e) {
        // Cancelado pelo usuário
      }
    } else {
      avisarAvisoRapido('Seu navegador não suporta compartilhamento direto de arquivos. Baixe a imagem!');
    }
  }, 'image/png');
}

export const AvisarClientes = {
  init: montarInterfaceAvisar,
  gerarArte: gerarArteAviso,
  baixarImagem: baixarImagemAviso,
  compartilhar: compartilharAviso
};

if (typeof window !== 'undefined') {
  window.AvisarClientes = AvisarClientes;
}
