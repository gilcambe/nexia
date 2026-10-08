import React from 'react';

/** Grupos musculares suportados pelo componente */
export type GrupoMuscular =
  | 'peito'
  | 'ombros'
  | 'bíceps'
  | 'tríceps'
  | 'abdômen'
  | 'costas'
  | 'glúteos'
  | 'quadríceps'
  | 'posterior'
  | 'panturrilha';

/** Volume por grupo muscular (séries por grupo) */
export type VolumePorGrupo = Record<GrupoMuscular, number>;

interface AvatarCorpoProps {
  /** Volume de treino por grupo muscular (número de séries) */
  volume: Partial<VolumePorGrupo>;
  /** Cor primária para os músculos (padrão: var(--primary)) */
  color?: string;
  /** Séries máximas para opacidade total (padrão: 20) */
  maxSeries?: number;
  /** Largura do SVG em pixels (padrão: 200) */
  width?: number;
  /** Altura do SVG em pixels (padrão: 400) */
  height?: number;
  /** Rótulo acessível para a visão frontal */
  ariaLabelFront?: string;
  /** Rótulo acessível para a visão traseira */
  ariaLabelBack?: string;
}

/** Séries padrão para opacidade máxima */
const DEFAULT_MAX_SERIES = 20;

/** Cor padrão usando variável CSS do projeto */
const DEFAULT_COLOR = 'var(--primary)';

/**
 * Calcula opacidade baseada no volume (0 a 1)
 * @param vol Volume (séries) do grupo muscular
 * @param maxSeries Séries necessárias para opacidade 1
 */
const getOpacity = (vol: number, maxSeries: number): number => {
  return Math.min(1, vol / maxSeries);
};

/**
 * Gera o ID único para o title do SVG
 */
const generateTitleId = (prefix: string): string => {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
};

