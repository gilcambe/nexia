import React, { useState } from 'react';

interface AvatarCorpoProps {
  volume?: Record<string, number>;
  onSelectMuscle?: (muscleKey: string) => void;
  selectedMuscle?: string | null;
}

export const AvatarCorpo: React.FC<AvatarCorpoProps> = ({
  volume = {},
  onSelectMuscle,
  selectedMuscle = null,
}) => {
  const [view, setView] = useState<'front' | 'back'>('front');
  const [hoveredMuscle, setHoveredMuscle] = useState<string | null>(null);

  // Calcula cor com base no volume (séries por semana)
  // Ex: 0 = cinza/neutro, 1-10 = azul/verde suave, 10-20 = amarelo/laranja, 20+ = vermelho/intenso
  const getMuscleColor = (muscleKey: string) => {
    const count = volume[muscleKey] || 0;
    if (count === 0) return '#e2e8f0'; // slate-200
    if (count < 6) return '#93c5fd';  // blue-300 (baixo)
    if (count < 12) return '#60a5fa'; // blue-400 (moderado)
    if (count < 18) return '#facc15'; // yellow-400 (bom)
    if (count < 25) return '#fb923c'; // orange-400 (alto)
    return '#f87171'; // red-400 (intenso/máximo)
  };

  const getStrokeColor = (muscleKey: string) => {
    if (selectedMuscle === muscleKey) return '#2563eb'; // blue-600
    if (hoveredMuscle === muscleKey) return '#3b82f6'; // blue-500
    return '#cbd5e1'; // slate-300
  };

  const musclesInfo: Record<string, { label: string; description?: string }> = {
    peito: { label: 'Peito' },
    ombros: { label: 'Ombros' },
    biceps: { label: 'Bíceps' },
    triceps: { label: 'Tríceps' },
    abdomen: { label: 'Abdômen' },
    costas: { label: 'Costas' },
    gluteos: { label: 'Glúteos' },
    quadriceps: { label: 'Quadríceps' },
    posterior: { label: 'Posterior de Coxa' },
    panturrilha: { label: 'Panturrilha' },
  };

  const activeMuscle = hoveredMuscle || selectedMuscle;

  return (
    <div className="flex flex-col items-center bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
      {/* Controles de visualização FRENTE / COSTAS */}
      <div className="flex items-center justify-between w-full mb-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
          Mapa Muscular
        </h3>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setView('front')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              view === 'front'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Frente
          </button>
          <button
            type="button"
            onClick={() => setView('back')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              view === 'back'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Costas
          </button>
        </div>
      </div>

      {/* SVG Container */}
      <div className="relative w-full max-w-[280px] h-[380px] flex items-center justify-center">
        <svg
          viewBox="0 0 200 400"
          className="w-full h-full drop-shadow-sm select-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {view === 'front' ? (
            /* VISTA FRONTAL */
            <g id="body-front">
              {/* Cabeça / Pescoço (Silhueta base inativa) */}
              <circle cx="100" cy="35" r="22" fill="#cbd5e1" opacity="0.6" />
              <path d="M92 55 L108 55 L112 70 L88 70 Z" fill="#cbd5e1" opacity="0.6" />

              {/* Ombros (Esquerdo e Direito) */}
              <g
                id="ombros-front"
                className="cursor-pointer transition-transform hover:scale-[1.02]"
                onClick={() => onSelectMuscle?.('ombros')}
                role="button"
                aria-label={musclesInfo.ombros.label}
                onMouseEnter={() => setHoveredMuscle('ombros')}
                onMouseLeave={() => setHoveredMuscle(null)}
              >
                <path
                  d="M72 72 Q60 75 52 90 L68 95 Q72 82 78 74 Z"
                  fill={getMuscleColor('ombros')}
                  stroke={getStrokeColor('ombros')}
                  strokeWidth="1.5"
                />
                <path
                  d="M128 72 Q140 75 148 90 L132 95 Q128 82 122 74 Z"
                  fill={getMuscleColor('ombros')}
                  stroke={getStrokeColor('ombros')}
                  strokeWidth="1.5"
                />
              </g>

              {/* Peito */}
              <g
                id="peito"
                className="cursor-pointer transition-transform hover:scale-[1.02]"
                onClick={() => onSelectMuscle?.('peito')}
                role="button"
                aria-label={musclesInfo.peito.label}
                onMouseEnter={() => setHoveredMuscle('peito')}
                onMouseLeave={() => setHoveredMuscle(null)}
              >
                <path
                  d="M78 75 Q100 72 100 98 Q76 98 78 75 Z"
                  fill={getMuscleColor('peito')}
                  stroke={getStrokeColor('peito')}
                  strokeWidth="1.5"
                />
                <path
                  d="M122 75 Q100 72 100 98 Q124 98 122 75 Z"
                  fill={getMuscleColor('peito')}
                  stroke={getStrokeColor('peito')}
                  strokeWidth="1.5"
                />
              </g>

              {/* Bíceps */}
              <g
                id="biceps"
                className="cursor-pointer transition-transform hover:scale-[1.02]"
                onClick={() => onSelectMuscle?.('biceps')}
                role="button"
                aria-label={musclesInfo.biceps.label}
                onMouseEnter={() => setHoveredMuscle('biceps')}
                onMouseLeave={() => setHoveredMuscle(null)}
              >
                <path
                  d="M50 95 Q42 115 48 135 L58 135 Q58 115 62 95 Z"
                  fill={getMuscleColor('biceps')}
                  stroke={getStrokeColor('biceps')}
                  strokeWidth="1.5"
                />
                <path
                  d="M150 95 Q158 115 152 135 L142 135 Q142 115 138 95 Z"
                  fill={getMuscleColor('biceps')}
                  stroke={getStrokeColor('biceps')}
                  strokeWidth="1.5"
                />
              </g>

              {/* Abdômen */}
              <g
                id="abdomen"
                className="cursor-pointer transition-transform hover:scale-[1.02]"
                onClick={() => onSelectMuscle?.('abdomen')}
                role="button"
                aria-label={musclesInfo.abdomen.label}
                onMouseEnter={() => setHoveredMuscle('abdomen')}
                onMouseLeave={() => setHoveredMuscle(null)}
              >
                <rect
                  x="80"
                  y="102"
                  width="40"
                  height="68"
                  rx="6"
                  fill={getMuscleColor('abdomen')}
                  stroke={getStrokeColor('abdomen')}
                  strokeWidth="1.5"
                />
                <line x1="100" y1="102" x2="100" y2="170" stroke="#fff" strokeWidth="1" opacity="0.4" />
                <line x1="80" y1="125" x2="120" y2="125" stroke="#fff" strokeWidth="1" opacity="0.4" />
                <line x1="80" y1="147" x2="120" y2="147" stroke="#fff" strokeWidth="1" opacity="0.4" />
              </g>

              {/* Antebraços / Mãos (base inativa) */}
              <path d="M48 140 L40 190 L52 190 L58 140 Z" fill="#cbd5e1" opacity="0.5" />
              <path d="M152 140 L160 190 L148 190 L142 140 Z" fill="#cbd5e1" opacity="0.5" />

              {/* Quadríceps */}
              <g
                id="quadriceps"
                className="cursor-pointer transition-transform hover:scale-[1.02]"
                onClick={() => onSelectMuscle?.('quadriceps')}
                role="button"
                aria-label={musclesInfo.quadriceps.label}
                onMouseEnter={() => setHoveredMuscle('quadriceps')}
                onMouseLeave={() => setHoveredMuscle(null)}
              >
                <path
                  d="M78 180 Q68 220 72 265 L98 265 Q98 220 96 180 Z"
                  fill={getMuscleColor('quadriceps')}
                  stroke={getStrokeColor('quadriceps')}
                  strokeWidth="1.5"
                />
                <path
                  d="M122 180 Q132 220 128 265 L102 265 Q102 220 104 180 Z"
                  fill={getMuscleColor('quadriceps')}
                  stroke={getStrokeColor('quadriceps')}
                  strokeWidth="1.5"
                />
              </g>

              {/* Panturrilha (Frente / Tibial) */}
              <g
                id="panturrilha-front"
                className="cursor-pointer transition-transform hover:scale-[1.02]"
                onClick={() => onSelectMuscle?.('panturrilha')}
                role="button"
                aria-label={musclesInfo.panturrilha.label}
                onMouseEnter={() => setHoveredMuscle('panturrilha')}
                onMouseLeave={() => setHoveredMuscle(null)}
              >
                <path
                  d="M74 278 Q68 310 74 350 L90 350 Q92 310 92 278 Z"
                  fill={getMuscleColor('panturrilha')}
                  stroke={getStrokeColor('panturrilha')}
                  strokeWidth="1.5"
                />
                <path
                  d="M126 278 Q132 310 126 350 L110 350 Q108 310 108 278 Z"
                  fill={getMuscleColor('panturrilha')}
                  stroke={getStrokeColor('panturrilha')}
                  strokeWidth="1.5"
                />
              </g>

              {/* Pés */}
              <path d="M68 355 L92 355 L95 370 L65 370 Z" fill="#cbd5e1" opacity="0.6" />
              <path d="M132 355 L108 355 L105 370 L135 370 Z" fill="#cbd5e1" opacity="0.6" />
            </g>
          ) : (
            /* VISTA TRASEIRA */
            <g id="body-back">
              {/* Cabeça / Pescoço costas */}
              <circle cx="100" cy="35" r="22" fill="#cbd5e1" opacity="0.6" />
              <path d="M90 52 L110 52 L112 68 L88 68 Z" fill="#cbd5e1" opacity="0.6" />

              {/* Ombros / Trapézio Costas */}
              <g
                id="ombros-back"
                className="cursor-pointer transition-transform hover:scale-[1.02]"
                onClick={() => onSelectMuscle?.('ombros')}
                role="button"
                aria-label={musclesInfo.ombros.label}
                onMouseEnter={() => setHoveredMuscle('ombros')}
                onMouseLeave={() => setHoveredMuscle(null)}
              >
                <path
                  d="M72 70 Q100 65 128 70 L145 85 L125 92 Q100 80 75 92 L55 85 Z"
                  fill={getMuscleColor('ombros')}
                  stroke={getStrokeColor('ombros')}
                  strokeWidth="1.5"
                />
              </g>

              {/* Costas (Dorsais / Lats) */}
              <g
                id="costas"
                className="cursor-pointer transition-transform hover:scale-[1.02]"
                onClick={() => onSelectMuscle?.('costas')}
                role="button"
                aria-label={musclesInfo.costas.label}
                onMouseEnter={() => setHoveredMuscle('costas')}
                onMouseLeave={() => setHoveredMuscle(null)}
              >
                <path
                  d="M78 92 Q100 82 122 92 L132 145 Q100 160 68 145 Z"
                  fill={getMuscleColor('costas')}
                  stroke={getStrokeColor('costas')}
                  strokeWidth="1.5"
                />
              </g>

              {/* Tríceps */}
              <g
                id="triceps"
                className="cursor-pointer transition-transform hover:scale-[1.02]"
                onClick={() => onSelectMuscle?.('triceps')}
                role="button"
                aria-label={musclesInfo.triceps.label}
                onMouseEnter={() => setHoveredMuscle('triceps')}
                onMouseLeave={() => setHoveredMuscle(null)}
              >
                <path
                  d="M54 95 Q44 115 50 135 L62 135 Q60 115 66 95 Z"
                  fill={getMuscleColor('triceps')}
                  stroke={getStrokeColor('triceps')}
                  strokeWidth="1.5"
                />
                <path
                  d="M146 95 Q156 115 150 135 L138 135 Q140 115 134 95 Z"
                  fill={getMuscleColor('triceps')}
                  stroke={getStrokeColor('triceps')}
                  strokeWidth="1.5"
                />
              </g>

              {/* Lombar / Parte inferior costas */}
              <path d="M74 148 L126 148 L122 175 L78 175 Z" fill={getMuscleColor('costas')} stroke={getStrokeColor('costas')} strokeWidth="1.5" />

              {/* Glúteos */}
              <g
                id="gluteos"
                className="cursor-pointer transition-transform hover:scale-[1.02]"
                onClick={() => onSelectMuscle?.('gluteos')}
                role="button"
                aria-label={musclesInfo.gluteos.label}
                onMouseEnter={() => setHoveredMuscle('gluteos')}
                onMouseLeave={() => setHoveredMuscle(null)}
              >
                <path
                  d="M77 178 Q100 175 100 178 L100 220 Q70 220 77 178 Z"
                  fill={getMuscleColor('gluteos')}
                  stroke={getStrokeColor('gluteos')}
                  strokeWidth="1.5"
                />
                <path
                  d="M123 178 Q100 175 100 178 L100 220 Q130 220 123 178 Z"
                  fill={getMuscleColor('gluteos')}
                  stroke={getStrokeColor('gluteos')}
                  strokeWidth="1.5"
                />
              </g>

              {/* Posterior de Coxa */}
              <g
                id="posterior"
                className="cursor-pointer transition-transform hover:scale-[1.02]"
                onClick={() => onSelectMuscle?.('posterior')}
                role="button"
                aria-label={musclesInfo.posterior.label}
                onMouseEnter={() => setHoveredMuscle('posterior')}
                onMouseLeave={() => setHoveredMuscle(null)}
              >
                <path
                  d="M76 225 Q68 250 74 275 L98 275 Q98 250 96 225 Z"
                  fill={getMuscleColor('posterior')}
                  stroke={getStrokeColor('posterior')}
                  strokeWidth="1.5"
                />
                <path
                  d="M124 225 Q132 250 126 275 L102 275 Q102 250 104 225 Z"
                  fill={getMuscleColor('posterior')}
                  stroke={getStrokeColor('posterior')}
                  strokeWidth="1.5"
                />
              </g>

              {/* Panturrilha (Costas) */}
              <g
                id="panturrilha"
                className="cursor-pointer transition-transform hover:scale-[1.02]"
                onClick={() => onSelectMuscle?.('panturrilha')}
                role="button"
                aria-label={musclesInfo.panturrilha.label}
                onMouseEnter={() => setHoveredMuscle('panturrilha')}
                onMouseLeave={() => setHoveredMuscle(null)}
              >
                <path
                  d="M74 285 Q64 315 72 350 L94 350 Q96 315 92 285 Z"
                  fill={getMuscleColor('panturrilha')}
                  stroke={getStrokeColor('panturrilha')}
                  strokeWidth="1.5"
                />
                <path
                  d="M126 285 Q136 315 128 350 L106 350 Q104 315 108 285 Z"
                  fill={getMuscleColor('panturrilha')}
                  stroke={getStrokeColor('panturrilha')}
                  strokeWidth="1.5"
                />
              </g>

              {/* Calcanhares / Pés */}
              <path d="M68 352 L94 352 L95 368 L67 368 Z" fill="#cbd5e1" opacity="0.6" />
              <path d="M132 352 L106 352 L105 368 L133 368 Z" fill="#cbd5e1" opacity="0.6" />
            </g>
          )}
        </svg>
      </div>

      {/* Legenda de Volume / Indicador do músculo selecionado ou em hover */}
      <div className="w-full mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
        {activeMuscle && musclesInfo[activeMuscle] ? (
          <div className="flex flex-col items-center animate-fade-in">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              {musclesInfo[activeMuscle].label}
            </span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">
              {volume[activeMuscle] || 0} séries esta semana
            </span>
          </div>
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Clique em um grupo muscular para ver detalhes
          </span>
        )}

        {/* Legenda de cores */}
        <div className="flex items-center justify-center gap-2 mt-4 text-[10px] text-slate-500">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-200 inline-block"></span>
            <span>0</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-300 inline-block"></span>
            <span>1-5</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block"></span>
            <span>6-11</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block"></span>
            <span>12-17</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-400 inline-block"></span>
            <span>18-24</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block"></span>
            <span>25+</span>
          </div>
        </div>
      </div>
    </div>
  );
};
