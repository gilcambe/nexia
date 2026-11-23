const vm = require('vm');

function criarHooks() {
  const antes = [];
  const depois = [];

  return {
    antes(fn) { antes.push(fn); },
    depois(fn) { depois.push(fn); },
    rodarAntes(chamada) {
      for (const hook of antes) {
        const r = hook(chamada);
        if (r && r.bloquear) return r;
      }
      return null;
    },
    rodarDepois(chamada, resultado) {
      const avisos = [];
      for (const hook of depois) {
        const r = hook(chamada, resultado);
        if (r !== undefined && r !== null) avisos.push(r);
      }
      return avisos;
    }
  };
}

function bloquearPerigoso(chamada) {
  if (!chamada || !chamada.input) return null;
  const input = chamada.input;

  let texto = '';
  try { texto = JSON.stringify(input); } catch (e) { texto = String(input); }

  if (/rm -rf \//.test(texto)) return { bloquear: 'Comando perigoso: rm -rf /' };
  if (/git push --force/.test(texto)) return { bloquear: 'Comando perigoso: git push --force' };
  if (/DROP TABLE/i.test(texto)) return { bloquear: 'Comando perigoso: DROP TABLE' };
  if (/-----BEGIN/.test(texto)) return { bloquear: 'Conteúdo secreto: -----BEGIN' };
  if (/sk-[a-zA-Z0-9]{20,}/.test(texto)) return { bloquear: 'Chave secreta detectada (sk-...)' };

  const arquivos = Array.isArray(input.files) ? input.files : (Array.isArray(input) ? input : []);
  for (const arq of arquivos) {
    const nome = typeof arq === 'string' ? arq : (arq && (arq.path || arq.name || ''));
    if (nome && (nome === '.env' || nome.includes('.env'))) {
      return { bloquear: 'Arquivo .env não permitido: ' + nome };
    }
  }

  if (input.path && (input.path === '.env' || input.path.includes('.env'))) {
    return { bloquear: 'Arquivo .env não permitido: ' + input.path };
  }

  return null;
}

function checarSintaxe(chamada, resultado) {
  if (!chamada) return null;
  const tool = chamada.tool || '';
  if (tool !== 'github.commit_files' && tool !== 'github.edit_files') return null;

  const input = chamada.input || {};
  const arquivos = Array.isArray(input.files) ? input.files : (Array.isArray(input) ? input : []);

  for (const arq of arquivos) {
    if (!arq) continue;
    const caminho = arq.path || arq.name || '';
    if (!caminho.endsWith('.js')) continue;
    const conteudo = typeof arq.content === 'string' ? arq.content : '';
    if (!conteudo) continue;

    const envolvido = '(function(exports, require, module, __filename, __dirname) {\n' + conteudo + '\n})';
    try {
      new vm.Script(envolvido);
    } catch (err) {
      if (err instanceof SyntaxError) {
        return { aviso: 'sintaxe: ' + caminho + ': ' + err.message };
      }
    }
  }

  return null;
}

module.exports = { criarHooks, bloquearPerigoso, checarSintaxe };
