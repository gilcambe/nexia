import type { Segmento } from '@/lib/avaliacao/calculos';

// Silhueta simples com o valor de cada segmento (tronco, braços e pernas), como na balança.
// E = esquerdo da pessoa (fica à direita de quem olha a figura de frente).
export default function CorpoSegmentos({
  titulo, valores, unidade, cor,
}: {
  titulo: string;
  valores: Partial<Record<Segmento, number>>;
  unidade: string;
  cor: string;
}) {
  const t = (s: Segmento) => (valores[s] == null ? '–' : `${valores[s]!.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}${unidade}`);
  return (
    <figure className="text-center">
      <figcaption className="mb-1 text-xs font-semibold">{titulo}</figcaption>
      <svg viewBox="0 0 200 220" className="mx-auto w-full max-w-[220px]" role="img" aria-label={titulo}>
        <g fill={cor} fillOpacity="0.18" stroke={cor} strokeWidth="1.5">
          <circle cx="100" cy="22" r="14" />
          <rect x="76" y="40" width="48" height="74" rx="10" />
          <rect x="54" y="44" width="16" height="70" rx="8" />
          <rect x="130" y="44" width="16" height="70" rx="8" />
          <rect x="78" y="118" width="19" height="90" rx="9" />
          <rect x="103" y="118" width="19" height="90" rx="9" />
        </g>
        <g fontSize="11" fontWeight="700" fill="#1f2328" textAnchor="middle">
          <text x="100" y="82">{t('tronco')}</text>
          <text x="26" y="80">{t('braco_d')}</text>
          <text x="174" y="80">{t('braco_e')}</text>
          <text x="52" y="168">{t('perna_d')}</text>
          <text x="148" y="168">{t('perna_e')}</text>
        </g>
        <g fontSize="8" fill="#868e96" textAnchor="middle">
          <text x="26" y="92">braço D</text>
          <text x="174" y="92">braço E</text>
          <text x="52" y="180">perna D</text>
          <text x="148" y="180">perna E</text>
        </g>
      </svg>
    </figure>
  );
}
