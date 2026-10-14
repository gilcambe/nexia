import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TESTADOR, fecharBannerTestador, mostrarBannerTestador } from '@/lib/testador';

// Convite no Hoje para testar o app Android (só no navegador do Android, fora do app instalado).
export default function ConviteTestador() {
  const [ver, setVer] = useState(mostrarBannerTestador);
  if (!ver) return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-3" data-testid="convite-testador">
      <i className="ri-android-line text-2xl text-emerald-700"></i>
      <Link to="/testador" className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground-950">Teste o app Android e ganhe {TESTADOR.diasPremium} dias de Premium</span>
        <span className="block text-xs text-foreground-600">3 passos rápidos no Google Play.</span>
      </Link>
      <button type="button" onClick={() => { fecharBannerTestador(); setVer(false); }} aria-label="Agora não" className="p-1 text-foreground-400"><i className="ri-close-line text-lg"></i></button>
    </div>
  );
}
