import React from "react";

interface MuscleGroup {
  name: string;
  color: string;
}

interface AvatarCorpoProps {
  volume: Record<string, number>;
}

const MuscleColors: Record<string, string> = {
  peito: "#FF6B6B",
  ombros: "#FF8C42",
  biceps: "#4ECDC4",
  triceps: "#44A08C",
  abdomen: "#96CEB4",
  costas: "#5F27CD",
  gluteos: "#6C5CE7",
  quadriceps: "#00B894",
  posterior: "#5856E9",
  panturrilha: "#00ACC1",
};

const MuscleGroups: MuscleGroup[] = [
  { name: "peito", color: MuscleColors.peito },
  { name: "ombros", color: MuscleColors.ombros },
  { name: "biceps", color: MuscleColors.biceps },
  { name: "triceps", color: MuscleColors.triceps },
  { name: "abdomen", color: MuscleColors.abdomen },
  { name: "costas", color: MuscleColors.costas },
  { name: "gluteos", color: MuscleColors.gluteos },
  { name: "quadriceps", color: MuscleColors.quadriceps },
  { name: "posterior", color: MuscleColors.posterior },
  { name: "panturrilha", color: MuscleColors.panturrilha },
];

const getVolume = (group: string, vol: Record<string, number>) => {
  return vol[group] || 0;
};

export const AvatarCorpo: React.FC<AvatarCorpoProps> = ({ volume }) => {
  // Escala visual: maior volume = região maior/mais escura
  const getRegionSize = (base: number, volumeVal: number) => {
    return Math.max(base, base * (volumeVal / 10));
  };

  return (
    <svg width="800" height="500" viewBox="0 0 800 500" fill="none" stroke="none">
      {/* Silhueta de frente */}
      <g transform="translate(100, 100)" fill="#E0E0E0">
        <!-- Cabeça -->
        <circle cx="400" cy="120" r="80" />
        <!-- Torso -->
        <path d="M350 200 Q400 250 450 200" />
        <!-- Braços -->
        <path d="M350 250 Q300 300 280 350" />
        <path d="M450 250 Q500 300 520 350" />
        <!-- Pernas -->
        <path d="M400 400 Q400 450 400 500" />
      </g>
      {/* Regiões musculares sobrepostas em frente */}
      {MuscleGroups.map((group) => {
        const vol = getVolume(group.name, volume);
        const opacity = Math.min(0.3 + vol * 0.02, 0.9);
        const strokeWidth = Math.max(1, vol * 0.05);
        return (
          <path
            key={group.name}
            d={"M350 200 Q400 250 450 200"}
            fill={group.color}
            opacity={opacity}
            stroke={group.color}
            strokeWidth={strokeWidth}
          />
        );
      })}n
      {/* Silhueta de costas */}
      <g transform="translate(500, 100)" fill="#E0E0E0">
        <!-- Cabeça (de costas) -->
        <circle cx="400" cy="120" r="80" />
        <!-- Torso (de costas) -->
        <path d="M350 200 Q400 250 450 200" />
        <!-- Braços (de costas) -->
        <path d="M350 250 Q300 300 280 350" />
        <path d="M450 250 Q500 300 520 350" />
        <!-- Pernas (de costas) -->
        <path d="M400 400 Q400 450 400 500" />
      </g>
      {/* Regiões musculares na costas */}
      {MuscleGroups.map((group) => {
        const vol = getVolume(group.name, volume);
        const opacity = Math.min(0.3 + vol * 0.02, 0.9);
        const strokeWidth = Math.max(1, vol * 0.05);
        return (
          <path
            key={group.name}
            d={"M350 200 Q400 250 450 200"}
            fill={group.color}
            opacity={opacity}
            stroke={group.color}
            strokeWidth={strokeWidth}
          />
        );
      })}n    </svg>
  );
};

// Exemplo de uso:
// <AvatarCorpo volume={{ peito: 15, ombros: 10, biceps: 8, triceps: 7, abdomen: 12, costas: 9, gluteos: 11, quadriceps: 14, posterior: 6, panturrilha: 5 }} />
