import React from 'react';

interface AvatarCorpoProps {
  volume: Record<string, number>;
  view?: 'front' | 'back';
  className?: string;
  width?: number;
  height?: number;
}

const muscleGroups: Record<string, { front: string; back: string; label: string }> = {
  chest: {
    front: "M120 120 Q140 100 160 120 Q140 140 120 120 Z M280 120 Q260 100 240 120 Q260 140 280 120 Z",
    back: "",
    label: 'Peito',
  },
  shoulders: {
    front: "M100 100 Q120 80 200 80 Q220 100 200 120 Q220 90 200 80 Q120 80 100 100 Z M200 100 Q220 80 300 80 Q320 100 300 120 Q220 90 200 80 Z",
    back: "M100 110 Q120 90 200 90 Q220 110 200 130 Q220 100 200 90 Q120 90 100 110 Z M200 110 Q220 90 300 90 Q320 110 300 130 Q220 100 200 90 Z",
    label: 'Ombros',
  },
  biceps: {
    front: "M80 140 Q70 160 90 200 Q110 180 100 140 Z M320 140 Q330 160 310 200 Q290 180 300 140 Z",
    back: "M80 150 Q70 170 90 210 Q110 190 100 150 Z M320 150 Q330 170 310 210 Q290 190 300 150 Z",
    label: 'Bíceps',
  },
  triceps: {
    front: "M80 180 Q60 200 80 240 Q100 220 90 180 Z M320 180 Q340 200 320 240 Q300 220 310 180 Z",
    back: "M80 190 Q60 210 80 250 Q100 230 90 190 Z M320 190 Q340 210 320 250 Q300 230 310 190 Z",
    label: 'Tríceps',
  },
  abs: {
    front: "M140 200 Q160 190 180 210 Q180 250 160 270 Q140 260 140 240 Z M180 200 Q200 190 220 210 Q220 250 200 270 Q180 260 180 240 Z M140 240 Q160 230 180 250 Q180 290 160 310 Q140 300 140 280 Z M180 240 Q200 230 220 250 Q220 290 200 310 Q180 300 180 280 Z",
    back: "",
    label: 'Abdômen',
  },
  back: {
    front: "",
    back: "M120 130 Q140 120 180 140 Q160 180 140 200 Q120 190 120 170 Z M280 130 Q260 120 220 140 Q240 180 260 200 Q280 190 280 170 Z M140 180 Q200 160 260 180 Q260 280 200 300 Q140 280 140 220 Z",
    label: 'Costas',
  },
  glutes: {
    front: "",
    back: "M140 300 Q160 290 180 310 Q180 350 160 370 Q140 360 140 340 Z M180 300 Q200 290 220 310 Q220 350 200 370 Q180 360 180 340 Z",
    label: 'Glúteos',
  },
  quads: {
    front: "M140 320 Q150 310 170 330 Q170 390 150 410 Q130 400 130 360 Z M190 320 Q200 310 220 330 Q220 390 200 410 Q180 400 180 360 Z M130 390 Q140 380 160 400 Q160 460 140 480 Q120 470 120 430 Z M190 390 Q200 380 220 400 Q220 460 200 480 Q180 470 180 430 Z",
    back: "M140 340 Q150 330 170 350 Q170 410 150 430 Q130 420 130 380 Z M190 340 Q200 330 220 350 Q220 410 200 430 Q180 420 180 380 Z",
    label: 'Quadríceps',
  },
  hamstrings: {
    front: "",
    back: "M140 360 Q150 350 170 370 Q170 430 150 450 Q130 440 130 400 Z M190 360 Q200 350 220 370 Q220 430 200 450 Q180 440 180 400 Z",
    label: 'Posterior',
  },
  calves: {
    front: "M140 440 Q150 430 160 440 Q160 500 140 520 Q120 510 120 470 Z M190 440 Q200 430 210 440 Q210 500 190 520 Q170 510 170 470 Z",
    back: "M140 460 Q150 450 160 460 Q160 520 140 540 Q120 530 120 490 Z M190 460 Q200 450 210 460 Q210 520 190 540 Q170 530 170 490 Z",
    label: 'Panturrilha',
  },
};

