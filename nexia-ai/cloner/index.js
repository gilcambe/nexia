'use strict';
// NEXIA Clone (ADR-CLONE-01). Dois modos:
//   design  (padrão, qualquer site público): só tokens de design e ordem das seções → base visual do Site Kit.
//   espelho (cópia fiel): só com autorização explícita do dono e robots.txt permitindo; roda no workflow
//           clonar-site.yml e vira PR em rascunho neste repositório (público).
const url = require('./url');
const css = require('./css');
const design = require('./design');
const mirror = require('./mirror');
const { fetchDesign } = require('./fetch-design');
const { normalize } = require('../text');

const URL_IN_TEXT = /\bhttps?:\/\/[^\s"'<>()]+|\bwww\.[a-z0-9-]+(?:\.[a-z0-9-]+)+[^\s"'<>()]*/i;
// "igual ao https://...", "com o design de", "no estilo de", "inspirado em", "parecido com", "clone o site"...
const DESIGN_WORDS = /\b(igual|identico|mesmo (design|visual|estilo|layout)|com o (design|visual|estilo|layout)|no (estilo|visual|design)|inspirad[oa]|baseado|parecid[oa]|semelhante|como o site|clon\w*|replic\w*|copi\w* o (design|visual|layout|estilo))\b/;

/**
 * Pedido do Cortex com site de referência → URL (só a parte de design será usada); senão null.
 * Ex.: "crie um site igual ao https://exemplo.com para minha padaria".
 */
function designRequest(message) {
  const text = String(message || '');
  const m = URL_IN_TEXT.exec(text);
  if (!m) return null;
  if (!DESIGN_WORDS.test(normalize(text.replace(m[0], ' ')))) return null;
  const v = url.validateUrl(m[0].replace(/[.,;:!?]+$/, ''));
  return v.ok ? v.url : null;
}

module.exports = { ...url, ...css, ...design, ...mirror, fetchDesign, designRequest };
