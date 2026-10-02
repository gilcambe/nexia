'use strict';
// Normalização de texto em português para comparação (minúsculas, sem acento,
// só letras/dígitos) e tokens. Usado pelo Project Resolver e pelo Context Engine.

const STOPWORDS = new Set(('a o as os um uma uns umas de da do das dos em na no nas nos e ou para por com sem ' +
  'que se ao aos à às é ser foi está esta este isso isto essa esse meu minha seu sua nosso nossa ' +
  'the and of to in on for with site projeto cliente app sistema por favor pra pro').split(' '));

function normalize(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokens(s, { keepStopwords = false } = {}) {
  return normalize(s).split(' ').filter(t => t.length >= 2 && (keepStopwords || !STOPWORDS.has(t)));
}

/** A frase (normalizada) aparece no texto como sequência de palavras inteiras? */
function containsPhrase(text, phrase) {
  const p = normalize(phrase);
  if (p.length < 3) return false;
  return (' ' + normalize(text) + ' ').includes(' ' + p + ' ');
}

/** Similaridade lexical entre dois textos: fração dos tokens de `query` presentes em `doc`. */
function overlap(query, doc) {
  const q = [...new Set(tokens(query))];
  if (!q.length) return 0;
  const d = new Set(tokens(doc));
  return q.filter(t => d.has(t)).length / q.length;
}

module.exports = { normalize, tokens, containsPhrase, overlap, STOPWORDS };
