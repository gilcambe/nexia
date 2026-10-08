import React from 'react';

export interface AvatarCorpoProps {
  /**
   * Dicionário de volume (séries por grupo muscular ou métrica similar).
   * Ex: { peito: 12, ombros: 8, biceps: 6, triceps: 6, abdos: 10, costas: 14, gluteos: 8, quadriceps: 16, posterior: 10, panturrilha: 12 }
   */
  volume?: Record<string, number>;
  /**
   * Função opcional chamada ao clicar em um grupo muscular.
   */
  onMuscleClick?: (muscleKey: string) => void;
  /**
   * Classe CSS opcional para o container principal.
   */
  className?: string;
}

/**
 * Retorna uma cor de preenchimento baseada no volume de séries.
 * Quanto maior o volume, mais intensa (avermelhada/aquecida) fica a cor.
 */
function getMuscleColor(value: number = 0): string {
  if (value <= 0) return '#e2e8f0'; // slate-200 (cinza neutro)
  if (value < 5) return '#bfdbfe';  // blue-200 (baixo)
  if (value < 10) return '#60a5fa'; // blue-400 (moderado)
  if (value < 16) return '#3b82f6'; // blue-500 (bom)
  if (value < 22) return '#f97316'; // orange-500 (alto)
  return '#ef4444';                 // red-500 (muito alto/intenso)
}

export const AvatarCorpo: React.FC<AvatarCorpoProps> = ({
  volume = {},
  onMuscleClick,
  className = '',
}) => {
  const [activeTab, setActiveTab] = React.useState<'frente' | 'costas'>('frente');
  const [hoveredMuscle, setHoveredMuscle] = React.useState<string | null>(null);

  // Helper para lidar com cliques e hover
  const getMuscleProps = (key: string, label: string) => ({
    fill: getMuscleColor(volume[key] || 0),
    className: "transition-colors duration-200 cursor-pointer hover:opacity-80 stroke-white stroke-1",
    onClick: () => onMuscleClick && onMuscleClick(key),
    onMouseEnter: () => setHoveredMuscle(`${label}: ${volume[key] || 0} séries`),
    onMouseLeave: () => setHoveredMuscle(null),
  });

  return (
    <div className={`flex flex-col items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 ${className}`}>
      {/* Seletor de Visão (Frente / Costas) */}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg mb-4 w-full max-w-xs">
        <button
          type="button"
          onClick={() => setActiveTab('frente')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
            activeTab === 'frente'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Frente
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('costas')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
            activeTab === 'costas'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Costas
        </button>
      </div>

      {/* Tooltip / Legenda flutuante */}
      <div className="h-6 mb-2 text-xs font-medium text-slate-600 dark:text-slate-300 text-center">
        {hoveredMuscle ? hoveredMuscle : <span className="text-slate-400 font-normal">Passe o mouse ou toque para ver detalhes</span>}
      </div>

      {/* SVG Container */}
      <div className="relative w-48 h-96 flex items-center justify-center">
        {activeTab === 'frente' ? (
          <svg viewBox="0 0 200 400" className="w-full h-full drop-shadow-sm">
            {/* Cabeça / Pescoço (Silhueta base) */}
            <circle cx="100" cy="40" r="22" fill="#cbd5e1" className="stroke-white stroke-1" />
            <path d="M90 60 L110 60 L115 75 L85 75 Z" fill="#cbd5e1" className="stroke-white stroke-1" />

            {/* Ombros (Esquerdo e Direito) */}
            <path
              d="M75 75 L55 90 L75 110 L85 85 Z"
              {...getMuscleProps('ombros', 'Ombros')}
            />
            <path
              d="M125 75 L145 90 L125 110 L115 85 Z"
              {...getMuscleProps('ombros', 'Ombros')}
            />

            {/* Peito (Peitorais) */}
            <path
              d="M85 85 L115 85 L118 120 L100 125 L82 120 Z"
              {...getMuscleProps('peito', 'Peito')}
            />

            {/* Bíceps */}
            <path
              d="M50 95 L38 125 L48 130 L58 100 Z"
              {...getMuscleProps('biceps', 'Bíceps')}
            />
            <path
              d="M150 95 L162 125 L152 130 L142 100 Z"
              {...getMuscleProps('biceps', 'Bíceps')}
            />

            {/* Abdômen */}
            <path
              d="M84 128 L116 128 L114 185 L86 185 Z"
              {...getMuscleProps('abdominol', 'Abdômen')}
            />

            {/* Quadríceps */}
            <path
              d="M83 195 L117 195 L112 280 L88 280 Z"
              {...getMuscleProps('quadriceps', 'Quadríceps')}
            />

            {/* Panturrilha (Frente / Tíbia) */}
            <path
              d="M88 290 L112 290 L108 365 L92 365 Z"
              {...getMuscleProps('panturrilha', 'Panturrilha')}
            />

            {/* Pés */}
            <path d="M80 365 L92 365 L85 380 L70 380 Z" fill="#cbd5e1" />
            <path d="M120 365 L108 365 L115 380 L130 380 Z" fill="#cbd5e1" />
          </svg>
        ) : (
          <svg viewBox="0 0 200 400" className="w-full h-full drop-shadow-sm">
            {/* Cabeça / Pescoço (Silhueta base costas) */}
            <circle cx="100" cy="40" r="22" fill="#cbd5e1" className="stroke-white stroke-1" />
            <path d="M90 60 L110 60 L115 75 L85 75 Z" fill="#cbd5e1" className="stroke-white stroke-1" />

            {/* Costas / Trapézio / Dorsais */}
            <path
              d="M85 78 L115 78 L122 135 L100 145 L78 135 Z"
              {...getMuscleProps('costas', 'Costas')}
            />

            {/* Tríceps */}
            <path
              d="M50 95 L38 125 L48 130 L58 100 Z"
              {...getMuscleProps('triceps', 'Tríceps')}
            />
            <path
              d="M150 95 L162 125 L152 130 L142 100 Z"
              {...getMuscleProps('triceps', 'Tríceps')}
            />

            {/* Glúteos */}
            <path
              d="M83 185 L117 185 L115 225 L85 225 Z"
              {...getMuscleProps('gluteos', 'Glúteos')}
            />

            {/* Posterior de Coxa */}
            <path
              d="M85 230 L115 230 L112 280 L88 280 Z"
              {...getMuscleProps('posterior', 'Posterior de Coxa')}
            />

            {/* Panturrilha (Costas) */}
            <path
              d="M87 290 L113 290 L108 365 L92 365 Z"
              {...getMuscleProps('panturrilha', 'Panturrilha')}
            />

            {/* Calcanhares */}
            <circle cx="100" cy="370" r="10" fill="#cbd5e1" />
          </svg>
        )}
      </div>

      {/* Legenda de Cores */}
      <div className="flex items-center justify-center gap-2 mt-4 text-[10px] text-slate-500 dark:text-slate-400 flex-wrap">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-200 inline-block"></span> 0</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-200 inline-block"></span> &lt;5</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block"></span> 5-9</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span> 10-15</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"></span> 16-21</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span> 22+</span>
      </div>
    </div>
  );
};

export default AvatarCorpo;
