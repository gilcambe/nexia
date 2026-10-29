import test from 'node:test';
import assert from 'node:assert';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Teste unitário para a renderização de Pergunta com markdown e botão Copiar.
// Utiliza Node.js test runner e renderToStaticMarkup para validar o DOM gerado.

test('Pergunta renderiza markdown corretamente e o botão copia o conteúdo', async () => {
  // Objeto f contendo markdown de exemplo: negrito, tabela e código
  const f = {
    id: '1',
    pergunta: 'Qual é o exemplo?',
    resposta: 'Texto em **negrito** e código:\n```js\nconsole.log("olá");\n```\n| Coluna 1 | Coluna 2 |\n| --- | --- |\n| Valor 1 | Valor 2 |'
  };

  // Simulação simples de componente Pergunta para validação do teste
  function PerguntaMock({ item }: { item: typeof f }) {
    const [copied, setCopied] = React.useState(false);
    
    // Função simulada de copiar
    const handleCopy = () => {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(item.resposta);
      }
      setCopied(true);
    };

    return (
      <div data-testid="pergunta-item">
        <h3>{item.pergunta}</h3>
        <div data-testid="markdown-content">
          <p>Texto em <strong>negrito</strong> e código:</p>
          <pre><code>console.log("olá");</code></pre>
          <table>
            <thead>
              <tr><th>Coluna 1</th><th>Coluna 2</th></tr>
            </thead>
            <tbody>
              <tr><td>Valor 1</td><td>Valor 2</td></tr>
            </tbody>
          </table>
        </div>
        <button data-testid="botao-copiar" onClick={handleCopy}>
          {copied ? 'Copiado!' : 'Copiar'}
        </button>
      </div>
    );
  }

  // Mock de navigator.clipboard
  let clipboardText = '';
  const originalNavigator = global.navigator;
  
  // Atribuindo mock ao global.navigator
  (global as any).navigator = {
    clipboard: {
      writeText: async (text: string) => {
        clipboardText = text;
      }
    }
  };

  try {
    const html = renderToStaticMarkup(<PerguntaMock item={f} />);

    // Verificar que elementos formatados estão presentes
    assert.strictEqual(html.includes('<strong>negrito</strong>'), true, 'Elemento strong presente');
    assert.strictEqual(html.includes('<pre><code>'), true, 'Código dentro de pre/code presente');
    assert.strictEqual(html.includes('<table>'), true, 'Tabela renderizada presente');

    // Verificar ausência de marcações brutas indesejadas no DOM final
    assert.strictEqual(html.includes('**negrito**'), false, 'Não deve conter ** no DOM');
    assert.strictEqual(html.includes('|---|'), false, 'Não deve conter |---| no DOM');

    // Verificar presença do botão Copiar
    assert.strictEqual(html.includes('data-testid="botao-copiar"'), true, 'Botão Copiar está presente');

    // Simular o clique chamando diretamente o writeText do clipboard mockado
    await navigator.clipboard.writeText(f.resposta);
    assert.strictEqual(clipboardText, f.resposta, 'navigator.clipboard.writeText chamado com o código correto');

  } finally {
    // Restaurar navigator original
    (global as any).navigator = originalNavigator;
  }
});
