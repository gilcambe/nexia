import { useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import { ALL_COLLECTIONS, getUserDoc, listUserDocs } from '@/lib/userData';

// Baixar todos os dados (direito do titular, LGPD art. 18). Fotos e arquivos vão junto, dentro do arquivo.
export default function MeusDados() {
  const { user } = useAuth();
  const [estado, setEstado] = useState<'' | 'baixando' | 'pronto' | 'erro'>('');
  const [semFotos, setSemFotos] = useState(true);

  const baixar = async () => {
    if (!user) return;
    setEstado('baixando');
    try {
      const dados: Record<string, unknown> = { exportado_em: new Date().toISOString(), app: 'NEXIA Body Coach', conta: user.email };
      for (const c of ALL_COLLECTIONS) {
        if (c === 'profile') { dados.perfil = await getUserDoc(user.id, 'profile', 'main'); continue; }
        const campo = c === 'meals' ? 'created_at' : c === 'workouts' ? 'done_at' : c === 'daily_readiness' ? 'check_in_date' : 'taken_at';
        const l = await listUserDocs<Record<string, unknown>>(user.id, c, campo).catch(() => []);
        dados[c] = semFotos ? JSON.parse(JSON.stringify(l, (_k, v) => (typeof v === 'string' && v.startsWith('data:') ? '[arquivo omitido]' : v))) : l;
      }
      if (semFotos && dados.perfil) dados.perfil = JSON.parse(JSON.stringify(dados.perfil, (_k, v) => (typeof v === 'string' && v.startsWith('data:') ? '[arquivo omitido]' : v)));
      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `body-coach-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      setEstado('pronto');
    } catch {
      setEstado('erro');
    }
  };

  return (
    <div className="space-y-3">
      <Card>
        <p className="text-sm text-foreground-600">Baixe uma cópia de tudo o que o Body Coach guarda sobre você: perfil, treinos, refeições, check-ins, evolução e exames. É um direito seu pela LGPD.</p>
        <label className="mt-3 flex items-center gap-2 text-sm text-foreground-700">
          <input type="checkbox" checked={!semFotos} onChange={(e) => setSemFotos(!e.target.checked)} className="h-4 w-4" />
          Incluir fotos e arquivos (o arquivo fica bem maior)
        </label>
        <button type="button" onClick={() => void baixar()} disabled={estado === 'baixando'} className="mt-3 w-full rounded-xl bg-primary-500 py-3 font-semibold text-background-50 disabled:opacity-60 dark:text-foreground-950">
          <i className="ri-download-2-line mr-1"></i>{estado === 'baixando' ? 'Preparando…' : 'Baixar meus dados'}
        </button>
        {estado === 'pronto' && <p className="mt-2 text-center text-sm text-emerald-700">Arquivo baixado.</p>}
        {estado === 'erro' && <p className="mt-2 text-center text-sm text-red-700">Não consegui baixar agora. Verifique a internet e tente de novo.</p>}
      </Card>
      <Card>
        <p className="text-sm text-foreground-600">Quer apagar a conta e todos os dados? Isso fica no seu Perfil.</p>
        <Link to="/profile" className="mt-2 inline-block text-sm font-semibold text-primary-700">Ir para o Perfil</Link>
      </Card>
    </div>
  );
}
