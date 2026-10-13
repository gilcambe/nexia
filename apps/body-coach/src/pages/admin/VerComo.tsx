import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@/components/base/Card';
import { mudarVerComo, verComo, type VerComo as Tipo } from '@/lib/verComo';

const OPCOES: { v: Tipo | null; label: string; ir: string }[] = [
  { v: 'coach', label: 'Coach', ir: '/coach/alunos' },
  { v: 'aluno', label: 'Aluno de coach', ir: '/' },
  { v: 'nenhum', label: 'Treina sozinho', ir: '/' },
  { v: null, label: 'Minha conta real', ir: '/' },
];

// O admin testa as 3 versões do app sem criar outras contas.
export default function VerComo() {
  const navigate = useNavigate();
  const [atual, setAtual] = useState(verComo());
  return (
    <Card>
      <h2 className="font-semibold text-foreground-900">Ver o app como</h2>
      <p className="text-sm text-foreground-500">Troca só as telas deste aparelho. Sua conta continua grátis e com tudo liberado.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {OPCOES.map((o) => (
          <button key={o.label} data-testid={`ver-como-${o.v ?? 'real'}`} onClick={() => { mudarVerComo(o.v); setAtual(o.v); navigate(o.ir); }}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${atual === o.v ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-background-200 text-foreground-700'}`}>
            {o.label}
          </button>
        ))}
      </div>
    </Card>
  );
}
