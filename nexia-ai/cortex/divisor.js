/**
 * Módulo de divisão de tarefas em CommonJS
 */

function dividirTarefa(texto, max = 600) {
  if (!texto || typeof texto !== 'string') {
    return [''];
  }

  if (texto.length <= max) {
    return [texto];
  }

  // Tentar dividir por linhas ou itens numerados / marcadores / frases
  // Dividir em parágrafos ou linhas primeiro
  const linhas = texto.split(/\r?\n/);
  const passos = [];
  let atual = '';

  function adicionarOuFlush(trecho) {
    if (!trecho.trim()) return;
    
    // Se o trecho isolado for maior que max, precisamos dividi-lo em pedaços menores (por frases ou tamanho)
    if (trecho.length > max) {
      if (atual) {
        passos.push(atual.trim());
        atual = '';
      }
      // Dividir por frases (. ! ?) ou pedaços de tamanho max
      const partes = trecho.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [trecho];
      for (const parte of partes) {
        if ((atual + ' ' + parte).trim().length <= max) {
          atual = (atual ? atual + ' ' : '') + parte;
        } else {
          if (atual) {
            passos.push(atual.trim());
          }
          // Se uma única parte for maior que max, quebrar por tamanho fixo
          if (parte.length > max) {
            for (let i = 0; i < parte.length; i += max) {
              passos.push(parte.slice(i, i + max).trim());
            }
            atual = '';
          } else {
            atual = parte;
          }
        }
      }
      return;
    }

    const testar = (atual ? atual + '\n' : '') + trecho;
    if (testar.length <= max) {
      atual = testar;
    } else {
      if (atual) {
        passos.push(atual.trim());
      }
      atual = trecho;
    }
  }

  for (const linha of linhas) {
    // Detectar se é item numerado (1., 2., etc) ou marcador (-)
    const ehItem = /^(\d+\.|\-|\*)\s+/.test(linha.trim());
    if (ehItem && atual) {
      passos.push(atual.trim());
      atual = '';
    }
    adicionarOuFlush(linha);
  }

  if (atual) {
    passos.push(atual.trim());
  }

  return passos.length > 0 ? passos : [texto];
}

module.exports = {
  dividirTarefa
};
