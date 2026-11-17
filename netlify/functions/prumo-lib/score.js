'use strict';
/**
 * API de score (parte 1/3 do epic #3958).
 * Persiste scores em scores.json ao lado deste arquivo.
 * Exporta score_ler, score_salvar, score_listar.
 */
const fs = require('fs');
const path = require('path');

const SCORES_PATH = path.join(__dirname, 'scores.json');

function lerScores() {
  try {
    const txt = fs.readFileSync(SCORES_PATH, 'utf8');
    const arr = JSON.parse(txt);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function gravarScores(arr) {
  fs.writeFileSync(SCORES_PATH, JSON.stringify(arr, null, 2), 'utf8');
}

/**
 * Lê os scores. Se imagemBase64 for uma string não vazia, filtra por aquela imagem.
 * Senão, devolve todos os scores.
 */
function score_ler(imagemBase64) {
  const scores = lerScores();
  if (typeof imagemBase64 === 'string' && imagemBase64 !== '') {
    return scores.filter((s) => s && s.imagem === imagemBase64);
  }
  return scores;
}

/**
 * Salva um novo score (objeto com pelo menos imagem e valor).
 * Devolve true se gravou, false se o payload for inválido.
 */
function score_salvar(score) {
  if (!score || typeof score !== 'object') return false;
  if (typeof score.imagem !== 'string' || score.imagem === '') return false;
  const scores = lerScores();
  scores.push(score);
  gravarScores(scores);
  return true;
}

/**
 * Devolve todos os scores salvos.
 */
function score_listar() {
  return lerScores();
}

module.exports = { score_ler, score_salvar, score_listar };
