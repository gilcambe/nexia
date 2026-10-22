'use strict';

/**
 * KERNEX Nutri — Painel do Adriano Blumer (e nutricionistas).
 * Funções puras, utilitários, sanitização e manipulação de estado do painel.
 * Funciona no navegador e em ambiente Node.js (testes unitários).
 */

const AVISO_CFN_TEXTO = 'Atenção: o conselho de nutrição (CFN) restringe fotos de antes e depois e de resultados. Confirme com seu CRN antes de publicar e tenha autorização escrita do paciente.';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatarDataBr(iso) {
  if (!iso || typeof iso !== 'string') return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function sanitizarTexto(t, max = 1000) {
  if (typeof t !== 'string') return '';
  return t.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function validarUrlHttps(u) {
  const s = sanitizarTexto(u, 500);
  if (!s) return '';
  try {
    const p = new URL(s);
    if (p.protocol === 'https:') return p.href;
  } catch {
    // URL inválida
  }
  return '';
}

function comprimirImagemClient(file, maxBytes = 600 * 1024) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Selecione um arquivo de imagem válido (JPG, PNG ou WebP).'));
    }
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        const maxDim = 1200;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
          else { w = Math.round((w * maxDim) / h); h = maxDim; }
        }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        let qual = 0.85;
        let result = canvas.toDataURL('image/jpeg', qual);
        while (result.length * 0.75 > maxBytes && qual > 0.2) {
          qual -= 0.1;
          result = canvas.toDataURL('image/jpeg', qual);
        }
        if (result.length * 0.75 > maxBytes) {
          reject(new Error('Foto grande demais. Escolha uma foto menor.'));
        } else {
          resolve(result);
        }
      };
      img.onerror = () => reject(new Error('Não foi possível carregar a imagem.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Erro ao ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

function sanitizarRegrasInstagram(regras) {
  if (!Array.isArray(regras)) return [];
  return regras.slice(0, 30).map(r => {
    if (!r || typeof r !== 'object') return null;
    const palavrasRaw = Array.isArray(r.palavras) ? r.palavras : String(r.palavras || '').split(',');
    const palavras = palavrasRaw
      .slice(0, 20)
      .map(p => sanitizarTexto(p, 50).toLowerCase())
      .filter(Boolean);
    const mensagem = sanitizarTexto(r.mensagem, 1000);
    const link = validarUrlHttps(r.link);
    const ativa = r.ativa !== undefined ? Boolean(r.ativa) : true;

    if (palavras.length === 0 || !mensagem) return null;
    return {
      id: r.id || String(Math.random()).slice(2, 10),
      palavras,
      mensagem,
      link,
      ativa,
    };
  }).filter(Boolean);
}

function acoesSuportadasApiNutri() {
  return [
    'primeiro-acesso',
    'entrar',
    'sair',
    'trocar-senha',
    'site-salvar',
    'site-historico',
    'site-restaurar',
    'site-desfazer',
    'foto-enviar',
    'foto-listar',
    'foto-editar',
    'foto-remover',
    'dm-config-ler',
    'dm-config-salvar',
  ];
}

const AdrianoPainelObj = {
  AVISO_CFN_TEXTO,
  escapeHtml,
  formatarDataBr,
  sanitizarTexto,
  validarUrlHttps,
  comprimirImagemClient,
  sanitizarRegrasInstagram,
  acoesSuportadasApiNutri,
};

if (typeof window !== 'undefined') {
  window.AdrianoPainel = AdrianoPainelObj;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdrianoPainelObj;
}
