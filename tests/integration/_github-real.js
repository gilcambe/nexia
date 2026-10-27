'use strict';
// Helper: chama a API real do GitHub com retentativa em 403/429/5xx.
// Esperas: 2s, 5s, 10s (3 tentativas). Se ainda for 403 sem cota
// (x-ratelimit-remaining: 0 ou mensagem "GitHub respondeu 403"),
// pula o teste em vez de falhar. Qualquer outro erro continua falhando.
const ESPERAS = [2000, 5000, 10000];

function ehRateLimit(status) {
  return status === 403 || status === 429 || (status >= 500 && status <= 599);
}

function semCota(status, headers, mensagem) {
  if (status !== 403) return false;
  const rem = headers && (headers['x-ratelimit-remaining'] === '0' || headers['x-ratelimit-remaining'] === 0);
  return rem || /GitHub respondeu 403/.test(mensagem);
}

function extrair(erro, resultado) {
  let status, headers, mensagem;
  if (erro) {
    status = erro.status ?? erro.response?.status;
    headers = erro.headers ?? erro.response?.headers;
    mensagem = erro.message;
  } else if (resultado && typeof resultado.status === 'number') {
    status = resultado.status;
    headers = resultado.headers;
    mensagem = `GitHub respondeu ${status}`;
  }
  return { status, headers, mensagem };
}

async function comRetentativa(fn, t) {
  let ultimoErro;
  for (let i = 0; i < 3; i++) {
    let resultado;
    let erro;
    try {
      resultado = await fn();
    } catch (e) {
      erro = e;
      ultimoErro = e;
    }

    const { status, headers, mensagem } = extrair(erro, resultado);

    if (status !== undefined && ehRateLimit(status)) {
      if (i === 2) {
        if (semCota(status, headers, mensagem)) {
          t.skip('GitHub sem cota agora');
          return undefined;
        }
        throw ultimoErro;
      }
      await new Promise(resolve => setTimeout(resolve, ESPERAS[i]));
      continue;
    }

    if (erro) throw ultimoErro;
    return resultado;
  }
  throw ultimoErro;
}

module.exports = { comRetentativa };
