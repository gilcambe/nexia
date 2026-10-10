import type { Pose } from '@/lib/avaliacao/dados';

// Contorno-guia para a foto sair sempre igual: cabeça no topo, pés na linha de baixo.
export default function Silhueta({ pose, className = '' }: { pose: Pose; className?: string }) {
  const lado = pose === 'direita' || pose === 'esquerda';
  return (
    <svg viewBox="0 0 300 400" className={className} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <g fill="none" stroke="white" strokeWidth="3" strokeDasharray="8 6" opacity="0.9" transform={pose === 'esquerda' ? 'translate(300,0) scale(-1,1)' : undefined}>
        {lado ? (
          <>
            <ellipse cx="150" cy="52" rx="24" ry="28" />
            <path d="M140 80 L136 96 Q128 110 130 150 Q126 190 134 214 Q130 240 136 262 L140 352 L136 372 L166 372 L160 352 L162 262 Q170 236 166 212 Q176 188 172 150 Q178 116 164 96 L160 80" />
            <path d="M150 112 L246 118 M150 126 L246 128" />
          </>
        ) : (
          <>
            <ellipse cx="150" cy="50" rx="24" ry="28" />
            <path d="M138 78 L136 92 Q102 98 92 112 Q84 160 80 214 M162 78 L164 92 Q198 98 208 112 Q216 160 220 214" />
            <path d="M108 112 Q104 160 114 200 Q106 226 110 250 L118 372 L146 372 L148 262 L152 262 L154 372 L182 372 L190 250 Q194 226 186 200 Q196 160 192 112" />
          </>
        )}
        <line x1="40" y1="374" x2="260" y2="374" strokeDasharray="2 6" />
      </g>
    </svg>
  );
}
