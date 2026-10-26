import React, { useState, useEffect } from 'react';

export default function CortexApiPage() {
  const [apiKey, setApiKey] = useState('cortex_sk_exemplo123...');
  const [copied, setCopied] = useState('');

  const curlExample = `curl -X POST https://nexia-c8710.pages.dev/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{"model": "cortex-rapido", "messages": [{"role": "user", "content": "Olá Cortex!"}], "stream": true}'`;

  const pythonExample = `from openai import OpenAI

client = OpenAI(
    api_key="${apiKey}",
    base_url="https://nexia-c8710.pages.dev/v1"
)

response = client.chat.completions.create(
    model="cortex-pensar",
    messages=[{"role": "user", "content": "Escreva um script em Python."}],
    stream=True
)

for chunk in response:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="")`;

  const continueExample = `// .continue/config.json
{
  "models": [
    {
      "title": "Cortex Pesquisar",
      "provider": "openai",
      "model": "cortex-pesquisar",
      "apiKey": "${apiKey}",
      "apiBase": "https://nexia-c8710.pages.dev/v1"
    }
  ]
}`;

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100 p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-gray-800 pb-6">
          <div className="flex items-center space-x-3 mb-2">
            <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 text-xs font-mono rounded-full border border-cyan-500/20">
              Pilar 6 • API OpenAI Compatible
            </span>
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-mono rounded-full border border-emerald-500/20">
              100% Gratuito
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Cortex API & Integrações</h1>
          <p className="text-gray-400 mt-2">
            Use o Cortex em qualquer ferramenta compatível com OpenAI (cURL, Python, VS Code Continue, Cline, n8n, etc.).
          </p>
        </div>

        {/* Chave de API Config */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center justify-between">
            <span>Sua Chave de Teste / Exemplo</span>
            <a href="/cortex/keys" className="text-xs text-cyan-400 hover:underline">Gerenciar chaves reais →</a>
          </h2>
          <p className="text-sm text-gray-400">
            Insira sua chave de API para atualizar os exemplos abaixo automaticamente.
          </p>
          <input
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="cortex_sk_..."
            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-sm font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Exemplos */}
        <div className="space-y-6">
          {/* cURL */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
              <span className="text-sm font-mono text-gray-300">1. cURL (Streaming)</span>
              <button
                onClick={() => copyToClipboard(curlExample, 'curl')}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded transition"
              >
                {copied === 'curl' ? '✅ Copiado!' : 'Copiar'}
              </button>
            </div>
            <pre className="p-6 text-sm font-mono text-cyan-300 overflow-x-auto bg-gray-950">
              <code>{curlExample}</code>
            </pre>
          </div>

          {/* Python */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
              <span className="text-sm font-mono text-gray-300">2. Python (SDK OpenAI)</span>
              <button
                onClick={() => copyToClipboard(pythonExample, 'python')}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded transition"
              >
                {copied === 'python' ? '✅ Copiado!' : 'Copiar'}
              </button>
            </div>
            <pre className="p-6 text-sm font-mono text-cyan-300 overflow-x-auto bg-gray-950">
              <code>{pythonExample}</code>
            </pre>
          </div>

          {/* Continue / VS Code */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-800">
              <span className="text-sm font-mono text-gray-300">3. VS Code Continue (.continue/config.json)</span>
              <button
                onClick={() => copyToClipboard(continueExample, 'continue')}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded transition"
              >
                {copied === 'continue' ? '✅ Copiado!' : 'Copiar'}
              </button>
            </div>
            <pre className="p-6 text-sm font-mono text-cyan-300 overflow-x-auto bg-gray-950">
              <code>{continueExample}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