const silhouetteFront = `
  <path
    d="M200 60 Q180 40 140 50 Q100 60 100 100 Q100 140 120 180 Q110 220 130 260 Q130 300 140 320 Q140 360 130 380 Q120 420 140 460 Q150 500 160 500 Q170 500 180 460 Q200 420 190 380 Q180 360 190 320 Q200 300 190 260 Q170 220 180 180 Q200 140 200 100 Q200 60 180 50 Q160 40 200 60 Z
    M200 60 Q220 40 260 50 Q300 60 300 100 Q300 140 280 180 Q290 220 270 260 Q270 300 260 320 Q260 360 270 380 Q280 420 260 460 Q250 500 240 500 Q230 500 220 460 Q200 420 210 380 Q220 360 210 320 Q200 300 210 260 Q230 220 220 180 Q200 140 200 100 Q200 60 220 50 Q240 40 200 60 Z"
    fill="currentColor"
    opacity="0.15"
    stroke="currentColor"
    strokeWidth="1"
  />
`;

const silhouetteBack = `
  <path
    d="M200 60 Q180 40 140 50 Q100 60 100 100 Q100 140 120 180 Q110 220 130 260 Q130 300 140 320 Q140 360 130 380 Q120 420 140 460 Q150 500 160 500 Q170 500 180 460 Q200 420 190 380 Q180 360 190 320 Q200 300 190 260 Q170 220 180 180 Q200 140 200 100 Q200 60 180 50 Q160 40 200 60 Z
    M200 60 Q220 40 260 50 Q300 60 300 100 Q300 140 280 180 Q290 220 270 260 Q270 300 260 320 Q260 360 270 380 Q280 420 260 460 Q250 500 240 500 Q230 500 220 460 Q200 420 210 380 Q220 360 210 320 Q200 300 210 260 Q230 220 220 180 Q200 140 200 100 Q200 60 220 50 Q240 40 200 60 Z"
    fill="currentColor"
    opacity="0.15"
    stroke="currentColor"
    strokeWidth="1"
  />
`;

export const AvatarCorpo: React.FC<AvatarCorpoProps> = ({
  volume,
  view = 'front',
  className = '',
  width = 400,
  height = 600,
}) => {
  const getIntensity = (muscleKey: string) => {
    const series = volume[muscleKey] || 0;
    if (series === 0) return 0;
    if (series <= 6) return 0.3;
    if (series <= 12) return 0.55;
    if (series <= 18) return 0.75;
    return 1;
  };

  const getColor = (intensity: number) => {
    if (intensity === 0) return 'transparent';
    if (intensity < 0.4) return 'rgba(34, 197, 94, 0.4)';
    if (intensity < 0.7) return 'rgba(234, 179, 8, 0.6)';
    return 'rgba(239, 68, 68, 0.8)';
  };

  const musclesToRender = view === 'front'
    ? ['chest', 'shoulders', 'biceps', 'triceps', 'abs', 'quads', 'calves']
    : ['shoulders', 'biceps', 'triceps', 'back', 'glutes', 'quads', 'hamstrings', 'calves'];

  return (
    <div className={`relative inline-block ${className}`} style={{ width, height }}>
      <svg viewBox="0 0 400 600" width={width} height={height} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Silhueta humana vista ${view === 'front' ? 'de frente' : 'de costas'}`}>
        {view === 'front' ? <>{silhouetteFront}</> : <>{silhouetteBack}</>}
        {musclesToRender.map((muscleKey) => {
          const pathData = view === 'front' ? muscleGroups[muscleKey].front : muscleGroups[muscleKey].back;
          if (!pathData) return null;
          const intensity = getIntensity(muscleKey);
          const color = getColor(intensity);
          return (
            <path
              key={muscleKey}
              d={pathData}
              fill={color}
              stroke="currentColor"
              strokeWidth={0.5}
              opacity={intensity > 0 ? 0.85 : 0}
              style={{ transition: 'fill 0.3s ease, opacity 0.3s ease' }}
              data-muscle={muscleKey}
              data-volume={volume[muscleKey] || 0}
            />
          );
        })}
      </svg>
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent text-white text-xs font-medium">
        Vista {view === 'front' ? 'Frontal' : 'Posterior'}
      </div>
    </div>
  );
};

export default AvatarCorpo;
