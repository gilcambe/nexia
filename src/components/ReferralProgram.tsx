import React, { useState, useEffect } from \"react\";

interface ReferralRecord {
  friendEmail: string;
  date: string;
  status: 'pendente' | 'concluido';
  rewardGranted: boolean;
}

export function ReferralProgram() {
  const [copied, setCopied] = useState(false);
  const [referralCode, setReferralCode] = useState<string>(\"\");
  const [loading, setLoading] = useState<boolean>(true);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [stats, setStats] = useState({ totalReferred: 0, daysEarned: 0 });

  useEffect(() => {
    // Simula recuperação de código de indicação persistente do usuário logado
    const savedCode = localStorage.getItem(\"nexia_user_referral_code\");
    let code = savedCode;
    if (!code) {
      code = \"NEXIA-\" + Math.random().toString(36).substring(2, 8).toUpperCase();
      localStorage.setItem(\"nexia_user_referral_code\", code);
    }
    setReferralCode(code);

    // Carrega histórico de indicações salvas
    const savedReferrals = localStorage.getItem(\"nexia_user_referrals_history\");
    if (savedReferrals) {
      try {
        const parsed = JSON.parse(savedReferrals);
        setReferrals(parsed);
        const earned = parsed.filter((r: ReferralRecord) => r.rewardGranted).length * 7;
        setStats({ totalReferred: parsed.length, daysEarned: earned });
      } catch (e) {
        console.error(e);
      }
    } else {
      // Dados simulados iniciais para demonstração funcional
      const initialHistory: ReferralRecord[] = [
        { friendEmail: \"amigo1@exemplo.com\", date: \"2026-10-15\", status: \"concluido\", rewardGranted: true },
        { friendEmail: \"amigo2@exemplo.com\", date: \"2026-10-18\", status: \"pendente\", rewardGranted: false }
      ];
      setReferrals(initialHistory);
      localStorage.setItem(\"nexia_user_referrals_history\", JSON.stringify(initialHistory));
      setStats({ totalReferred: 2, daysEarned: 7 });
    }
    setLoading(false);
  }, []);

  const referralLink = `${window.location.origin}/?ref=${referralCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <div className=\"p-6 text-center text-gray-500\">Carregando programa de indicação...</div>;
  }

  return (
    <div className=\"bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6\">
      <div>
        <h3 className=\"text-lg font-semibold text-gray-900\">Programa de Indicação e Recompensas</h3>
        <p className=\"text-sm text-gray-600\">
          Indique amigos para o Nexia. Seu amigo ganha 15% de desconto na entrada e você ganha 7 dias grátis de acesso por indicação confirmada!
        </p>
      </div>

      <div className=\"bg-gray-50 rounded-lg p-4 space-y-3\">
        <label className=\"block text-xs font-medium text-gray-700 uppercase tracking-wider\">
          Seu código exclusivo e permanente
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
          Compartilhe este link. Crescimento sem anúncio e custo zero.
        </p>
      </div>

      <div className=\"grid grid-cols-2 gap-4 text-center\">
        <div className=\"bg-indigo-50/50 rounded-lg p-3 border border-indigo-100\">
          <span className=\"block text-2xl font-bold text-indigo-600\">{stats.daysEarned} dias</span>
          <span className=\"text-xs text-gray-600\">Dias grátis acumulados</span>
        </div>
        <div className=\"bg-emerald-50/50 rounded-lg p-3 border border-emerald-100\">
          <span className=\"block text-2xl font-bold text-emerald-600\">{stats.totalReferred} amigos</span>
          <span className=\"text-xs text-gray-600\">Indicações realizadas</span>
        </div>
      </div>

      <div className=\"space-y-3 pt-2 border-t border-gray-100\">
        <h4 className=\"text-sm font-semibold text-gray-900\">Histórico de Indicações</h4>
        {referrals.length === 0 ? (
          <p className=\"text-xs text-gray-500\">Nenhuma indicação realizada ainda. Compartilhe seu link!</p>
        ) : (
          <div className=\"divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden\">
            {referrals.map((ref, idx) => (
              <div key={idx} className=\"p-3 flex items-center justify-between text-xs bg-white hover:bg-gray-50 transition-colors\">\n                <div>\n                  <span className=\"font-medium text-gray-800\">{ref.friendEmail}</span>\n                  <span className=\"block text-gray-400 text-[10px]\">Data: {ref.date}</span>\n                </div>\n                <div>\n                  {ref.status === 'concluido' ? (
                    <span className=\"px-2 py-1 bg-emerald-100 text-emerald-800 rounded-full font-medium\">Concluído (+7d)</span>
                  ) : (
                    <span className=\"px-2 py-1 bg-amber-100 text-amber-800 rounded-full font-medium\">Pendente</span>
                  )}\n                </div>\n              </div>\n            ))}
          </div>
        )}
      </div>
    </div>
  );
}
