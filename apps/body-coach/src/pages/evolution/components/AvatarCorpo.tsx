import React from 'react';

interface AvatarCorpoProps {
  volume: Record<string, number>;
}

const AvatarCorpo: React.FC<AvatarCorpoProps> = ({ volume }) => {
  // Definição das regiões musculares e seus caminhos SVG
  const muscleRegions = {
    peito: { d: "M 100 150 Q 150 180 180 150 L 170 250 Q 150 270 130 250 L 120 150 Z" },
    ombros: { d: "M 80 120 Q 100 140 120 120 L 100 100 Z M 180 120 Q 200 140 220 120 L 200 100 Z" },
    biceps: { d: "M 80 200 Q 70 220 90 240 L 100 220 Z M 220 200 Q 230 220 210 240 L 200 220 Z" },
    triceps: { d: "M 90 210 Q 110 230 130 210 Z M 190 210 Q 170 230 150 210 Z" },
    abdomen: { d: "M 100 250 Q 150 290 180 250 L 170 300 Q 150 320 130 300 L 120 250 Z" },
    costas: { d: "M 50 150 Q 20 200 50 250 L 80 250 Q 50 200 50 150 Z M 250 150 Q 280 200 250 250 L 220 250 Q 250 200 250 150 Z" },
    gluteos: { d: "M 100 400 Q 150 430 180 400 Z" },
    quadriceps: { d: "M 100 350 Q 120 400 140 350 Z M 160 350 Q 180 400 200 350 Z" },
    posterior: { d: "M 110 380 Q 130 430 150 380 Z M 170 380 Q 190 430 210 380 Z" },
    panturrilha: { d: "M 110 430 Q 130 480 150 430 Z M 170 430 Q 190 480 210 430 Z" },
  };

  // Mapeia volume para opacidade da região
  const getRegionStyle = (regionName: string): React.CSSProperties => {
    const volumeValue = volume[regionName] || 0;
    // Opacidade base 0.2, aumenta até 0.9 com volume
    const opacity = Math.min(0.2 + volumeValue * 0.07, 0.9);
    return {
      fill: `rgba(34, 197, 94, ${opacity})`, // verde esmeralda
      stroke: 'rgba(0, 0, 0, 0.3)',
      strokeWidth: 1,
    };
  };

  return (
    <svg viewBox="0 0 300 500" width="200" height="400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Silhueta humana com grupos musculares destacados">
      {/* Silhueta base (contorno frontal) */}
      <path
        d="M150 0 L100 50 L100 100 L80 150 L80 300 L100 400 L150 450 L200 400 L200 300 L220 150 L200 100 L200 50 Z"
        fill="none"
        stroke="rgba(0,0,0,0.2)"
        strokeWidth="3"
      />

      {/* Regiões musculares */}
      {Object.entries(muscleRegions).map(([regionName, region]) => (
        <path
          key={regionName}
          d={region.d}
          style={getRegionStyle(regionName)}
        />
      ))}
    </svg>
  );
};

export default AvatarCorpo;