export const AvatarCorpo: React.FC<AvatarCorpoProps> = ({
  volume,
  color = DEFAULT_COLOR,
  maxSeries = DEFAULT_MAX_SERIES,
  width = 200,
  height = 400,
  ariaLabelFront = 'Silhueta humana de frente mostrando volume muscular por grupo',
  ariaLabelBack = 'Silhueta humana de costas mostrando volume muscular por grupo',
}) => {
  const frontTitleId = generateTitleId('avatar-front-title');
  const backTitleId = generateTitleId('avatar-back-title');

  return (
    <div className="flex items-center justify-center space-x-8 w-full">
      {/* Front view */}
      <svg
        className="w-full h-auto max-w-xs"
        viewBox={`0 0 ${width} ${height}`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={ariaLabelFront}
        aria-labelledby={frontTitleId}
      >
        <title id={frontTitleId}>{ariaLabelFront}</title>
        {/* Outline of front silhouette - improved path matching muscle positions */}
        <path
          d="M60,30 Q100,10 140,30 L145,80 Q100,60 55,80 Z M55,80 L45,180 Q50,220 65,240 L65,320 Q60,360 80,380 L120,380 Q140,360 135,320 L135,240 Q150,220 155,180 L145,80"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.3"
        />
        {/* Muscle groups for front */}
        {/* Chest / Peito */}
        <ellipse
          cx="100"
          cy="55"
          rx="32"
          ry="22"
          fill={color}
          fillOpacity={getOpacity(volume.peito ?? 0, maxSeries)}
        />
        {/* Shoulders / Ombros */}
        <ellipse
          cx="65"
          cy="65"
          rx="18"
          ry="14"
          fill={color}
          fillOpacity={getOpacity(volume.ombros ?? 0, maxSeries)}
        />
        <ellipse
          cx="135"
          cy="65"
          rx="18"
          ry="14"
          fill={color}
          fillOpacity={getOpacity(volume.ombros ?? 0, maxSeries)}
        />
        {/* Biceps / Bíceps - front upper arm */}
        <path
          d="M50,85 Q60,80 65,95 L65,150 Q60,165 50,160 Z"
          fill={color}
          fillOpacity={getOpacity(volume['bíceps'] ?? 0, maxSeries)}
        />
        <path
          d="M150,85 Q140,80 135,95 L135,150 Q140,165 150,160 Z"
          fill={color}
          fillOpacity={getOpacity(volume['bíceps'] ?? 0, maxSeries)}
        />
        {/* Abs / Abdômen */}
        <path
          d="M75,145 L125,145 Q130,180 125,210 L75,210 Q70,180 75,145 Z"
          fill={color}
          fillOpacity={getOpacity(volume.abdômen ?? 0, maxSeries)}
        />
        {/* Quads / Quadríceps - front thigh */}
        <path
          d="M65,210 L95,210 Q100,260 95,290 L65,290 Q60,260 65,210 Z"
          fill={color}
          fillOpacity={getOpacity(volume.quadríceps ?? 0, maxSeries)}
        />
        <path
          d="M105,210 L135,210 Q140,260 135,290 L105,290 Q100,260 105,210 Z"
          fill={color}
          fillOpacity={getOpacity(volume.quadríceps ?? 0, maxSeries)}
        />
        {/* Calves / Panturrilha - front */}
        <path
          d="M70,290 L90,290 Q92,330 90,350 L70,350 Q68,330 70,290 Z"
          fill={color}
          fillOpacity={getOpacity(volume.panturrilha ?? 0, maxSeries)}
        />
        <path
          d="M110,290 L130,290 Q132,330 130,350 L110,350 Q108,330 110,290 Z"
          fill={color}
          fillOpacity={getOpacity(volume.panturrilha ?? 0, maxSeries)}
        />
      </svg>

      {/* Back view */}
      <svg
        className="w-full h-auto max-w-xs"
        viewBox={`0 0 ${width} ${height}`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={ariaLabelBack}
        aria-labelledby={backTitleId}
      >
        <title id={backTitleId}>{ariaLabelBack}</title>
        {/* Outline of back silhouette - improved path matching muscle positions */}
        <path
          d="M60,30 Q100,10 140,30 L145,80 Q100,60 55,80 Z M55,80 L45,180 Q50,220 65,240 L65,320 Q60,360 80,380 L120,380 Q140,360 135,320 L135,240 Q150,220 155,180 L145,80"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.3"
        />
        {/* Back / Costas */}
        <ellipse
          cx="100"
          cy="55"
          rx="35"
          ry="25"
          fill={color}
          fillOpacity={getOpacity(volume.costas ?? 0, maxSeries)}
        />
        {/* Shoulders / Ombros - back */}
        <ellipse
          cx="65"
          cy="65"
          rx="18"
          ry="14"
          fill={color}
          fillOpacity={getOpacity(volume.ombros ?? 0, maxSeries)}
        />
        <ellipse
          cx="135"
          cy="65"
          rx="18"
          ry="14"
          fill={color}
          fillOpacity={getOpacity(volume.ombros ?? 0, maxSeries)}
        />
        {/* Triceps / Tríceps - back upper arm */}
        <path
          d="M50,85 Q60,80 65,95 L65,150 Q60,165 50,160 Z"
          fill={color}
          fillOpacity={getOpacity(volume.tríceps ?? 0, maxSeries)}
        />
        <path
          d="M150,85 Q140,80 135,95 L135,150 Q140,165 150,160 Z"
          fill={color}
          fillOpacity={getOpacity(volume.tríceps ?? 0, maxSeries)}
        />
        {/* Glutes / Glúteos */}
        <ellipse
          cx="80"
          cy="240"
          rx="28"
          ry="18"
          fill={color}
          fillOpacity={getOpacity(volume.glúteos ?? 0, maxSeries)}
        />
        <ellipse
          cx="120"
          cy="240"
          rx="28"
          ry="18"
          fill={color}
          fillOpacity={getOpacity(volume.glúteos ?? 0, maxSeries)}
        />
        {/* Hamstrings / Posterior - back thigh */}
        <path
          d="M65,210 L95,210 Q100,260 95,290 L65,290 Q60,260 65,210 Z"
          fill={color}
          fillOpacity={getOpacity(volume.posterior ?? 0, maxSeries)}
        />
        <path
          d="M105,210 L135,210 Q140,260 135,290 L105,290 Q100,260 105,210 Z"
          fill={color}
          fillOpacity={getOpacity(volume.posterior ?? 0, maxSeries)}
        />
        {/* Calves / Panturrilha - back */}
        <path
          d="M70,290 L90,290 Q92,330 90,350 L70,350 Q68,330 70,290 Z"
          fill={color}
          fillOpacity={getOpacity(volume.panturrilha ?? 0, maxSeries)}
        />
        <path
          d="M110,290 L130,290 Q132,330 130,350 L110,350 Q108,330 110,290 Z"
          fill={color}
          fillOpacity={getOpacity(volume.panturrilha ?? 0, maxSeries)}
        />
      </svg>
    </div>
  );
};

