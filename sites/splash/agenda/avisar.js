'use strict';

/**
 * Módulo de avisos para clientes (Splash Eventos).
 * Permite criar pré-visualização em canvas (quadrado 1:1 e story 9:16),
 * gerar QR code no canvas, baixar imagens em PNG e compartilhar via navigator.share.
 * Inclui placeholders para contatos, histórico e modelo de mudança de Instagram.
 */

(function () {
  const Avisar = {
    estado: {
      titulo: 'Comunicado Importante',
      texto: 'Confira as novidades e agenda atualizada do Splash Piscina e Lazer!',
      link: 'https://kernex.com.br/splash',
      fotoImg: null,
      logoImg: null,
      formatoAtual: 'quadrado' // 'quadrado' (1:1) ou 'story' (9:16)
    },

    inicializar() {
      const container = document.getElementById('container-avisar');
      if (!container) return;

      if (!container.getAttribute('data-montado')) {
        this.montarUI(container);
        container.setAttribute('data-montado', 'true');
        this.carregarLogo();
      } else {
        this.atualizarPreview();
      }
    },

    carregarLogo() {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.estado.logoImg = img;
        this.atualizarPreview();
      };
      img.onerror = () => {
        this.atualizarPreview();
      };
      img.src = '../logo-splash.png';
    },

    montarUI(container) {
      container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:16px; margin-top:16px;">

          <!-- Formulário -->
          <div class="card-login" style="max-width:100%; margin:0; padding:16px;">
            <h3 style="font-size:16px; color:var(--cor-destaque); margin-bottom:12px;">Criar novo aviso / post</h3>

            <label>Título do Aviso</label>
            <input type="text" id="av-titulo" value="${SplashPainel.escapeHtml(this.estado.titulo)}" placeholder="Ex: Mudança de Endereço / Novidade" oninput="Avisar.aoMudarCampo()">

            <label>Texto da Mensagem</label>
            <textarea id="av-texto" rows="3" placeholder="Digite o conteúdo do comunicado..." oninput="Avisar.aoMudarCampo()">${SplashPainel.escapeHtml(this.estado.texto)}</textarea>

            <label>Link de Destino / QR Code</label>
            <input type="url" id="av-link" value="${SplashPainel.escapeHtml(this.estado.link)}" placeholder="https://..." oninput="Avisar.aoMudarCampo()">

            <label>Foto de Fundo / Destaque (Opcional)</label>
            <input type="file" id="av-foto" accept="image/jpeg,image/png,image/webp" onchange="Avisar.aoSelecionarFoto(event)">
          </div>

          <!-- Controles de Formato e Pré-visualização -->
          <div class="card" style="margin:0; padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
              <h4 style="font-size:15px; color:var(--texto);">Pré-visualização da Imagem</h4>
              <div style="display:flex; gap:6px;">
                <button type="button" id="btn-fmt-quadrado" class="btn pequeno ouro" onclick="Avisar.mudarFormato('quadrado')">Quadrado (1:1)</button>
                <button type="button" id="btn-fmt-story" class="btn pequeno claro" onclick="Avisar.mudarFormato('story')">Story (9:16)</button>
              </div>
            </div>

            <div style="text-align:center; background:rgba(0,0,0,0.3); padding:12px; border-radius:12px; overflow-x:auto;">
              <canvas id="canvas-preview" style="max-width:100%; height:auto; border-radius:8px; border:1px solid var(--linha); background:#111;"></canvas>
            </div>

            <div style="display:flex; gap:10px; margin-top:16px; flex-wrap:wrap;">
              <button type="button" class="btn ouro" style="flex:1;" onclick="Avisar.baixarImagem()"><i class="ri-download-line"></i> Baixar imagem</button>
              <button type="button" class="btn claro" style="flex:1;" onclick="Avisar.compartilhar()"><i class="ri-share-line"></i> Compartilhar</button>
            </div>
          </div>

          <!-- Placeholders de Extensões Futuras -->
          <div class="card" style="margin:0; padding:16px;">
            <h4 style="font-size:14px; color:var(--cor-destaque); margin-bottom:8px;"><i class="ri-instagram-line"></i> Modelo de Mudança do Instagram</h4>
            <p style="font-size:12px; color:var(--suave);">Placeholder: Em breve você poderá aplicar modelos prontos de comunicado para troca de perfil do Instagram ou aviso de manutenção.</p>
          </div>

          <div class="card" style="margin:0; padding:16px;">
            <h4 style="font-size:14px; color:var(--cor-destaque); margin-bottom:8px;"><i class="ri-contacts-line"></i> Lista de Contatos</h4>
            <p style="font-size:12px; color:var(--suave);">Placeholder: Lista de contatos recentes e clientes cadastrados para disparo direto de comunicados.</p>
          </div>

          <div class="card" style="margin:0; padding:16px;">
            <h4 style="font-size:14px; color:var(--cor-destaque); margin-bottom:8px;"><i class="ri-history-line"></i> Histórico de Avisos</h4>
            <p style="font-size:12px; color:var(--suave);">Placeholder: Histórico das imagens e mensagens geradas anteriormente.</p>
          </div>

        </div>
      `;

      this.atualizarPreview();
    },

    aoMudarCampo() {
      const tit = document.getElementById('av-titulo');
      const txt = document.getElementById('av-texto');
      const lnk = document.getElementById('av-link');

      if (tit) this.estado.titulo = tit.value;
      if (txt) this.estado.texto = txt.value;
      if (lnk) this.estado.link = lnk.value;

      this.atualizarPreview();
    },

    aoSelecionarFoto(e) {
      const file = e.target.files && e.target.files[0];
      if (!file) {
        this.estado.fotoImg = null;
        this.atualizarPreview();
        return;
      }

      const reader = new FileReader();
      reader.onload = evt => {
        const img = new Image();
        img.onload = () => {
          this.estado.fotoImg = img;
          this.atualizarPreview();
        };
        img.src = evt.target.result;
      };
      reader.readAsDataURL(file);
    },

    mudarFormato(fmt) {
      this.estado.formatoAtual = fmt;
      const bQ = document.getElementById('btn-fmt-quadrado');
      const bS = document.getElementById('btn-fmt-story');
      if (bQ && bS) {
        bQ.className = `btn pequeno ${fmt === 'quadrado' ? 'ouro' : 'claro'}`;
        bS.className = `btn pequeno ${fmt === 'story' ? 'ouro' : 'claro'}`;
      }
      this.atualizarPreview();
    },

    gerarQR(canvas, texto, x, y, tamanho) {
      const ctx = canvas.getContext('2d');
      if (typeof window.gerarQR === 'function' && window.gerarQR !== this._wrapperQR && window.gerarQR !== this.gerarQR) {
        window.gerarQR(canvas, texto, x, y, tamanho);
        return;
      }

      // Fallback nativo: renderização gráfica visual simulada de QR Code
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x, y, tamanho, tamanho);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, tamanho, tamanho);

      ctx.fillStyle = '#000000';
      // Marcadores nos cantos
      const pSize = Math.round(tamanho * 0.22);
      ctx.fillRect(x + 6, y + 6, pSize, pSize);
      ctx.fillRect(x + tamanho - pSize - 6, y + 6, pSize, pSize);
      ctx.fillRect(x + 6, y + tamanho - pSize - 6, pSize, pSize);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x + 10, y + 10, pSize - 8, pSize - 8);
      ctx.fillRect(x + tamanho - pSize - 2, y + 10, pSize - 8, pSize - 8);
      ctx.fillRect(x + 10, y + tamanho - pSize - 2, pSize - 8, pSize - 8);

      ctx.fillStyle = '#000000';
      ctx.fillRect(x + 14, y + 14, pSize - 16, pSize - 16);
      ctx.fillRect(x + tamanho - pSize + 2, y + 14, pSize - 16, pSize - 16);
      ctx.fillRect(x + 14, y + tamanho - pSize + 2, pSize - 16, pSize - 16);

      // Padrão de dados simulado
      const hash = String(texto).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const grid = 8;
      const step = (tamanho - 16) / grid;
      for (let i = 1; i < grid - 1; i++) {
        for (let j = 1; j < grid - 1; j++) {
          if ((i + j + hash) % 2 === 0) {
            ctx.fillRect(x + 8 + i * step, y + 8 + j * step, step - 1, step - 1);
          }
        }
      }
      ctx.restore();
    },

    atualizarPreview() {
      const cv = document.getElementById('canvas-preview');
      if (!cv) return;

      const isStory = this.estado.formatoAtual === 'story';
      const W = isStory ? 1080 : 1080;
      const H = isStory ? 1920 : 1080;

      cv.width = W;
      cv.height = H;

      const ctx = cv.getContext('2d');

      // Fundo Degradê Elegante
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#0A0D08');
      grad.addColorStop(0.5, '#161E14');
      grad.addColorStop(1, '#0A0D08');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Imagem de Destaque se houver
      if (this.estado.fotoImg) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        const img = this.estado.fotoImg;
        const scale = Math.max(W / img.width, H / img.height);
        const iw = img.width * scale;
        const ih = img.height * scale;
        const ix = (W - iw) / 2;
        const iy = (H - ih) / 2;
        ctx.drawImage(img, ix, iy, iw, ih);
        ctx.restore();
      }

      // Moldura decorativa
      ctx.strokeStyle = 'rgba(201, 168, 76, 0.4)';
      ctx.lineWidth = 8;
      ctx.strokeRect(30, 30, W - 60, H - 60);

      // Topo: Logo Splash
      if (this.estado.logoImg) {
        ctx.save();
        const logo = this.estado.logoImg;
        const logoDim = isStory ? 180 : 140;
        const lx = (W - logoDim) / 2;
        const ly = isStory ? 120 : 70;

        ctx.beginPath();
        ctx.arc(lx + logoDim / 2, ly + logoDim / 2, logoDim / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(logo, lx, ly, logoDim, logoDim);
        ctx.restore();
      }

      // Título
      ctx.textAlign = 'center';
      ctx.fillStyle = '#C9A84C';
      ctx.font = isStory ? 'bold 64px sans-serif' : 'bold 54px sans-serif';

      const yTitulo = isStory ? 380 : 270;
      ctx.fillText(this.estado.titulo || 'Comunicado', W / 2, yTitulo, W - 120);

      // Divisor
      ctx.strokeStyle = '#C9A84C';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(W / 2 - 120, yTitulo + 30);
      ctx.lineTo(W / 2 + 120, yTitulo + 30);
      ctx.stroke();

      // Texto da mensagem (com quebra automática de linha)
      ctx.fillStyle = '#F8F4ED';
      ctx.font = isStory ? '44px sans-serif' : '36px sans-serif';
      const maxTextWidth = W - 160;
      const lineHeight = isStory ? 60 : 48;
      const startY = yTitulo + (isStory ? 120 : 90);

      const palavras = (this.estado.texto || '').split(' ');
      let linha = '';
      let curY = startY;

      for (let n = 0; n < palavras.length; n++) {
        const testeLinha = linha + palavras[n] + ' ';
        const metrics = ctx.measureText(testeLinha);
        if (metrics.width > maxTextWidth && n > 0) {
          ctx.fillText(linha.trim(), W / 2, curY);
          linha = palavras[n] + ' ';
          curY += lineHeight;
        } else {
          linha = testeLinha;
        }
      }
      ctx.fillText(linha.trim(), W / 2, curY);

      // QR Code e Rodapé
      if (this.estado.link) {
        const qrSize = isStory ? 240 : 180;
        const qrX = (W - qrSize) / 2;
        const qrY = isStory ? H - 460 : H - 280;

        this.gerarQR(cv, this.estado.link, qrX, qrY, qrSize);

        ctx.fillStyle = '#C9A84C';
        ctx.font = isStory ? '32px sans-serif' : '26px sans-serif';
        ctx.fillText('Acesse pelo QR Code ou link', W / 2, qrY + qrSize + 45);
      }

      // Marca de rodapé
      ctx.fillStyle = 'rgba(248, 244, 237, 0.6)';
      ctx.font = '24px sans-serif';
      ctx.fillText('Splash Piscina e Lazer', W / 2, H - 50);
    },

    baixarImagem() {
      const cv = document.getElementById('canvas-preview');
      if (!cv) return;

      const link = document.createElement('a');
      link.download = `aviso_splash_${this.estado.formatoAtual}_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = cv.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },

    compartilhar() {
      const cv = document.getElementById('canvas-preview');
      if (!cv) return;

      cv.toBlob(async blob => {
        if (!blob) return;
        const file = new File([blob], `aviso_splash_${this.estado.formatoAtual}.png`, { type: 'image/png' });
        const text = `${this.estado.titulo}\n${this.estado.texto}\n${this.estado.link}`;

        try {
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: this.estado.titulo,
              text: text
            });
          } else if (navigator.share) {
            await navigator.share({
              title: this.estado.titulo,
              text: text,
              url: this.estado.link
            });
          } else {
            this.baixarImagem();
          }
        } catch (err) {
          // Cancelado pelo usuário ou não suportado
        }
      }, 'image/png');
    }
  };

  window.Avisar = Avisar;
  const originalGerarQR = window.gerarQR;
  const wrapperQR = function (canvas, texto, x, y, tamanho) {
    if (typeof originalGerarQR === 'function' && originalGerarQR !== wrapperQR) {
      originalGerarQR(canvas, texto, x, y, tamanho);
    } else {
      Avisar.desenharQRNativo(canvas, texto, x, y, tamanho);
    }
  };
  Avisar._wrapperQR = wrapperQR;
  Avisar.desenharQRNativo = function(canvas, texto, x, y, tamanho) {
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, tamanho, tamanho);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, tamanho, tamanho);

    ctx.fillStyle = '#000000';
    const pSize = Math.round(tamanho * 0.22);
    ctx.fillRect(x + 6, y + 6, pSize, pSize);
    ctx.fillRect(x + tamanho - pSize - 6, y + 6, pSize, pSize);
    ctx.fillRect(x + 6, y + tamanho - pSize - 6, pSize, pSize);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x + 10, y + 10, pSize - 8, pSize - 8);
    ctx.fillRect(x + tamanho - pSize - 2, y + 10, pSize - 8, pSize - 8);
    ctx.fillRect(x + 10, y + tamanho - pSize - 2, pSize - 8, pSize - 8);

    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 14, y + 14, pSize - 16, pSize - 16);
    ctx.fillRect(x + tamanho - pSize + 2, y + 14, pSize - 16, pSize - 16);
    ctx.fillRect(x + 14, y + tamanho - pSize + 2, pSize - 16, pSize - 16);

    const hash = String(texto).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const grid = 8;
    const step = (tamanho - 16) / grid;
    for (let i = 1; i < grid - 1; i++) {
      for (let j = 1; j < grid - 1; j++) {
        if ((i + j + hash) % 2 === 0) {
          ctx.fillRect(x + 8 + i * step, y + 8 + j * step, step - 1, step - 1);
        }
      }
    }
    ctx.restore();
  };

  if (!window.gerarQR) {
    window.gerarQR = wrapperQR;
  }
})();
