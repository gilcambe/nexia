import { useEffect, useState } from 'react';
import Card from '@/components/base/Card';
import PainelAcesso from '@/components/feature/PainelAcesso';
import { PRECOS, verPlanoCoach, type PlanoCoach } from '@/lib/acesso';

// Plano do coach: Completo (o coach paga por faixa e os alunos não pagam) ou Parceiro (mais barato; cada aluno assina o Premium).
export default function MeuPlano() {
  const [p, setP] = useState<PlanoCoach | null>(null);
  const [msg, setMsg] = useState('');
  const carregar = (plano?: 'completo' | 'parceiro') => { setMsg(''); void verPlanoCoach(plano).then((r) => { setP(r); if (plano) setMsg('Plano trocado.'); }).catch((e) => setMsg((e as Error).message)); };
  useEffect(() => carregar(), []);
  if (!p) return <p className="text-sm text-foreground-500">{msg || 'Carregando...'}</p>;
  const ilimitado = (p.limite ?? 0) >= 9999;
  const passou = p.plano === 'completo' && !ilimitado && p.alunos > (p.limite ?? 0);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="font-heading text-2xl font-bold text-foreground-950">Meu plano</h1>
      {msg && <p role="status" className="rounded-lg bg-primary-50 p-2 text-sm text-primary-800">{msg}</p>}
      <Card>
        <p className="text-base text-foreground-700">Você tem <b>{p.alunos}</b> aluno(s).</p>
        {p.plano === 'completo'
          ? <p className="mt-1 text-base text-foreground-700">{ilimitado ? 'Todos os seus alunos usam o app de graça.' : <>Seu plano cobre <b>{p.limite}</b> aluno(s): eles usam o app de graça.</>}</p>
          : <p className="mt-1 text-base text-foreground-700">No plano Parceiro cada aluno assina o próprio Premium ({PRECOS.premium}).</p>}
        {passou && <p role="alert" className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{p.alunos - (p.limite ?? 0)} aluno(s) passaram da sua faixa e estão usando o teste deles. Suba de faixa para cobrir todos.</p>}
      </Card>
      <Card>
        <h2 className="font-semibold text-foreground-900">Quem paga o app dos alunos?</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button onClick={() => carregar('completo')} aria-pressed={p.plano === 'completo'} className={`rounded-xl border-2 p-3 text-left ${p.plano === 'completo' ? 'border-primary-500 bg-primary-50' : 'border-background-200'}`}>
            <p className="font-semibold text-foreground-900">Completo: eu pago</p>
            <p className="text-sm text-foreground-600">Os alunos não pagam nada. Grátis até 3 alunos; depois por faixa.</p>
          </button>
          <button onClick={() => carregar('parceiro')} aria-pressed={p.plano === 'parceiro'} className={`rounded-xl border-2 p-3 text-left ${p.plano === 'parceiro' ? 'border-primary-500 bg-primary-50' : 'border-background-200'}`}>
            <p className="font-semibold text-foreground-900">Parceiro: cada aluno paga</p>
            <p className="text-sm text-foreground-600">{PRECOS.parceiro}.</p>
          </button>
        </div>
      </Card>
      <PainelAcesso acesso={p} onVerDeNovo={() => carregar()} />
    </div>
  );
}
