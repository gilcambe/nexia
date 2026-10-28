import React, { useState } from 'react';
import './CodeBlock.css';

export default function CodeBlock({ code = '', language = 'javascript' }) {
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = () => {
    setOutput('');
    setError('');
    setIsRunning(true);
  };

  const handleStop = () => {
    setIsRunning(false);
  };

  const handleFix = () => {
    setOutput('');
    setError('');
    setIsRunning(true);
  };

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-language">{language}</span>
        <div className="code-block-actions">
          <button
            type="button"
            className="code-btn run"
            onClick={handleRun}
            disabled={isRunning}
            aria-label="Rodar código"
          >
            ▶ Rodar
          </button>
          <button
            type="button"
            className="code-btn stop"
            onClick={handleStop}
            disabled={!isRunning}
            aria-label="Parar execução"
          >
            ⏹ Parar
          </button>
          <button
            type="button"
            className="code-btn fix"
            onClick={handleFix}
            aria-label="Corrigir com o Cortex"
          >
            🛠 Corrigir com o Cortex
          </button>
        </div>
      </div>

      <pre className="code-block-code">
        <code>{code}</code>
      </pre>

      {output && (
        <div className="code-block-output">
          <strong>Saída:</strong>
          <pre>{output}</pre>
        </div>
      )}

      {error && (
        <div className="code-block-error">
          <strong>Erro:</strong>
          <pre>{error}</pre>
        </div>
      )}
    </div>
  );
}