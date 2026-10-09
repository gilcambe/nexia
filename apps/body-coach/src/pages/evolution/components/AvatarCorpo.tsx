// Silhueta do corpo (frente) com cada músculo colorido pelo volume da semana (séries por grupo).
// Sem treino: tudo cinza. A cor sobe de intensidade em 5, 10 e 18 séries.
type Props = { volume: Record<string, number> };

function cor(n: number): string {
  if (n >= 18) return '#1d4ed8';
  if (n >= 10) return '#3b82f6';
  if (n >= 5) return '#93c5fd';
  if (n > 0) return '#dbeafe';
  return '#e5e7eb';
}

export default function AvatarCorpo({ volume }: Props) {
  const v = (g: string) => cor(volume[g] ?? 0);
  const total = Object.values(volume).reduce((a, b) => a + b, 0);
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 120 240" className="h-64 w-auto" role="img" aria-label="Corpo com os músculos treinados na semana">
        <circle cx="60" cy="18" r="13" fill="#e5e7eb" />
        <rect x="54" y="30" width="12" height="9" rx="3" fill="#e5e7eb" />
        {/* ombros */}
        <ellipse cx="34" cy="48" rx="11" ry="9" fill={v('ombros')} />
        <ellipse cx="86" cy="48" rx="11" ry="9" fill={v('ombros')} />
        {/* peito */}
        <path d="M44 42 Q60 38 76 42 L76 62 Q60 68 44 62 Z" fill={v('peito')} />
        {/* abdômen */}
        <rect x="47" y="66" width="26" height="38" rx="6" fill={v('abdomen')} />
        {/* bíceps e tríceps (braços) */}
        <rect x="19" y="56" width="11" height="26" rx="5" fill={v('biceps')} />
        <rect x="90" y="56" width="11" height="26" rx="5" fill={v('biceps')} />
        <rect x="21" y="84" width="9" height="26" rx="4" fill={v('triceps')} />
        <rect x="90" y="84" width="9" height="26" rx="4" fill={v('triceps')} />
        {/* costas (faixas laterais) */}
        <path d="M40 46 L44 64 L46 100 L40 100 Z" fill={v('costas')} />
        <path d="M80 46 L76 64 L74 100 L80 100 Z" fill={v('costas')} />
        {/* glúteos / quadril */}
        <rect x="42" y="106" width="36" height="14" rx="6" fill={v('gluteos')} />
        {/* quadríceps */}
        <rect x="41" y="122" width="16" height="48" rx="7" fill={v('quadriceps')} />
        <rect x="63" y="122" width="16" height="48" rx="7" fill={v('quadriceps')} />
        {/* posterior (lateral externa da coxa) */}
        <rect x="37" y="126" width="5" height="40" rx="2.5" fill={v('posterior')} />
        <rect x="78" y="126" width="5" height="40" rx="2.5" fill={v('posterior')} />
        {/* panturrilhas */}
        <rect x="42" y="176" width="13" height="42" rx="6" fill={v('panturrilha')} />
        <rect x="65" y="176" width="13" height="42" rx="6" fill={v('panturrilha')} />
      </svg>
      <p className="mt-2 text-center text-xs text-foreground-500">
        {total === 0 ? 'Faça um treino para o seu corpo acender aqui.' : 'Quanto mais azul, mais séries na semana.'}
      </p>
    </div>
  );
}
