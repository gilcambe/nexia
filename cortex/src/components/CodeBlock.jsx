import { useState, useRef, useEffect } from 'react';

// Função para sanitizar código e remover possíveis secrets
const sanitizeCode = (code) => {
  if (!code || typeof code !== 'string') return '';
  // Remove linhas que contêm padrões de segredos (API keys, senhas, etc.)
  return code
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      // Ignora linhas vazias e comentários
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return true;
      // Remove linhas com padrões de segredos
      return !(
        /api[_-]?key|secret|password|token|bearer|auth|credential|private[_-]?key|access[_-]?token/i.test(trimmed) ||
        /sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,}/.test(trimmed)
      );
    })
    .join('\n');
};

// Função para sanitizar mensagem de erro
const sanitizeError = (error) => {
  if (!error) return 'Ocorreu um erro desconhecido';
  const message = String(error);
  // Remove caminhos de arquivo, stack traces e informações internas
  return message
    .replace(/\/[^\s]+\.js:\d+:/g, '[arquivo]')
    .replace(/at .+\/[^\/]+\.js:\d+/g, '[local]')
    .replace(/Error: /g, '')
    .replace(/TypeError: /g, '')
    .replace(/ReferenceError: /g, '')
    .replace(/SyntaxError: /g, '')
    .substring(0, 500); // Limita tamanho
};

// Bloco de código executável com botão 🛠 Corrigir com o Cortex.
// Quando a execução retorna erro, o botão fica ativo. Ao clicar, envia
// o código original + mensagem de erro para POST /autocorrect e,
// ao receber o código corrigido, substitui o conteúdo e dispara nova execução.
export default function CodeBlock({ codigo, linguagem = 'python', autoRun = true }) {
  const [conteudo, setConteudo] = useState(codigo);
  const [erro, setErro] = useState(null);
  const [saida, setSaida] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [corrigindo, setCorrigindo] = useState(false);

  // Executa automaticamente sempre que o conteúdo muda (incluindo após correção)
  useEffect(() => {
    if (!autoRun) return;
    executar(conteudo);
  }, [conteudo, autoRun]);

  async function executar(codigo) {
    setErro(null);
    setSaida(null);
    setCarregando(true);
    try {
      // Sanitiza código antes de enviar
      const codigoSanitizado = sanitizeCode(codigo);
      
      const resposta = await fetch('/api/executar', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        },
        body: JSON.stringify({ codigo: codigoSanitizado, linguagem }),
        signal: AbortSignal.timeout(30000) // Timeout de 30 segundos
      });
      
      if (!resposta.ok) {
        throw new Error(`Erro ${resposta.status}: ${resposta.statusText}`);
      }
      
      const dados = await resposta.json();
      if (dados.erro) {
        setErro(sanitizeError(dados.erro));
      } else {
        setSaida(dados.saida);
      }
    } catch (e) {
      setErro(sanitizeError(e?.message || e));
    } finally {
      setCarregando(false);
    }
  }

  async function corrigirComCortex() {
    if (!erro || corrigindo) return;
    setCorrigindo(true);
    try {
      // Sanitiza código e erro antes de enviar
      const codigoSanitizado = sanitizeCode(conteudo);
      const erroSanitizado = sanitizeError(erro);
      
      const resposta = await fetch('/api/autocorrect', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        },
        body: JSON.stringify({
          codigo: codigoSanitizado,
          erro: erroSanitizado,
          linguagem: linguagem
        }),
        signal: AbortSignal.timeout(60000) // Timeout de 60 segundos para correção
      });
      
      if (!resposta.ok) {
        throw new Error(`Falha ao corrigir: ${resposta.status} ${resposta.statusText}`);
      }
      
      const dados = await resposta.json();
      if (dados.codigo_corrigido) {
        setConteudo(dados.codigo_corrigido);
        // O useEffect acima dispara nova execução automaticamente
      } else if (dados.codigo) {
        setConteudo(dados.codigo);
      } else {
        setErro('Não foi possível corrigir o código. Tente novamente.');
      }
    } catch (e) {
      setErro(sanitizeError(e?.message || 'Erro ao corrigir com o Cortex'));
    } finally {
      setCorrigindo(false);
    }
  }

  return (
    <div className="code-block rounded-xl border border-gray-200 bg-gray-900 text-gray-100 overflow-hidden shadow-sm">
      <div className="code-header flex items-center gap-2 px-4 py-2 border-b border-gray-700 bg-gray-800">
        <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">{linguagem}</span>
        {erro && (
          <button
            type="button"
            onClick={corrigirComCortex}
            disabled={carregando || corrigindo}
            aria-label={corrigindo ? 'Corrigindo com o Cortex...' : 'Corrigir com o Cortex'}
            className={
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ' +
              (carregando || corrigindo
                ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                : 'bg-orange-500 text-white hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-400')
            }
          >
            {corrigindo ? 'Corrigindo...' : '🛠 Corrigir com o Cortex'}
          </button>
        )}
      </div>
      <pre className="code-pre p-4 overflow-x-auto m-0"><code className={`language-${linguagem}`}>{conteudo}</code></pre>
      {erro && (
        <div className="error-box px-4 py-3 border-b border-gray-700 bg-red-900/20 text-red-200 text-sm">
          <p className="font-semibold mb-1">Erro na execução</p>
          <p className="break-all">{erro}</p>
        </div>
      )}
      {saida !== null && (
        <div className="output-box px-4 py-3 border-b border-gray-700 bg-green-900/20 text-green-200 text-sm">
          <p className="font-semibold mb-1">Saída</p>
          <p className="break-all">{saida}</p>
        </div>
      )}
      {carregando && !erro && !saida && (
        <div className="px-4 py-3 text-center text-xs text-gray-400">Executando...</div>
      )}
    </div>
  );
}