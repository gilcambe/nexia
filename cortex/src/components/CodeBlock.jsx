import { useState, useRef, useEffect } from 'react';

// Bloco de código executável com botão 🛠 Corrigir com o Cortex.
// Quando a execução retorna erro, o botão fica ativo. Ao clicar, envia
// o código original + mensagem de erro para POST /api/autocorrect e,
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
      const resposta = await fetch('/api/executar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo, linguagem })
      });
      const dados = await resposta.json();
      if (dados.erro) {
        setErro(dados.erro);
      } else {
        setSaida(dados.saida);
      }
    } catch (e) {
      setErro(String(e?.message || e));
    } finally {
      setCarregando(false);
    }
  }

  async function corrigirComCortex() {
    if (!erro || corrigindo) return;
    setCorrigindo(true);
    try {
      const resposta = await fetch('/api/autocorrect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: conteudo,
          erro: erro,
          linguagem: linguagem
        })
      });
      if (!resposta.ok) throw new Error('Falha ao corrigir');
      const dados = await resposta.json();
      if (dados.codigo_corrigido) {
        setConteudo(dados.codigo_corrigido);
        // O useEffect acima dispara nova execução automaticamente
      } else if (dados.codigo) {
        setConteudo(dados.codigo);
      } else {
        setErro('Não foi possível corrigir o código.');
      }
    } catch (e) {
      setErro(String(e?.message || 'Erro ao corrigir com o Cortex'));
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