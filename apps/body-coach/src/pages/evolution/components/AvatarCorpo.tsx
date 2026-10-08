import React from "react";

type MuscleGroup =
  | "peito"
  | "ombros"
  | "biceps"
  | "triceps"
  | "abdomen"
  | "costas"
  | "gluteos"
  | "quadriceps"
  | "posterior"
  | "panturrilha";

type Volume = Record<MuscleGroup, number>;

interface AvatarCorpoProps {
  volume: Volume;
  largura?: number;
  altura?: number;
}

const MuscleColors: Record<MuscleGroup, string> = {
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

const getVolume = (group: MuscleGroup, vol: Volume) => {
  return vol[group] || 0;
};

// Caminhos SVG anatmicos para a vista de FRONTE
const frontPaths: Record<MuscleGroup, string> = {
  peito: "M200 300 Q300 200 400 300",
  ombros: "M250 250 Q300 150 350 250",
  biceps: "M300 280 Q350 300 380 320",
  triceps: "M350 280 Q400 300 430 320",
  abdomen: "M300 350 Q350 400 400 350",
  costas: "M200 300 Q300 200 400 300", // serå sobrescrito pela vista de costas
  gluteos: "M300 400 Q350 450 400 400",
  quadriceps: "M320 400 Q360 450 400 450",
  posterior: "M350 300 Q400 250 450 300",
  panturrilha: "M380 450 Q400 500 420 470",
};

// Caminhos SVG anatmicos para a vista de COSTAS (diferente da frente)
const backPaths: Record<MuscleGroup, string> = {
  peito: "M200 300 Q300 200 400 300", // serå coberto por braços/omoplatas
  ombros: "M300 250 Q350 150 400 250",
  biceps: "M350 280 Q400 300 430 320",
  triceps: "M400 280 Q450 300 480 320",
  abdomen: "M300 350 Q350 400 400 350", // coverage by back muscles
  costas: "M200 300 Q300 200 400 300",
  gluteos: "M300 400 Q350 450 400 400",
  quadriceps: "M320 400 Q360 450 400 450",
  posterior: "M350 300 Q400 250 450 300",
  panturrilha: "M380 450 Q400 500 420 470",
};

export const AvatarCorpo: React.FC<AvatarCorpoProps> = ({ volume, largura = 800, altura = 500 }) => {
  return (
    <svg width={largura} height={altura} viewBox="0 0 800 500" fill="none" stroke="none" role="img" aria-label="Silhueta humana mostrando grupos musculares" >
      <title>Silhueta humana com grupos musculares destacados</title>
      <desc>Silhueta humana de frente e de costas com regiões musculares separadas (peito, ombros, bíceps, tríceps, abdômen, costas, glúteos, quadríceps, posterior, panturrilha) com volume visual baseado nas séries registradas.</desc>
      
      {/* Silhueta de frente - corpo inteiro */}
      <g transform="translate(100, 100)" fill="#E0E0E0">
        {/* Contorno geral da silhueta */}
        <path d="M200 300 Q300 150 400 300 Q500 150 600 300 Q700 250 750 350 L750 450 L200 450 Z" fill="#E0E0E0" />
        
        {/* Cabelo */}
        <path d="M300 80 Q300 50 300 30" stroke="#333" stroke-width="2" fill="none" />
        
        {/* Ombros da frente */}
        <path d={frontPaths.ombros} fill={MuscleColors.ombros} opacity={0.8} />
        
        {/* Peito da frente */}
        <path d={frontPaths.peito} fill={MuscleColors.peito} opacity={0.9} />
        
        {/* Braços - bíceps e tríceps */}
        <path d={frontPaths.biceps} fill={MuscleColors.biceps} opacity={0.8} />
        <path d={frontPaths.triceps} fill={MuscleColors.triceps} opacity={0.8} />
        
        {/* Abdômen da frente */}
        <path d={frontPaths.abdomen} fill={MuscleColors.abdomen} opacity={0.9} />
        
        {/* Glúteos */}
        <path d={frontPaths.gluteos} fill={MuscleColors.gluteos} opacity={0.8} />
        
        {/* Coxas - quadríceps e posterior */}
        <path d={frontPaths.quadriceps} fill={MuscleColors.quadriceps} opacity={0.8} />
        <path d={frontPaths.posterior} fill={MuscleColors.posterior} opacity={0.7} />
        
        {/* Panturrilhas */}
        <path d={frontPaths.panturrilha} fill={MuscleColors.panturrilha} opacity={0.8} />
      </g>
      
      {/* Silhueta de costas - sobreposta à frente */}
      <g transform="translate(100, 100)" fill="#E0E0E0">
        {/* Contorno geral da silhueta de costas */}
        <path d="M200 300 Q300 150 400 300 Q500 150 600 300 Q700 250 750 350 L750 450 L200 450 Z" fill="#E0E0E0" />
        
        {/* Ombros de costas (omoplatas visíveis) */}
        <path d={backPaths.ombros} fill={MuscleColors.ombros} opacity={0.7} />
        
        {/* Regiões musculares de costas */}
        {Object.keys(frontPaths).map((group) => {
          const vol = getVolume(group as MuscleGroup, volume);
          const opacity = Math.min(0.2 + vol * 0.03, 0.8);
          const strokeWidth = Math.max(0.5, vol * 0.04);
          return (
            <path
              key={group}
              d={backPaths[group as MuscleGroup]}
              fill={MuscleColors[group as MuscleGroup]}
              opacity={opacity}
              stroke={MuscleColors[group as MuscleGroup]}
              strokeWidth={strokeWidth}
            />
          );
        })}n
      </g>
    </svg>
  );
};

// Exemplos de uso:
// <AvatarCorpo volume={{ peito: 15, ombros: 10, biceps: 8, triceps: 7, abdomen: 12, costas: 9, gluteos: 11, quadriceps: 14, posterior: 6, panturrilha: 5 }} />
// <AvatarCorpo volume={{ peito: 5, ombros: 3, biceps: 2, triceps: 2, abdomen: 4, costas: 3, gluteos: 3, quadriceps: 5, posterior: 2, panturrilha: 2 }} largura={600} altura={400} />
