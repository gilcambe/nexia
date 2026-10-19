import React, { useState } from \"react\";

export function ReferralProgram() {
  const [copied, setCopied] = useState(false);
  const referralCode = \"NEXIA-\" + Math.random().toString(36).substring(2, 8).toUpperCase();
  const referralLink = `${window.location.origin}/?ref=${referralCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className=\"bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4\">
      <div>
        <h3 className=\"text-lg font-semibold text-gray-900\">Programa de Indicação</h3>
        <p className=\"text-sm text-gray-600\">
          Indique amigos para o Nexia. Seu amigo ganha desconto na entrada e você ganha dias grátis de acesso!
        </p>
      </div>

      <div className=\"bg-gray-50 rounded-lg p-4 space-y-3\">
        <label className=\"block text-xs font-medium text-gray-700 uppercase tracking-wider\">
          Seu código exclusivo de indicação
        </label>
        <div className=\"flex items-center gap-2\">
          <input
            type=\"text\"
            readOnly
            value={referralCode}
            className=\"bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-gray-800 w-full focus:outline-none\"
          />
          <button
            onClick={handleCopy}
            className=\"bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors whitespace-nowrap\"
          >
            {copied ? \"Copiado!\" : \"Copiar Link\"}
          </button>
        </div>
        <p className=\"text-xs text-gray-500\">
          Compartilhe este link com seus amigos. Crescimento sem anúncio e custo zero.
        </p>
      </div>

      <div className=\"grid grid-cols-2 gap-4 pt-2 border-t border-gray-100 text-center\">
        <div className=\"bg-indigo-50/50 rounded-lg p-3\">
          <span className=\"block text-2xl font-bold text-indigo-600\">7 dias</span>
          <span className=\"text-xs text-gray-600\">Grátis para cada indicação</span>
        </div>
        <div className=\"bg-emerald-50/50 rounded-lg p-3\">
          <span className=\"block text-2xl font-bold text-emerald-600\">15% OFF</span>
          <span className=\"text-xs text-gray-600\">Desconto para o amigo</span>
        </div>
      </div>
    </div>
  );
}
